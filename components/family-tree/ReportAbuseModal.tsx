/**
 * Report Abuse Modal
 * 
 * Allows users to report inappropriate content, profiles, or users.
 * Supports reporting updates, profiles, shadow profiles, and users.
 */

import React, { useState } from 'react';
import { Modal, View, Pressable, StyleSheet, TextInput, ScrollView, Text } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export type ReportType = 'update' | 'profile' | 'shadow_profile' | 'user';
export type ReportReason = 
  | 'inappropriate_content' 
  | 'harassment' 
  | 'spam' 
  | 'incorrect_info' 
  | 'unauthorized_profile' 
  | 'impersonation'
  | 'other';

interface ReportAbuseModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (reason: ReportReason, description?: string) => void;
  reportType: ReportType;
  targetId: string; // ID of the item being reported
  targetName?: string; // Optional name for display
}

const REPORT_REASONS: Record<ReportType, { value: ReportReason; label: string }[]> = {
  update: [
    { value: 'inappropriate_content', label: 'Inappropriate Content' },
    { value: 'harassment', label: 'Harassment' },
    { value: 'spam', label: 'Spam' },
    { value: 'incorrect_info', label: 'Incorrect Information' },
    { value: 'other', label: 'Other' },
  ],
  profile: [
    { value: 'incorrect_info', label: 'Incorrect Information' },
    { value: 'impersonation', label: 'Impersonation' },
    { value: 'unauthorized_profile', label: 'Unauthorized Profile' },
    { value: 'harassment', label: 'Harassment' },
    { value: 'other', label: 'Other' },
  ],
  shadow_profile: [
    { value: 'unauthorized_profile', label: 'Created Without Consent' },
    { value: 'incorrect_info', label: 'Incorrect Information' },
    { value: 'impersonation', label: 'Impersonation' },
    { value: 'other', label: 'Other' },
  ],
  user: [
    { value: 'harassment', label: 'Harassment' },
    { value: 'spam', label: 'Spam' },
    { value: 'other', label: 'Other' },
  ],
};

export function ReportAbuseModal({
  visible,
  onClose,
  onSubmit,
  reportType,
  targetId,
  targetName,
}: ReportAbuseModalProps) {
  const colorScheme = useColorScheme();
  const theme = colorScheme ?? 'light';
  const colors = Colors[theme];
  const [selectedReason, setSelectedReason] = useState<ReportReason | null>(null);
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const reasons = REPORT_REASONS[reportType];

  const handleSubmit = () => {
    if (!selectedReason) {
      return;
    }

    setIsSubmitting(true);
    onSubmit(selectedReason, description.trim() || undefined);
    
    // Reset form
    setTimeout(() => {
      setSelectedReason(null);
      setDescription('');
      setIsSubmitting(false);
      onClose();
    }, 500);
  };

  const handleClose = () => {
    setSelectedReason(null);
    setDescription('');
    onClose();
  };

  const getReportTypeLabel = () => {
    switch (reportType) {
      case 'update':
        return 'Post';
      case 'profile':
        return 'Profile';
      case 'shadow_profile':
        return 'Shadow Profile';
      case 'user':
        return 'User';
      default:
        return 'Content';
    }
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
              Report {getReportTypeLabel()}
            </ThemedText>
            <Pressable onPress={handleClose} style={styles.closeButton}>
              <MaterialIcons name="close" size={24} color={colors.icon} />
            </Pressable>
          </View>

          {/* Description */}
          <ThemedText style={[styles.description, { color: colors.icon }]}>
            Help us keep the family tree safe. Why are you reporting this {getReportTypeLabel().toLowerCase()}?
          </ThemedText>

          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            {/* Reason Selection */}
            <View style={styles.reasonsContainer}>
              {reasons.map((reason) => (
                <Pressable
                  key={reason.value}
                  onPress={() => setSelectedReason(reason.value)}
                  style={[
                    styles.reasonOption,
                    {
                      borderColor: selectedReason === reason.value ? colors.tint : colors.icon,
                      backgroundColor: selectedReason === reason.value ? colors.tint + '20' : 'transparent',
                    },
                  ]}
                >
                  <MaterialIcons
                    name={selectedReason === reason.value ? 'check-circle' : 'radio-button-unchecked'}
                    size={20}
                    color={selectedReason === reason.value ? colors.tint : colors.icon}
                  />
                  <ThemedText style={styles.reasonLabel}>{reason.label}</ThemedText>
                </Pressable>
              ))}
            </View>

            {/* Optional Description */}
            <View style={styles.descriptionContainer}>
              <ThemedText style={[styles.descriptionLabel, { color: colors.icon }]}>
                Additional Details (Optional)
              </ThemedText>
              <TextInput
                style={[
                  styles.descriptionInput,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.icon,
                    color: colors.text,
                  },
                ]}
                placeholder="Provide more information about this report..."
                placeholderTextColor={colors.icon}
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>
          </ScrollView>

          {/* Actions */}
          <View style={styles.actions}>
            <Pressable
              onPress={handleClose}
              style={[styles.button, styles.cancelButton, { borderColor: colors.icon }]}
            >
              <ThemedText style={styles.cancelButtonText}>Cancel</ThemedText>
            </Pressable>
            <Pressable
              onPress={handleSubmit}
              disabled={!selectedReason || isSubmitting}
              style={[
                styles.button,
                styles.submitButton,
                {
                  backgroundColor: '#0a7ea4', // Fixed color that works in both light and dark modes
                  opacity: selectedReason && !isSubmitting ? 1 : 0.5,
                },
              ]}
            >
              <Text style={styles.submitButtonText}>
                {isSubmitting ? 'Submitting...' : 'Submit Report'}
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
    maxHeight: '85%',
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
  scrollView: {
    maxHeight: 400,
  },
  reasonsContainer: {
    gap: 8,
    marginBottom: 20,
  },
  reasonOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
  },
  reasonLabel: {
    fontSize: 16,
  },
  descriptionContainer: {
    marginBottom: 20,
  },
  descriptionLabel: {
    fontSize: 14,
    marginBottom: 8,
    opacity: 0.7,
  },
  descriptionInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    minHeight: 100,
    textAlignVertical: 'top',
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
  submitButton: {
    // backgroundColor set inline
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF', // Always white for visibility on colored backgrounds
  },
});
