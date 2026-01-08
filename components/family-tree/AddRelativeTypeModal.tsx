import { Modal, Pressable, StyleSheet, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { Person } from '@/types/family-tree';

export type RelativeType = 'parent' | 'spouse' | 'child' | 'sibling';

interface AddRelativeTypeModalProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** Person to add relative to */
  person: Person;
  /** Callback when modal should close */
  onClose: () => void;
  /** Callback when a relative type is selected */
  onSelectType: (type: RelativeType) => void;
}

/**
 * Modal for selecting what type of relative to add (Parent, Spouse, or Child)
 */
export function AddRelativeTypeModal({
  visible,
  person,
  onClose,
  onSelectType,
}: AddRelativeTypeModalProps) {
  const colorScheme = useColorScheme();
  const theme = colorScheme ?? 'light';
  const colors = Colors[theme];

  const handleSelect = (type: RelativeType) => {
    // Don't call onClose here - let the parent handle closing after setting state
    // Calling onClose here causes selectedPerson to be cleared before AddPersonModal can render
    onSelectType(type);
    // The parent will close this modal after setting showAddPersonModal to true
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
              Add Relative to {person.name}
            </ThemedText>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <MaterialIcons name="close" size={24} color={colors.text} />
            </Pressable>
          </View>

          {/* Options */}
          <View style={styles.options}>
            <Pressable
              onPress={() => handleSelect('parent')}
              style={({ pressed }) => [
                styles.option,
                { borderColor: colors.icon },
                pressed && styles.optionPressed,
              ]}
            >
              <View style={styles.optionIcon}>
                <MaterialIcons name="arrow-upward" size={32} color={colors.tint} />
              </View>
              <ThemedText type="defaultSemiBold" style={styles.optionTitle}>
                Add Parent
              </ThemedText>
              <ThemedText style={[styles.optionDescription, { color: colors.icon }]}>
                Add a parent above {person.name}
              </ThemedText>
            </Pressable>

            {/* Split Button: Spouse (Left) and Sibling (Right) */}
            <View style={[styles.splitButtonContainer, { borderColor: colors.icon }]}>
              <Pressable
                onPress={() => handleSelect('spouse')}
                style={({ pressed }) => [
                  styles.splitButtonLeft,
                  pressed && styles.optionPressed,
                ]}
              >
                <View style={styles.splitButtonIcon}>
                  <MaterialIcons name="favorite" size={24} color={colors.tint} />
                </View>
                <ThemedText type="defaultSemiBold" style={styles.splitButtonTitle}>
                  Add Spouse
                </ThemedText>
                <ThemedText style={[styles.splitButtonDescription, { color: colors.icon }]}>
                  Beside {person.name}
                </ThemedText>
              </Pressable>

              <View style={[styles.splitButtonDivider, { backgroundColor: colors.icon }]} />

              <Pressable
                onPress={() => handleSelect('sibling')}
                style={({ pressed }) => [
                  styles.splitButtonRight,
                  pressed && styles.optionPressed,
                ]}
              >
                <View style={styles.splitButtonIcon}>
                  <MaterialIcons name="people" size={24} color={colors.tint} />
                </View>
                <ThemedText type="defaultSemiBold" style={styles.splitButtonTitle}>
                  Add Sibling
                </ThemedText>
                <ThemedText style={[styles.splitButtonDescription, { color: colors.icon }]}>
                  Beside {person.name}
                </ThemedText>
              </Pressable>
            </View>

            <Pressable
              onPress={() => handleSelect('child')}
              style={({ pressed }) => [
                styles.option,
                { borderColor: colors.icon },
                pressed && styles.optionPressed,
              ]}
            >
              <View style={styles.optionIcon}>
                <MaterialIcons name="arrow-downward" size={32} color={colors.tint} />
              </View>
              <ThemedText type="defaultSemiBold" style={styles.optionTitle}>
                Add Child
              </ThemedText>
              <ThemedText style={[styles.optionDescription, { color: colors.icon }]}>
                Add a child below {person.name}
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
  splitButtonContainer: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    minHeight: 100, // Match approximate height of other options
  },
  splitButtonLeft: {
    flex: 1,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  splitButtonRight: {
    flex: 1,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  splitButtonDivider: {
    width: 1,
    opacity: 0.2,
  },
  splitButtonIcon: {
    marginBottom: 8,
  },
  splitButtonTitle: {
    fontSize: 16,
    marginBottom: 4,
  },
  splitButtonDescription: {
    fontSize: 12,
    textAlign: 'center',
  },
});

