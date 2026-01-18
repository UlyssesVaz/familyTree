/**
 * Statsig Provider Component (Pro Approach)
 * 
 * PRO APPROACH: Decoupled from Auth loading state
 * - Preloads AsyncStorage before Statsig initializes (prevents race condition)
 * - Starts immediately as guest user (empty string)
 * - No dependency on AuthProvider - Statsig is above AuthProvider in tree
 * - AuthProvider will call client.updateUserAsync() when session changes
 * - This prevents "Multiple Init" warnings from auth state flickering
 * 
 * IMPORTANT: Statsig only tracks the authenticated user (ego), NOT family tree Person profiles.
 * The authenticated user is the person who signed in via Google SSO (session.user.id).
 * Family tree Person profiles are separate entities and should NOT be tracked by Statsig.
 */

import React, { useEffect, useState } from 'react';
import { StatsigProviderExpo } from '@statsig/expo-bindings';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '@/utils/logger';

const statsigLogger = logger.withPrefix('Statsig');

// Public SDK key - safe to hardcode (client SDK keys are designed for client apps)
const STATSIG_SDK_KEY = 'client-BylGtWDdgGdoubn9e4DIuj6gGfAQRoed3c08Y7sYv0z';

/**
 * Statsig Provider Component
 * 
 * Preloads AsyncStorage, then starts Statsig as a guest user.
 * AuthProvider (child) will call client.updateUserAsync() when session changes.
 * This removes the "Initializing with user" loop and prevents multiple init warnings.
 */
export function StatsigProvider({ children }: { children: React.ReactNode }) {
  const [isPreloaded, setIsPreloaded] = useState(false);

  useEffect(() => {
    async function preloadStorage() {
      try {
        // Preload AsyncStorage before Statsig tries to use it
        // Do a dummy read/write to ensure AsyncStorage is initialized
        const testKey = '__statsig_preload_test__';
        await AsyncStorage.getItem(testKey);
        await AsyncStorage.setItem(testKey, '1');
        await AsyncStorage.removeItem(testKey);
        
        setIsPreloaded(true);
        statsigLogger.log('AsyncStorage preloaded, initializing Statsig');
      } catch (error) {
        // If preload fails, proceed anyway (Statsig will work but may show warning)
        statsigLogger.warn('Failed to preload AsyncStorage:', error);
        setIsPreloaded(true);
      }
    }

    preloadStorage();
  }, []);

  // Wait for AsyncStorage to be ready before initializing Statsig
  if (!isPreloaded) {
    return null; // Very brief delay (usually <50ms)
  }

  statsigLogger.log('Starting as guest user (AuthProvider will update identity)');

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
