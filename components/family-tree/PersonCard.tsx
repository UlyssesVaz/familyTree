import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getGenderColor } from '@/utils/gender-utils';
import { formatDateRange } from '@/utils/date-utils';
import type { Person } from '@/types/family-tree';

interface PersonCardProps {
  /** Person data to display */
  person: Person;
  /** Optional: Custom card width */
  width?: number;
  /** Optional: Callback when card is pressed */
  onPress?: () => void;
  /** Optional: Callback when + button is pressed */
  onAddPress?: () => void;
  /** Optional: Show + button (default: false) */
  showAddButton?: boolean;
}

/**
 * PersonCard Component
 * 
 * FamilySearch-style card for displaying a person in the family tree.
 * Features:
 * - Circular photo placeholder (or gender silhouette)
 * - Prominent name display
 * - Birth/Death dates
 * - Gender indicator (blue for male, orange for female)
 * - Pressable (if onPress is provided)
 */
export function PersonCard({ person, width = 200, onPress, onAddPress, showAddButton = false }: PersonCardProps) {
  const colorScheme = useColorScheme();
  const theme = colorScheme ?? 'light';
  const colors = Colors[theme];

  const genderColor = getGenderColor(person.gender, colors.icon);
  const dateRange = formatDateRange(person.birthDate, person.deathDate);

  const cardContent = (
    <>
      {/* + Button (top-right corner) */}
      {showAddButton && onAddPress && (
        <Pressable
          onPress={(e) => {
            e.stopPropagation(); // Prevent card press
            onAddPress();
          }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} // Increase tap target area
          style={({ pressed }) => [
            styles.addButton,
            { 
              backgroundColor: colors.tint,
              // Better visibility in dark mode - add border/glow
              borderWidth: theme === 'dark' ? 2 : 0,
              borderColor: theme === 'dark' ? '#FFFFFF' : 'transparent',
            },
            pressed && styles.addButtonPressed,
          ]}
        >
          <MaterialIcons 
            name="add" 
            size={20} 
            color={theme === 'dark' ? '#000000' : '#FFFFFF'} // Dark icon in dark mode for contrast
          />
        </Pressable>
      )}

      {/* Photo or Gender Silhouette */}
      <View style={styles.photoContainer}>
        {person.photoUrl ? (
          <Image
            source={{ uri: person.photoUrl }}
            style={[styles.photo, { borderColor: genderColor }]}
            contentFit="cover"
          />
        ) : (
          <View style={[styles.photoPlaceholder, { backgroundColor: genderColor }]}>
            <MaterialIcons
              name="person"
              size={width * 0.4}
              color="#FFFFFF"
            />
          </View>
        )}
      </View>

      {/* Name */}
      <ThemedText
        type="defaultSemiBold"
        style={[styles.name, { color: colors.text }]}
        numberOfLines={2}
      >
        {person.name}
      </ThemedText>

      {/* Date Range */}
      {dateRange && (
        <ThemedText
          style={[styles.dates, { color: colors.icon }]}
          numberOfLines={1}
        >
          {dateRange}
        </ThemedText>
      )}
    </>
  );

  const cardWrapper = (
    <ThemedView
      style={[
        styles.card,
        {
          width,
          backgroundColor: colors.background,
          borderColor: colors.icon,
        },
      ]}
    >
      {cardContent}
    </ThemedView>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
        {cardWrapper}
      </Pressable>
    );
  }

  return cardWrapper;
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3, // Android shadow
    position: 'relative', // For absolute positioning of + button
  },
  addButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 36, // Slightly larger for better visibility
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000, // Much higher z-index to ensure it's above everything
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.4, // More visible shadow
    shadowRadius: 4,
    elevation: 10, // Higher elevation for Android
  },
  addButtonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.95 }],
  },
  photoContainer: {
    marginBottom: 12,
  },
  photo: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
  },
  photoPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.8,
  },
  name: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 4,
  },
  dates: {
    fontSize: 14,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
});

