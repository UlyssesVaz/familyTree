/**
 * Auth Layout
 * 
 * Layout for authentication screens (login, signup, etc.)
 */

import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="callback" />
      <Stack.Screen name="coppa-blocked" />
    </Stack>
  );
}

