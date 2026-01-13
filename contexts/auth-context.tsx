/**
 * Auth Context
 * 
 * Provides authentication state and methods throughout the app.
 * Handles routing guards and auth state synchronization.
 */

import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { AuthSession, AuthProvider as AuthProviderType, AuthError } from '@/services/auth/types';
import { getAuthService } from '@/services/auth';
import { useFamilyTreeStore } from '@/stores/family-tree-store';
import { getUserProfile } from '@/services/supabase/people-api';
import { useStatsigClient } from '@statsig/expo-bindings';

interface AuthContextType {
  session: AuthSession | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signInWithProvider: (provider: AuthProviderType) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, name?: string) => Promise<void>;
  signOut: () => Promise<void>;
  error: AuthError | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCheckingProfile, setIsCheckingProfile] = useState(false);
  const [error, setError] = useState<AuthError | null>(null);
  const router = useRouter();
  const segments = useSegments();
  const authService = useRef(getAuthService());
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const profileCheckRef = useRef<Promise<void> | null>(null);
  const initialRoutingDoneRef = useRef(false); // Track if initial routing decision has been made
  const previousSessionRef = useRef<AuthSession | null>(null); // Track previous session state for sign-in detection
  const syncFamilyTreeDoneRef = useRef<string | null>(null); // Track if syncFamilyTree has been called for current session
  
  // Get Statsig client - StatsigProvider is above AuthProvider, so client is always available
  const { client: statsigClient } = useStatsigClient();

  // Initialize auth state
  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        // Check if already authenticated
        const currentSession = await authService.current.getCurrentSession();
        
        // If no session, clear ego (user signed out or app restarted)
        if (!currentSession && mounted) {
          const ego = useFamilyTreeStore.getState().getEgo();
          if (ego) {
            useFamilyTreeStore.getState().clearEgo();
          }
        }
        
        if (mounted) {
          setSession(currentSession);
          setIsLoading(false);
        }
      } catch (err: any) {
        console.error('Auth initialization error:', err);
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    initializeAuth();

    // Subscribe to auth state changes
    unsubscribeRef.current = authService.current.onAuthStateChanged(async (newSession) => {
      if (mounted) {
        // PRO APPROACH: Sync Statsig identity when session changes
        // StatsigProvider is above AuthProvider, so Statsig is always initialized
        // We can safely call client.updateUserAsync() to promote/demote user identity
        try {
          if (newSession?.user && statsigClient) {
            // PROMOTE guest to real user
            await statsigClient.updateUserAsync({
              userID: newSession.user.id,
              email: newSession.user.email,
            });
            
            if (__DEV__) {
              console.log('[AuthContext] Promoted Statsig user to authenticated');
            }
            
            // Log sign-in event immediately after user update
            statsigClient.logEvent('user_signs_in', 'google', {
              timestamp: new Date().toISOString(),
            });
            
            // CRITICAL: Force flush to ensure event is sent immediately
            // This is important for sign-in events that we want to track right away
            await statsigClient.flush();
            
            if (__DEV__) {
              console.log('[AuthContext] Logged user_signs_in event to Statsig and flushed');
            }
          } else if (!newSession && statsigClient) {
            // DEMOTE back to guest on logout
            await statsigClient.updateUserAsync({ userID: '' });
            
            if (__DEV__) {
              console.log('[AuthContext] Demoted Statsig user to guest');
            }
          }
        } catch (statsigError: any) {
          // Statsig error - log but don't block auth flow
          if (__DEV__) {
            console.warn('[AuthContext] Could not update Statsig user:', statsigError);
          }
        }
        
        // CRITICAL FIX #1: Reset routing flag when session becomes truthy (sign-in)
        // This ensures profile check always has permission to redirect after sign-in
        // Use ref to track previous session (callback closure may have stale state)
        if (newSession && !previousSessionRef.current) {
          // Session just became truthy (sign-in happened) - reset sync ref so it syncs
          initialRoutingDoneRef.current = false;
          syncFamilyTreeDoneRef.current = null; // Reset so sync runs on sign-in (same or different user)
        }
        
        // CRITICAL: Reset sync ref if userId changed (different user logged in)
        // This ensures syncFamilyTree runs for each new user, not just once per app session
        if (newSession && previousSessionRef.current) {
          const previousUserId = previousSessionRef.current.user.id;
          const newUserId = newSession.user.id;
          if (previousUserId !== newUserId) {
            // Different user logged in - reset sync ref so it syncs for the new user
            syncFamilyTreeDoneRef.current = null;
            if (__DEV__) {
              // SECURITY: Don't log actual user IDs - just indicate a change occurred
              console.log('[AuthContext] Different user logged in, resetting sync ref');
            }
          }
        }
        
        // Update ref to track session state for next callback
        previousSessionRef.current = newSession;
        
        setSession(newSession);
        setIsLoading(false);
        
        // If session becomes null (sign out), clear ego immediately and reset sync ref
        if (!newSession) {
          const ego = useFamilyTreeStore.getState().getEgo();
          if (ego) {
            useFamilyTreeStore.getState().clearEgo();
          }
          syncFamilyTreeDoneRef.current = null; // Reset so sync can run again on next sign-in
        }
      }
    });

    return () => {
      mounted = false;
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [statsigClient]); // Include statsigClient in dependencies

  // Check user profile after authentication (handles race conditions)
  // CRITICAL: Use session?.user?.id instead of entire session object to prevent unnecessary re-runs
  // Only depend on user ID and loading state, not the entire session object
  useEffect(() => {
    // Wait for auth to complete before checking profile
    if (isLoading || !session) {
      return;
    }

    // Prevent multiple simultaneous profile checks
    if (isCheckingProfile || profileCheckRef.current) {
      return;
    }

    // CRITICAL: Track if we've already executed for this user ID to prevent duplicate execution
    // This handles React 19 development mode double-execution
    const currentUserId = session.user.id;
    if (syncFamilyTreeDoneRef.current === currentUserId && profileCheckRef.current) {
      // Already executed for this user - skip
      if (__DEV__) {
        console.log('[AuthContext] Profile check already executed for this user, skipping');
      }
      return;
    }

    const checkProfile = async () => {
      setIsCheckingProfile(true);
      
      try {
        const profile = await getUserProfile(session.user.id);
        
        if (profile) {
          // User has profile → Load into Zustand
          useFamilyTreeStore.getState().loadEgo(profile);
          
          // CRITICAL: Sync entire family tree from backend ONCE per session (loads all people and relationships)
          // This ensures relationships are loaded even if we only have ego profile initially
          // Use ref to prevent multiple syncs if useEffect runs again
          if (syncFamilyTreeDoneRef.current !== currentUserId) {
            syncFamilyTreeDoneRef.current = currentUserId;
            if (__DEV__) {
              console.log('[AuthContext] Syncing family tree after loading ego');
            }
            try {
              await useFamilyTreeStore.getState().syncFamilyTree(currentUserId);
              if (__DEV__) {
                console.log('[AuthContext] Family tree synced successfully');
              }
            } catch (error: any) {
              console.error('[AuthContext] Error syncing family tree', error);
              // Reset ref on error so it can retry on next check
              syncFamilyTreeDoneRef.current = null;
              // Don't fail auth flow if sync fails - relationships will be loaded on next sync
            }
          } else {
            if (__DEV__) {
              console.log('[AuthContext] syncFamilyTree already called for this session, skipping');
            }
          }
          
          // Profile exists → Make initial routing decision (ONLY ONCE)
          if (!initialRoutingDoneRef.current) {
            initialRoutingDoneRef.current = true;
            // Verify ego belongs to current user
            const egoId = profile.id;
            const isEgoForCurrentUser = !!(egoId && egoId === currentUserId) || !!(profile.createdBy && profile.createdBy === currentUserId);
            
            if (isEgoForCurrentUser) {
              // Returning user with their profile - go to tabs
              // CRITICAL FIX #3: Use setTimeout to ensure navigation happens after Expo Router is ready
              // Prevents navigation from being cancelled by expo-router's internal layout mounting logic
              setTimeout(() => {
                router.replace('/(tabs)');
              }, 0);
            } else {
              // Ego doesn't belong to user - clear and go to onboarding
              useFamilyTreeStore.getState().clearEgo();
              setTimeout(() => {
                router.replace('/(onboarding)/welcome');
              }, 0);
            }
          }
        } else {
          // No profile found → New user, clear any stale ego data
          useFamilyTreeStore.getState().clearEgo();
          
          // No profile → Make initial routing decision (ONLY ONCE)
          if (!initialRoutingDoneRef.current) {
            initialRoutingDoneRef.current = true;
            // CRITICAL FIX #3: Use setTimeout to ensure navigation happens after Expo Router is ready
            setTimeout(() => {
              router.replace('/(onboarding)/welcome');
            }, 0);
          }
        }
      } catch (err: any) {
        console.error('[AuthContext] Error checking user profile:', err);
        // Treat error as new user (safe fallback)
        useFamilyTreeStore.getState().clearEgo();
      } finally {
        setIsCheckingProfile(false);
        profileCheckRef.current = null;
      }
    };

    profileCheckRef.current = checkProfile();
    // NOTE: Use session?.user?.id instead of entire session object to prevent unnecessary re-runs
    // Only re-run when user ID changes or loading state changes
  }, [session?.user?.id, isLoading]);

  // Routing guard: ONLY protects tabs access (security) and handles unauthenticated users
  // Initial routing decision is made in profile check useEffect (runs once)
  // NOTE: We use useSegments() inside the effect, not in dependencies, to avoid constant re-runs
  useEffect(() => {
    // Wait for auth check to complete
    if (isLoading) {
      return;
    }

    const firstSegment = segments[0];
    const inAuthGroup = firstSegment === '(auth)';
    const inTabsGroup = firstSegment === '(tabs)';
    const inOnboardingGroup = firstSegment === '(onboarding)';

    if (!session) {
      // NOT AUTHENTICATED: Must go to login first
      // Clear any stale ego data when not authenticated
      const ego = useFamilyTreeStore.getState().getEgo();
      if (ego) {
        useFamilyTreeStore.getState().clearEgo();
      }
      
      // Redirect to login if not already there
      if (!inAuthGroup) {
        router.replace('/(auth)/login');
      }
    } else {
      // AUTHENTICATED: Only guard tabs access (security check)
      // If they somehow get to tabs without a profile, redirect to onboarding
      if (inTabsGroup) {
        const ego = useFamilyTreeStore.getState().getEgo();
        const currentUserId = session.user.id;
        const egoId = ego?.id;
        const isEgoForCurrentUser = !!(egoId && egoId === currentUserId) || !!(ego?.createdBy && ego.createdBy === currentUserId);
        const hasValidProfile = !!ego && isEgoForCurrentUser;
        
        if (!hasValidProfile) {
          // Trying to access tabs without valid profile - redirect to onboarding
          useFamilyTreeStore.getState().clearEgo();
          router.replace('/(onboarding)/welcome');
        }
      } else if (inAuthGroup) {
        // User is authenticated but still on login screen - profile check useEffect should handle navigation
        // Don't redirect here - let profile check useEffect handle it after checking profile
      }
      // Otherwise, let them navigate freely (onboarding flow, etc.)
    }
    // Only depend on session and isLoading - segments accessed inside effect to avoid constant re-runs
  }, [session, isLoading, router]);

  const signInWithProvider = async (provider: AuthProviderType) => {
    try {
      setError(null);
      
      // Clear any existing ego before sign in (will be reloaded from database if exists)
      useFamilyTreeStore.getState().clearEgo();
      
      const newSession = await authService.current.signInWithProvider(provider);
      
      // Session will trigger profile check in useEffect
      setSession(newSession);
    } catch (err: any) {
      setError(err);
      throw err;
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    try {
      setError(null);
      const newSession = await authService.current.signInWithEmail(email, password);
      setSession(newSession);
    } catch (err: any) {
      setError(err);
      throw err;
    }
  };

  const signUpWithEmail = async (email: string, password: string, name?: string) => {
    try {
      setError(null);
      const newSession = await authService.current.signUpWithEmail(email, password, name);
      setSession(newSession);
    } catch (err: any) {
      setError(err);
      throw err;
    }
  };

  const signOut = async () => {
    try {
      setError(null);
      
      // Clear local state FIRST (before sign out completes)
      // This prevents any race conditions where auth state listener might restore session
      useFamilyTreeStore.getState().clearEgo();
      initialRoutingDoneRef.current = false;
      setSession(null); // Clear session state immediately
      
      // Now sign out from services (Google + Supabase)
      // This clears stored tokens/credentials
      await authService.current.signOut();
      
      // Double-check: Ensure session is null after sign out
      // The auth state listener should fire, but we set it explicitly here too
      const currentSession = await authService.current.getCurrentSession();
      if (currentSession) {
        console.warn('[AuthContext] Session still exists after signOut, forcing clear');
        setSession(null);
      }
      
      // Ensure session state is null
      setSession(null);
      
      // Manually redirect to login after sign out completes
      // This ensures immediate navigation rather than waiting for routing guard to react
      // The routing guard will also handle this, but explicit navigation is more reliable
      router.replace('/(auth)/login');
    } catch (err: any) {
      setError(err);
      // Clear session anyway to ensure sign out completes
      useFamilyTreeStore.getState().clearEgo();
      initialRoutingDoneRef.current = false;
      setSession(null);
      
      // Redirect to login even on error (user should be logged out)
      router.replace('/(auth)/login');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        isLoading,
        isAuthenticated: !!session,
        signInWithProvider,
        signInWithEmail,
        signUpWithEmail,
        signOut,
        error,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

