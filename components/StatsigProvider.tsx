/**
 * Statsig Provider Component (Pro Approach)
 * 
 * PRO APPROACH: Decoupled from Auth loading state
 * - Starts immediately as guest user (empty string)
 * - No dependency on AuthProvider - Statsig is above AuthProvider in tree
 * - AuthProvider will call client.updateUserAsync() when session changes
 * - This prevents "Multiple Init" warnings from auth state flickering
 * 
 * IMPORTANT: Statsig only tracks the authenticated user (ego), NOT family tree Person profiles.
 * The authenticated user is the person who signed in via Google SSO (session.user.id).
 * Family tree Person profiles are separate entities and should NOT be tracked by Statsig.
 */

import React from 'react';
import { StatsigProviderExpo } from '@statsig/expo-bindings';

// Public SDK key - safe to hardcode (client SDK keys are designed for client apps)
const STATSIG_SDK_KEY = 'client-BylGtWDdgGdoubn9e4DIuj6gGfAQRoed3c08Y7sYv0z';

/**
 * Statsig Provider Component
 * 
 * Starts Statsig immediately as a guest user.
 * AuthProvider (child) will call client.updateUserAsync() when session changes.
 * This removes the "Initializing with user" loop and prevents multiple init warnings.
 */
export function StatsigProvider({ children }: { children: React.ReactNode }) {
  if (__DEV__) {
    console.log('[Statsig] Starting as guest user (AuthProvider will update identity)');
  }

  return (
    <StatsigProviderExpo
      sdkKey={STATSIG_SDK_KEY}
      user={{ userID: '' }} // Guest ID starts here - AuthProvider will promote to real user
      options={{
        // Set environment tier to match dashboard filter
        environment: { tier: __DEV__ ? 'development' : 'production' },
      }}
      // Use null so it doesn't block the RootLayout
      // Statsig initializes in background, AuthProvider handles identity sync
      loadingComponent={null}
    >
      {children}
    </StatsigProviderExpo>
  );
}
