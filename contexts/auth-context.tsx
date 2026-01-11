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
    unsubscribeRef.current = authService.current.onAuthStateChanged((newSession) => {
      if (mounted) {
        // CRITICAL FIX #1: Reset routing flag when session becomes truthy (sign-in)
        // This ensures profile check always has permission to redirect after sign-in
        // Use ref to track previous session (callback closure may have stale state)
        if (newSession && !previousSessionRef.current) {
          // Session just became truthy (sign-in happened)
          initialRoutingDoneRef.current = false;
        }
        
        // Update ref to track session state for next callback
        previousSessionRef.current = newSession;
        
        setSession(newSession);
        setIsLoading(false);
        
        // If session becomes null (sign out), clear ego immediately
        if (!newSession) {
          const ego = useFamilyTreeStore.getState().getEgo();
          if (ego) {
            useFamilyTreeStore.getState().clearEgo();
          }
        }
      }
    });

    return () => {
      mounted = false;
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, []);

  // Check user profile after authentication (handles race conditions)
  useEffect(() => {
    // Wait for auth to complete before checking profile
    if (isLoading || !session) {
      return;
    }

    // Prevent multiple simultaneous profile checks
    if (isCheckingProfile || profileCheckRef.current) {
      return;
    }

    const checkProfile = async () => {
      setIsCheckingProfile(true);
      
      try {
        const profile = await getUserProfile(session.user.id);
        
        if (profile) {
          // User has profile → Load into Zustand
          useFamilyTreeStore.getState().loadEgo(profile);
          
          // Profile exists → Make initial routing decision (ONLY ONCE)
          if (!initialRoutingDoneRef.current) {
            initialRoutingDoneRef.current = true;
            // Verify ego belongs to current user
            const currentUserId = session.user.id;
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
  }, [session, isLoading, isCheckingProfile]);

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

