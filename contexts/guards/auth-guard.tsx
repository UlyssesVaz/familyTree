/**
 * Auth Guard Component
 * 
 * Protects routes based on authentication state.
 * Handles redirects for unauthenticated users and validates profile access.
 * 
 * Separated from AuthContext to follow separation of concerns.
 */

import { useEffect } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { useAuth } from '@/contexts/auth-context';
import { useSessionStore } from '@/stores/session-store';

/**
 * Auth Guard Component
 * 
 * Protects routes by:
 * - Redirecting unauthenticated users to login
 * - Validating profile access for authenticated users accessing tabs
 * - Clearing stale ego data when appropriate
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { session, isLoading } = useAuth();
  const router = useRouter();
  const segments = useSegments();

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
      const ego = useSessionStore.getState().getEgo();
      if (ego) {
        useSessionStore.getState().clearEgo();
      }
      
      // Redirect to login if not already there
      if (!inAuthGroup) {
        router.replace('/(auth)/login');
      }
    } else {
      // AUTHENTICATED: Only guard tabs access (security check)
      // If they somehow get to tabs without a profile, redirect to onboarding
      if (inTabsGroup) {
        const ego = useSessionStore.getState().getEgo();
        const currentUserId = session.user.id;
        const egoId = ego?.id;
        const isEgoForCurrentUser = ego?.linkedAuthUserId === currentUserId;
        const hasValidProfile = !!ego && isEgoForCurrentUser;
        
        if (!hasValidProfile) {
          // Trying to access tabs without valid profile - redirect to onboarding
          useSessionStore.getState().clearEgo();
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

  return <>{children}</>;
}
