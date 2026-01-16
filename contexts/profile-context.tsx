/**
 * Profile Context
 * 
 * Handles user profile loading, ego management, and family tree syncing.
 * Separated from AuthContext to follow separation of concerns.
 * 
 * Responsibilities:
 * - Check user profile when authenticated
 * - Load ego into store
 * - Sync family tree from backend
 * - Make initial routing decisions
 */

import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/auth-context';
import { useSessionStore } from '@/stores/session-store';
import { getUserProfile } from '@/services/supabase/people-api';
import type { Person } from '@/types/family-tree';
import { isCOPPABlocked } from '@/utils/coppa-utils';

interface ProfileContextType {
  profile: Person | null;
  isLoadingProfile: boolean;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const { session, isLoading: isAuthLoading } = useAuth();
  const router = useRouter();
  
  const [profile, setProfile] = useState<Person | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  
  // Guards to prevent race conditions
  const profileCheckRef = useRef<Promise<void> | null>(null);
  const initialRoutingDoneRef = useRef(false); // Track if initial routing decision has been made
  const syncFamilyTreeDoneRef = useRef<string | null>(null); // Track if syncFamilyTree has been called for current session
  const previousSessionRef = useRef<typeof session>(null); // Track previous session state for sign-in detection
  const coppaCheckDoneRef = useRef<string | null>(null); // Track if COPPA check has been done for current user

  // Step 5: Handle session change coordination
  // Reset refs when session changes (sign-in or sign-out)
  useEffect(() => {
    if (session && !previousSessionRef.current) {
      // Session just became truthy (sign-in happened) - reset refs so profile check runs
      initialRoutingDoneRef.current = false;
      syncFamilyTreeDoneRef.current = null; // Reset so sync runs on sign-in (same or different user)
      if (__DEV__) {
        console.log('[ProfileContext] Session started, resetting refs for profile check');
      }
    }
    
    // CRITICAL: Reset sync ref if userId changed (different user logged in)
    // This ensures syncFamilyTree runs for each new user, not just once per app session
    if (session && previousSessionRef.current) {
      const previousUserId = previousSessionRef.current.user.id;
      const newUserId = session.user.id;
      if (previousUserId !== newUserId) {
        // Different user logged in - reset all refs so checks run for the new user
        syncFamilyTreeDoneRef.current = null;
        initialRoutingDoneRef.current = false;
        coppaCheckDoneRef.current = null; // Reset COPPA check for new user
        if (__DEV__) {
          // SECURITY: Don't log actual user IDs - just indicate a change occurred
          console.log('[ProfileContext] Different user logged in, resetting all refs');
        }
      }
    }
    
    // Update ref to track session state for next callback
    previousSessionRef.current = session;
    
    // If session becomes null (sign out), clear profile and reset refs
    if (!session) {
      setProfile(null);
      syncFamilyTreeDoneRef.current = null;
      initialRoutingDoneRef.current = false;
      coppaCheckDoneRef.current = null; // Reset COPPA check on sign out
      if (__DEV__) {
        console.log('[ProfileContext] Session ended, cleared profile and reset refs');
      }
    }
  }, [session]);

