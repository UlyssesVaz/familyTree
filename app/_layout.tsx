// required for Supabase in React Native
import 'react-native-url-polyfill/auto';

// Polyfill for crypto.getRandomValues() - only needed on native platforms
// Web has crypto.getRandomValues() built-in, so we only import on native
import { Platform } from 'react-native';
if (Platform.OS !== 'web') {
  require('react-native-get-random-values');
}

import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';

import { ColorSchemeProvider, useColorSchemeContext } from '@/contexts/color-scheme-context';
import { AuthProvider } from '@/contexts/auth-context';
import { ErrorProvider } from '@/contexts/error-context';
import { ModalProvider } from '@/contexts/modal-context';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { StatsigProvider } from '@/components/StatsigProvider';
import { useStatsigClient } from '@statsig/expo-bindings';

// Supabase will be initialized when auth service is first used
// No initialization needed here - Supabase client initializes lazily

// No default route - let routing guard handle navigation

function RootLayoutNav() {
  const { colorScheme } = useColorSchemeContext();
  const { client: statsigClient } = useStatsigClient();
  const appState = useRef(AppState.currentState);

  // Monitor AppState for session tracking
  // Statsig automatically calculates session duration based on events
  // We just need to ensure events are logged so Statsig can track sessions
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        // App came to foreground - session continues
        if (statsigClient && __DEV__) {
          console.log('[Statsig] App came to foreground - session continues');
        }
      } else if (appState.current === 'active' && nextAppState.match(/inactive|background/)) {
        // App went to background
        // Statsig automatically handles session duration based on events
        // We don't need to manually log "app closed" - Statsig calculates it
        if (statsigClient && __DEV__) {
          console.log('[Statsig] App went to background - session will end when app closes');
        }
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [statsigClient]);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(onboarding)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        <Stack.Screen name="person/[personId]" options={{ presentation: 'modal', headerShown: false }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ErrorBoundary>
          <ColorSchemeProvider>
            <ErrorProvider>
              <ModalProvider>
                {/* PRO APPROACH: Statsig starts immediately as guest, above AuthProvider */}
                {/* This ensures Statsig is ready to catch telemetry from AuthProvider itself */}
                <StatsigProvider>
                  <AuthProvider>
                    <RootLayoutNav />
                  </AuthProvider>
                </StatsigProvider>
              </ModalProvider>
            </ErrorProvider>
          </ColorSchemeProvider>
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
