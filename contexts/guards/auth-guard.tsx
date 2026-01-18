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
import { useEgo } from '@/hooks/use-session';

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
  const ego = useEgo();

  useEffect(() => {
    // Wait for auth check to complete before making routing decisions
    if (isLoading) {
      return;
    }

    const firstSegment = segments[0];
    const inAuthGroup = firstSegment === '(auth)';
    const inTabsGroup = firstSegment === '(tabs)';
    const inOnboardingGroup = firstSegment === '(onboarding)';

    if (!session) {
      // NOT AUTHENTICATED: Must go to age gate first (COPPA compliance)
      // Ego will be null automatically when not authenticated (React Query won't have data)
      
      // Redirect to age gate if not already in auth group (age gate will handle routing to login)
      // Age gate screen will check AsyncStorage and redirect to login if already passed
      if (!inAuthGroup) {
        router.replace('/(auth)/age-gate');
      }
    } else {
      // AUTHENTICATED: Only guard tabs access (security check)
      // If they somehow get to tabs without a profile, redirect to onboarding
      if (inTabsGroup) {
        const currentUserId = session.user.id;
        const isEgoForCurrentUser = ego?.linkedAuthUserId === currentUserId;
        const hasValidProfile = !!ego && isEgoForCurrentUser;
        
        if (!hasValidProfile) {
          // Trying to access tabs without valid profile - redirect to onboarding
          router.replace('/(onboarding)/welcome');
        }
      } else if (inAuthGroup) {
        // User is authenticated but still on login screen - profile check useEffect should handle navigation
        // Don't redirect here - let profile check useEffect handle it after checking profile
      }
      // Otherwise, let them navigate freely (onboarding flow, etc.)
    }
    // Only depend on session, isLoading, and ego - segments accessed inside effect to avoid constant re-runs
  }, [session, isLoading, ego, router]);

  return <>{children}</>;
}
