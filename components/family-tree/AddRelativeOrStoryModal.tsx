import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { Person } from '@/types/family-tree';

interface AddRelativeOrStoryModalProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** Person whose card triggered this modal */
  person: Person;
  /** Callback when modal should close */
  onClose: () => void;
  /** Callback when "Add Relative" is selected */
  onAddRelative: () => void;
  /** Callback when "Add Story" is selected */
  onAddStory: () => void;
}

/**
 * Modal for choosing between "Add Relative" or "Add Story"
 * 
 * This appears when the + button is pressed on a person's card.
 * - "Add Relative" → Opens form to add parent/spouse/child
 * - "Add Story" → Opens form to add a story/update to this person's profile
 */
export function AddRelativeOrStoryModal({
  visible,
  person,
  onClose,
  onAddRelative,
  onAddStory,
}: AddRelativeOrStoryModalProps) {
  const colorScheme = useColorScheme();
  const theme = colorScheme ?? 'light';
  const colors = Colors[theme];

  const handleAddRelative = () => {
    onAddRelative();
    // Don't close here - let the parent handle closing to avoid race condition
    // onClose();
  };

  const handleAddStory = () => {
    onAddStory();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={[styles.modal, { backgroundColor: colors.background, borderColor: colors.icon }]}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <View style={styles.header}>
            <ThemedText type="defaultSemiBold" style={styles.headerTitle}>
              Add to {person.name}'s Tree
            </ThemedText>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <MaterialIcons name="close" size={24} color={colors.text} />
            </Pressable>
          </View>

          {/* Options */}
          <View style={styles.options}>
            <Pressable
              onPress={handleAddRelative}
              style={({ pressed }) => [
                styles.option,
                { borderColor: colors.icon },
                pressed && styles.optionPressed,
              ]}
            >
              <View style={styles.optionIcon}>
                <MaterialIcons name="people" size={32} color={colors.tint} />
              </View>
              <ThemedText type="defaultSemiBold" style={styles.optionTitle}>
                Add Relative
              </ThemedText>
              <ThemedText style={[styles.optionDescription, { color: colors.icon }]}>
                Add a parent, spouse, or child
              </ThemedText>
            </Pressable>

            <Pressable
              onPress={handleAddStory}
              style={({ pressed }) => [
                styles.option,
                { borderColor: colors.icon },
                pressed && styles.optionPressed,
              ]}
            >
              <View style={styles.optionIcon}>
                <MaterialIcons name="photo-library" size={32} color={colors.tint} />
              </View>
              <ThemedText type="defaultSemiBold" style={styles.optionTitle}>
                Add Story
              </ThemedText>
              <ThemedText style={[styles.optionDescription, { color: colors.icon }]}>
                Add a photo or memory to their timeline
              </ThemedText>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modal: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  headerTitle: {
    fontSize: 20,
    flex: 1,
  },
  closeButton: {
    padding: 4,
  },
  options: {
    padding: 20,
    gap: 16,
  },
  option: {
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  optionPressed: {
    opacity: 0.7,
  },
  optionIcon: {
    marginBottom: 12,
  },
  optionTitle: {
    fontSize: 18,
    marginBottom: 8,
  },
  optionDescription: {
    fontSize: 14,
    textAlign: 'center',
  },
});

