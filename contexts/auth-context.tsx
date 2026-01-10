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
  const [error, setError] = useState<AuthError | null>(null);
  const router = useRouter();
  const segments = useSegments();
  const authService = useRef(getAuthService());
  const unsubscribeRef = useRef<(() => void) | null>(null);

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
        setSession(newSession);
        setIsLoading(false);
      }
    });

    return () => {
      mounted = false;
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, []);

  // Routing guard: redirect based on auth state
  useEffect(() => {
    if (isLoading) return; // Wait for auth check to complete

    const firstSegment = segments[0];
    const inAuthGroup = firstSegment === '(auth)';
    const inOnboardingGroup = firstSegment === '(onboarding)';
    const inTabsGroup = firstSegment === '(tabs)';
    const hasNoRoute = segments.length === 0 || !firstSegment || firstSegment === 'index';

    if (!session) {
      // NOT AUTHENTICATED: Must go to login first
      if (!inAuthGroup) {
        // Not on login screen, redirect to login
        // This handles: empty segments, onboarding screens, tabs, etc.
        router.replace('/(auth)/login');
      }
      // If already on login screen, let them stay
    } else {
      // AUTHENTICATED: Check onboarding status
      const ego = useFamilyTreeStore.getState().getEgo();
      const onboardingComplete = !!ego;

      if (hasNoRoute || inAuthGroup) {
        // On root or login screen but authenticated - redirect based on onboarding
        // Check if ego belongs to current user
        const currentUserId = session.user.id;
        const egoCreatedBy = ego?.createdBy;
        // If ego has no createdBy, it's from old code - treat as not belonging to user
        // Only trust ego if it has createdBy matching current user
        const isEgoForCurrentUser = !!egoCreatedBy && egoCreatedBy === currentUserId;
        
        if (onboardingComplete && isEgoForCurrentUser) {
          // Returning user with their ego - go to app
          router.replace('/(tabs)');
        } else {
          // New user OR ego doesn't belong to current user OR ego has no createdBy - go to onboarding
          // If ego exists but doesn't belong to user or has no createdBy, clear it first
          if (ego && (!isEgoForCurrentUser || !egoCreatedBy)) {
            useFamilyTreeStore.getState().clearEgo();
          }
          // Only redirect to welcome if not already on welcome screen (prevent duplicate navigation)
          if (!inOnboardingGroup || segments[1] !== 'welcome') {
            router.replace('/(onboarding)/welcome');
          }
        }
      } else if (inTabsGroup && !onboardingComplete) {
        // Trying to access main app but onboarding not complete
        // Only redirect if not already on welcome screen
        if (!inOnboardingGroup || segments[1] !== 'welcome') {
          router.replace('/(onboarding)/welcome');
        }
      }
      // If in onboarding group and already on a valid onboarding screen, let them navigate through it (no redirect)
    }
  }, [session, isLoading, segments, router]);

  const signInWithProvider = async (provider: AuthProviderType) => {
    try {
      setError(null);
      
      // Check ego before sign in
      const egoBeforeSignIn = useFamilyTreeStore.getState().getEgo();
      
      const newSession = await authService.current.signInWithProvider(provider);
      
      // If ego exists but doesn't belong to this user, clear it
      const currentUserId = newSession?.user?.id;
      if (egoBeforeSignIn && egoBeforeSignIn.createdBy && egoBeforeSignIn.createdBy !== currentUserId) {
        useFamilyTreeStore.getState().clearEgo();
      }
      
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
      await authService.current.signOut();
      // Clear ego when signing out (fresh start for next login)
      useFamilyTreeStore.getState().clearEgo();
      // Clear session - routing guard will handle navigation to login
      setSession(null);
      // Don't manually navigate - let the routing guard handle it to avoid duplicate navigations
    } catch (err: any) {
      setError(err);
      // Don't throw - let the routing guard handle navigation
      // Clear session anyway to ensure sign out completes
      useFamilyTreeStore.getState().clearEgo();
      setSession(null);
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

