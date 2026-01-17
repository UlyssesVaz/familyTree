import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface HamburgerMenuButtonProps {
  style?: any;
}

export function HamburgerMenuButton({ style }: HamburgerMenuButtonProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const theme = colorScheme ?? 'light';
  const colors = Colors[theme];

  return (
    <Pressable
      onPress={() => router.push('/settings')}
      style={({ pressed }) => [
        styles.menuButton,
        {
          top: insets.top + 8,
        },
        style,
        pressed && styles.menuButtonPressed,
      ]}
    >
      <MaterialIcons name="menu" size={24} color={colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  menuButton: {
    position: 'absolute',
    right: 16,
    zIndex: 1000,
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'transparent',
  },
  menuButtonPressed: {
    opacity: 0.6,
  },
});
