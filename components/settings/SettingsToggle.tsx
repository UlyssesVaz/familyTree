import React from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface SettingsToggleProps {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  iconColor?: string;
}

export function SettingsToggle({
  icon,
  label,
  value,
  onValueChange,
  iconColor,
}: SettingsToggleProps) {
  const colorScheme = useColorScheme();
  const theme = colorScheme ?? 'light';
  const colors = Colors[theme];
  
  const finalIconColor = iconColor || colors.icon;

  return (
    <Pressable
      onPress={() => onValueChange(!value)}
      style={({ pressed }) => [
        styles.item,
        pressed && styles.itemPressed,
      ]}
    >
      <View style={styles.itemContent}>
        <MaterialIcons name={icon} size={22} color={finalIconColor} style={styles.icon} />
        <ThemedText style={[styles.label, { color: colors.text }]}>
          {label}
        </ThemedText>
        <Switch
          value={value}
          onValueChange={onValueChange}
          trackColor={{ false: colors.icon, true: colors.tint }}
          thumbColor={value ? '#fff' : '#f4f3f4'}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  item: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  itemPressed: {
    opacity: 0.6,
  },
  itemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: 12,
    width: 22,
  },
  label: {
    flex: 1,
    fontSize: 16,
  },
});