  // Steps 2-4: Check user profile after authentication (handles race conditions)
  // CRITICAL: Use session?.user?.id instead of entire session object to prevent unnecessary re-runs
  // Only depend on user ID and loading state, not the entire session object
  useEffect(() => {
    // Wait for auth to complete before checking profile
    if (isAuthLoading || !session) {
      return;
    }

    // Prevent multiple simultaneous profile checks
    if (isLoadingProfile || profileCheckRef.current) {
      return;
    }

    // CRITICAL: Track if we've already executed for this user ID to prevent duplicate execution
    // This handles React 19 development mode double-execution
    const currentUserId = session.user.id;
    if (syncFamilyTreeDoneRef.current === currentUserId && profileCheckRef.current) {
      // Already executed for this user - skip
      if (__DEV__) {
        console.log('[ProfileContext] Profile check already executed for this user, skipping');
      }
      return;
    }

    const checkProfile = async () => {
      setIsLoadingProfile(true);
      
      try {
        // COPPA Compliance: Check if user is blocked BEFORE checking profile
        // This prevents COPPA-deleted users from accessing the app at all
        // Use ref to prevent duplicate checks (race condition prevention)
        if (coppaCheckDoneRef.current !== currentUserId) {
          const isBlocked = await isCOPPABlocked(currentUserId);
          coppaCheckDoneRef.current = currentUserId;
          
          if (isBlocked) {
            // User is COPPA-blocked - redirect to blocked screen immediately
            if (!initialRoutingDoneRef.current) {
              initialRoutingDoneRef.current = true;
              setTimeout(() => {
                router.replace('/(auth)/coppa-blocked');
              }, 0);
            }
            // Clear profile state
            useSessionStore.getState().clearEgo();
            setProfile(null);
            setIsLoadingProfile(false);
            profileCheckRef.current = null;
            return; // Exit early - don't continue with profile check
          }
        }
        
        const userProfile = await getUserProfile(session.user.id);
        
        if (userProfile) {
          // User has profile → Load into Zustand and update state
          useSessionStore.getState().loadEgo(userProfile);
          setProfile(userProfile);
          
          // Step 3: Sync entire family tree from backend ONCE per session (loads all people and relationships)
          // This ensures relationships are loaded even if we only have ego profile initially
          // Use ref to prevent multiple syncs if useEffect runs again
          if (syncFamilyTreeDoneRef.current !== currentUserId) {
            syncFamilyTreeDoneRef.current = currentUserId;
            if (__DEV__) {
              console.log('[ProfileContext] Syncing family tree after loading ego');
            }
            try {
              await useSessionStore.getState().syncFamilyTree(currentUserId);
              if (__DEV__) {
                console.log('[ProfileContext] Family tree synced successfully');
              }
            } catch (error: any) {
              console.error('[ProfileContext] Error syncing family tree', error);
              // Reset ref on error so it can retry on next check
              syncFamilyTreeDoneRef.current = null;
              // Don't fail profile flow if sync fails - relationships will be loaded on next sync
            }
          } else {
            if (__DEV__) {
              console.log('[ProfileContext] syncFamilyTree already called for this session, skipping');
            }
          }
          
          // Step 4: Profile exists → Make initial routing decision (ONLY ONCE)
          if (!initialRoutingDoneRef.current) {
            initialRoutingDoneRef.current = true;
            // Verify ego belongs to current user
            const egoId = userProfile.id;
            const isEgoForCurrentUser = userProfile.linkedAuthUserId === currentUserId;
            
            if (isEgoForCurrentUser) {
              // Returning user with their profile - go to tabs
              // CRITICAL FIX #3: Use setTimeout to ensure navigation happens after Expo Router is ready
              // Prevents navigation from being cancelled by expo-router's internal layout mounting logic
              setTimeout(() => {
                router.replace('/(tabs)');
              }, 0);
            } else {
              // Ego doesn't belong to user - clear and go to onboarding
              useSessionStore.getState().clearEgo();
              setProfile(null);
              setTimeout(() => {
                router.replace('/(onboarding)/welcome');
              }, 0);
            }
          }
        } else {
          // No profile found → New user, clear any stale ego data
          useSessionStore.getState().clearEgo();
          setProfile(null);
          
          // Step 4: No profile → Make initial routing decision (ONLY ONCE)
          if (!initialRoutingDoneRef.current) {
            initialRoutingDoneRef.current = true;
            // CRITICAL FIX #3: Use setTimeout to ensure navigation happens after Expo Router is ready
            setTimeout(() => {
              router.replace('/(onboarding)/welcome');
            }, 0);
          }
        }
      } catch (err: any) {
        console.error('[ProfileContext] Error checking user profile:', err);
        // Treat error as new user (safe fallback)
        useSessionStore.getState().clearEgo();
        setProfile(null);
      } finally {
        setIsLoadingProfile(false);
        profileCheckRef.current = null;
      }
    };

    profileCheckRef.current = checkProfile();
    // NOTE: Use session?.user?.id instead of entire session object to prevent unnecessary re-runs
    // Only re-run when user ID changes or loading state changes
  }, [session?.user?.id, isAuthLoading, router]);

  return (
    <ProfileContext.Provider value={{ profile, isLoadingProfile }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const context = useContext(ProfileContext);
  if (context === undefined) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return context;
}
