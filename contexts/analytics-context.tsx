/**
 * Analytics Context
 * 
 * Handles Statsig user identity synchronization with authentication state.
 * Separated from AuthContext to follow separation of concerns.
 * 
 * IMPORTANT: Statsig only tracks the authenticated user (ego), NOT family tree Person profiles.
 * The authenticated user is the person who signed in via Google SSO (session.user.id).
 * Family tree Person profiles are separate entities and should NOT be tracked by Statsig.
 */

import React, { useEffect, useRef } from 'react';
import { useStatsigClient } from '@statsig/expo-bindings';
import { AuthSession } from '@/services/auth/types';
import { getAuthService } from '@/services/auth';

interface AnalyticsContextType {
  // No public API needed - this context only handles background sync
}

const AnalyticsContext = React.createContext<AnalyticsContextType | undefined>(undefined);

/**
 * Analytics Provider Component
 * 
 * Subscribes to auth state changes and syncs Statsig user identity.
 * StatsigProvider must be above this in the component tree.
 */
export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const { client: statsigClient } = useStatsigClient();
  const previousUserIdRef = useRef<string | null>(null); // Track previous user ID to prevent duplicate updates
  const previousSessionRef = useRef<AuthSession | null>(null); // Track previous session to detect logout
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let mounted = true;

    // Subscribe to auth state changes
    unsubscribeRef.current = getAuthService().onAuthStateChanged(async (newSession: AuthSession | null) => {
      if (!mounted) return;

      const newUserId = newSession?.user?.id || null;
      const previousUserId = previousUserIdRef.current;
      const hadSession = previousSessionRef.current !== null;
      const hasSession = newSession !== null;

      // Update refs
      previousUserIdRef.current = newUserId;
      previousSessionRef.current = newSession;

      // Sync Statsig identity when session changes
      // StatsigProvider is above AnalyticsProvider, so Statsig is always initialized
      try {
        if (newSession?.user && statsigClient) {
          // Only update if user ID actually changed (prevents duplicate updates)
          if (newUserId !== previousUserId) {
            // PROMOTE guest to real user
            await statsigClient.updateUserAsync({
              userID: newSession.user.id,
              email: newSession.user.email ?? undefined,
            });
            
            if (__DEV__) {
              console.log('[AnalyticsContext] Promoted Statsig user to authenticated');
            }
            
            // Log sign-in event immediately after user update
            statsigClient.logEvent('user_signs_in', 'google', {
              timestamp: new Date().toISOString(),
            });
            
            // CRITICAL: Force flush to ensure event is sent immediately
            // This is important for sign-in events that we want to track right away
            await statsigClient.flush();
            
            if (__DEV__) {
              console.log('[AnalyticsContext] Logged user_signs_in event to Statsig and flushed');
            }
          }
        } else if (!newSession && statsigClient && hadSession) {
          // Only log logout if we had a session before (detect actual logout, not initial state)
          // Log logout event BEFORE demoting to guest
          try {
            statsigClient.logEvent('logout');
            await statsigClient.flush();
            if (__DEV__) {
              console.log('[AnalyticsContext] Logged logout event to Statsig');
            }
          } catch (logoutError: any) {
            if (__DEV__) {
              console.warn('[AnalyticsContext] Could not log logout event:', logoutError);
            }
          }

          // DEMOTE back to guest on logout
          await statsigClient.updateUserAsync({ userID: '' });
          
          if (__DEV__) {
            console.log('[AnalyticsContext] Demoted Statsig user to guest');
          }
        }
      } catch (statsigError: any) {
        // Statsig error - log but don't block auth flow
        if (__DEV__) {
          console.warn('[AnalyticsContext] Could not update Statsig user:', statsigError);
        }
      }
    });

    return () => {
      mounted = false;
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [statsigClient]);

  return (
    <AnalyticsContext.Provider value={{}}>
      {children}
    </AnalyticsContext.Provider>
  );
}

/**
 * Hook to access analytics context
 * Currently only used internally for logout event tracking
 */
export function useAnalytics(): AnalyticsContextType {
  const context = React.useContext(AnalyticsContext);
  if (context === undefined) {
    throw new Error('useAnalytics must be used within AnalyticsProvider');
  }
  return context;
}
