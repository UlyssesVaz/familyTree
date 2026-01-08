// Polyfill for crypto.getRandomValues() - only needed on native platforms
// Web has crypto.getRandomValues() built-in, so we only import on native
import { Platform } from 'react-native';
if (Platform.OS !== 'web') {
  require('react-native-get-random-values');
}

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

// No default route - let routing guard handle navigation

function RootLayoutNav() {
  const { colorScheme } = useColorSchemeContext();

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
                <AuthProvider>
                  <RootLayoutNav />
                </AuthProvider>
              </ModalProvider>
            </ErrorProvider>
          </ColorSchemeProvider>
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
