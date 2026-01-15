import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface SettingsSectionProps {
  title?: string;
  children: React.ReactNode;
}

export function SettingsSection({ title, children }: SettingsSectionProps) {
  const colorScheme = useColorScheme();
  const theme = colorScheme ?? 'light';
  const colors = Colors[theme];

  return (
    <ThemedView style={styles.section}>
      {title && (
        <ThemedText type="defaultSemiBold" style={[styles.sectionTitle, { color: colors.icon }]}>
          {title}
        </ThemedText>
      )}
      <View style={styles.sectionContent}>
        {children}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  sectionContent: {
    borderRadius: 0,
  },
});
