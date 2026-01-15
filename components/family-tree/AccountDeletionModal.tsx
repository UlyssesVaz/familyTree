/**
 * Account Deletion Modal
 * 
 * Allows users to delete their account with two options:
 * 1. Delete Profile - Remove all photos/stories, delete PII within 30 days, convert to shadow profile with name only
 * 2. Deactivate Profile - Keep photos/stories, remove PII within a year
 */

import React, { useState } from 'react';
import { Modal, View, Pressable, StyleSheet, Alert, Text } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export type DeletionOption = 'delete_profile' | 'deactivate_profile';

interface AccountDeletionModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (option: DeletionOption) => void;
}

export function AccountDeletionModal({
  visible,
  onClose,
  onConfirm,
}: AccountDeletionModalProps) {
  const colorScheme = useColorScheme();
  const theme = colorScheme ?? 'light';
  const colors = Colors[theme];
  const [selectedOption, setSelectedOption] = useState<DeletionOption | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);

  const handleConfirm = () => {
    if (!selectedOption) {
      Alert.alert('Please Select an Option', 'Choose how you want to delete your account.');
      return;
    }

    setIsConfirming(true);
    
    // Show final confirmation based on option
    const title = selectedOption === 'delete_profile' 
      ? 'Delete Profile?'
      : 'Deactivate Profile?';
    
    const message = selectedOption === 'delete_profile'
      ? 'Your account will be closed and your photos deleted, but your name will remain in the tree to preserve your family\'s history. Your account information will be deleted within 30 days.'
      : 'Your account information will be removed within a year, but your photos and stories will remain in the family tree.';

    Alert.alert(
      title,
      message,
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => setIsConfirming(false),
        },
        {
          text: 'Confirm',
          style: 'destructive',
          onPress: () => {
            onConfirm(selectedOption);
            setIsConfirming(false);
            setSelectedOption(null);
            onClose();
          },
        },
      ]
    );
  };

  const handleClose = () => {
    setSelectedOption(null);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <ThemedView style={[styles.modal, { backgroundColor: colors.background }]}>
          {/* Header */}
          <View style={styles.header}>
            <ThemedText type="defaultSemiBold" style={styles.title}>
              Delete Account
            </ThemedText>
            <Pressable onPress={handleClose} style={styles.closeButton}>
              <MaterialIcons name="close" size={24} color={colors.icon} />
            </Pressable>
          </View>

          {/* Description */}
          <ThemedText style={[styles.description, { color: colors.icon }]}>
            Choose how you want to delete your account:
          </ThemedText>

          {/* Option 1: Deactivate Profile */}
          <Pressable
            onPress={() => setSelectedOption('deactivate_profile')}
            style={[
              styles.option,
              { 
                borderColor: selectedOption === 'deactivate_profile' ? colors.tint : colors.icon,
                backgroundColor: selectedOption === 'deactivate_profile' ? colors.tint + '20' : 'transparent',
              },
            ]}
          >
            <View style={styles.optionHeader}>
              <MaterialIcons 
                name={selectedOption === 'deactivate_profile' ? 'radio-button-checked' : 'radio-button-unchecked'} 
                size={24} 
                color={selectedOption === 'deactivate_profile' ? colors.tint : colors.icon} 
              />
              <ThemedText type="defaultSemiBold" style={[styles.optionTitle, { color: colors.tint }]}>
                Deactivate Profile
              </ThemedText>
            </View>
            <ThemedText style={[styles.optionDescription, { color: colors.icon }]}>
              Keep contributed photos and stories up. Only Account info is removed within a year.
            </ThemedText>
          </Pressable>

          {/* Option 2: Delete Profile */}
          <Pressable
            onPress={() => setSelectedOption('delete_profile')}
            style={[
              styles.option,
              { 
                borderColor: selectedOption === 'delete_profile' ? '#FF3B30' : colors.icon,
                backgroundColor: selectedOption === 'delete_profile' ? '#FF3B3020' : 'transparent',
              },
            ]}
          >
            <View style={styles.optionHeader}>
              <MaterialIcons 
                name={selectedOption === 'delete_profile' ? 'radio-button-checked' : 'radio-button-unchecked'} 
                size={24} 
                color={selectedOption === 'delete_profile' ? '#FF3B30' : colors.icon} 
              />
              <ThemedText type="defaultSemiBold" style={[styles.optionTitle, { color: '#FF3B30' }]}>
                Delete Profile
              </ThemedText>
            </View>
            <ThemedText style={[styles.optionDescription, { color: colors.icon }]}>
              Remove all photos and stories contributed to the family tree. Your Account information will also be deleted within 30 days.
            </ThemedText>
            <ThemedText style={[styles.optionWarning, { color: '#FF3B30' }]}>
              Your account will be closed and your photos deleted, but your name will remain in the tree to preserve your family's history.
            </ThemedText>
          </Pressable>

          {/* Actions */}
          <View style={styles.actions}>
            <Pressable
              onPress={handleClose}
              style={[styles.button, styles.cancelButton, { borderColor: colors.icon }]}
            >
              <ThemedText style={styles.cancelButtonText}>Cancel</ThemedText>
            </Pressable>
            <Pressable
              onPress={handleConfirm}
              disabled={!selectedOption || isConfirming}
              style={[
                styles.button,
                styles.confirmButton,
                { 
                  // Use fixed colors that work in both light and dark modes
                  backgroundColor: selectedOption === 'delete_profile' ? '#FF3B30' : '#0a7ea4', // Light blue for deactivate (works in both themes)
                  opacity: selectedOption && !isConfirming ? 1 : 0.5,
                },
              ]}
            >
              <Text style={styles.confirmButtonText}>
                {isConfirming ? 'Processing...' : 'Continue'}
              </Text>
            </Pressable>
          </View>
        </ThemedView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modal: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
  },
  closeButton: {
    padding: 4,
  },
  description: {
    fontSize: 14,
    marginBottom: 20,
    opacity: 0.7,
  },
  option: {
    borderWidth: 2,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  optionTitle: {
    fontSize: 18,
  },
  optionDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginLeft: 36,
    marginBottom: 8,
    opacity: 0.8,
  },
  optionWarning: {
    fontSize: 12,
    marginLeft: 36,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    borderWidth: 1,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButton: {
    // backgroundColor set inline
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF', // Always white for visibility on colored backgrounds
  },
});
