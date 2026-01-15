import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface SettingsItemProps {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  onPress: () => void;
  rightElement?: React.ReactNode;
  destructive?: boolean;
  iconColor?: string;
}

export function SettingsItem({
  icon,
  label,
  onPress,
  rightElement,
  destructive = false,
  iconColor,
}: SettingsItemProps) {
  const colorScheme = useColorScheme();
  const theme = colorScheme ?? 'light';
  const colors = Colors[theme];
  
  const finalIconColor = iconColor || (destructive ? '#FF3B30' : colors.icon);
  const textColor = destructive ? '#FF3B30' : colors.text;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.item,
        pressed && styles.itemPressed,
      ]}
    >
      <View style={styles.itemContent}>
        <MaterialIcons name={icon} size={22} color={finalIconColor} style={styles.icon} />
        <ThemedText style={[styles.label, { color: textColor }]}>
          {label}
        </ThemedText>
        {rightElement || (
          <MaterialIcons 
            name="chevron-right" 
            size={20} 
            color={colors.icon} 
            style={styles.chevron}
          />
        )}
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
  chevron: {
    marginLeft: 8,
  },
});
