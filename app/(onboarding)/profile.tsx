/**
 * Profile Setup Screen (Onboarding Step 2)
 * 
 * User fills out their profile information.
 * Reuses ProfileFormFields component for consistency.
 */

import { useState } from 'react';
import { StyleSheet, View, Pressable, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/contexts/auth-context';
import { useFamilyTreeStore } from '@/stores/family-tree-store';
import { ProfileFormFields, ProfileFormData } from '@/components/family-tree/ProfileFormFields';

export default function ProfileSetupScreen() {
  const colorScheme = useColorScheme();
  const theme = colorScheme ?? 'light';
  const colors = Colors[theme];
  const router = useRouter();
  const { session } = useAuth();
  const initializeEgo = useFamilyTreeStore((state) => state.initializeEgo);
  const userId = session?.user?.id;
  const [formData, setFormData] = useState<ProfileFormData>({
    name: session?.user.name || '',
    bio: '',
    birthDate: '',
    gender: undefined,
    photoUrl: session?.user.photoUrl || undefined,
  });
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!formData.name.trim()) {
      Alert.alert('Required Field', 'Please enter your name');
      return;
    }

    setIsSaving(true);
    try {
      // Initialize ego with profile data
      initializeEgo(
        formData.name.trim(),
        formData.birthDate || undefined,
        formData.gender,
        userId // Link ego to current user
      );

      // Update ego with photo and bio if provided
      if (formData.photoUrl || formData.bio) {
        const updateEgo = useFamilyTreeStore.getState().updateEgo;
        updateEgo({
          photoUrl: formData.photoUrl,
          bio: formData.bio,
        });
      }

      // Move to next step
      router.push('/(onboarding)/location');
    } catch (error) {
      Alert.alert('Error', 'Failed to save profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const canContinue = formData.name.trim().length > 0;

  return (
    <ThemedView style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.icon }]}>
        <ThemedText type="defaultSemiBold" style={styles.headerTitle}>
          Set Up Your Profile
        </ThemedText>
        <ThemedText style={[styles.headerSubtitle, { color: colors.icon }]}>
          Step 1 of 2
        </ThemedText>
      </View>

      {/* Form */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <ProfileFormFields
          initialValues={formData}
          onChange={setFormData}
          showBio={true}
          nameRequired={true}
        />
      </ScrollView>

      {/* Footer */}
      <View style={[styles.footer, { borderTopColor: colors.icon }]}>
        <Pressable
          onPress={handleSave}
          disabled={!canContinue || isSaving}
          style={({ pressed }) => [
            styles.continueButton,
            {
              backgroundColor: canContinue 
                ? (theme === 'dark' ? 'rgba(255, 255, 255, 0.15)' : colors.tint)
                : colors.icon,
              borderWidth: canContinue && theme === 'dark' ? 1 : 0,
              borderColor: canContinue && theme === 'dark' ? 'rgba(255, 255, 255, 0.3)' : 'transparent',
              opacity: (!canContinue || isSaving || pressed) ? 0.6 : 1,
            },
          ]}
        >
          <ThemedText style={[styles.continueButtonText, { color: '#FFFFFF' }]}>
            {isSaving ? 'Saving...' : 'Continue'}
          </ThemedText>
          <MaterialIcons name="arrow-forward" size={20} color="#FFFFFF" />
        </Pressable>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 24,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 100,
  },
  footer: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderTopWidth: 1,
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 8,
    gap: 8,
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '600',
    // Color is set inline to ensure white text on colored background
  },
});

