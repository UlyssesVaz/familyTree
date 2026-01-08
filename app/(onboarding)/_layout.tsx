/**
 * Onboarding Layout
 * 
 * Layout for onboarding screens (welcome, profile, location)
 */

import { Stack } from 'expo-router';

export default function OnboardingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="welcome" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="location" />
    </Stack>
  );
}

