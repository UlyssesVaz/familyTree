/**
 * Profile Setup Screen (Onboarding Step 2)
 * 
 * User fills out their profile information.
 * Reuses ProfileFormFields component for consistency.
 */

import { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Pressable, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/contexts/auth-context';
import { ProfileFormFields, ProfileFormData } from '@/components/family-tree/ProfileFormFields';
import { COPPAViolationError } from '@/services/supabase/people-api';
import { useCreateEgoProfile } from '@/hooks/use-people';
import { calculateAge, isAtLeast13 } from '@/utils/age-utils';
import { isCOPPABlocked } from '@/utils/coppa-utils';

const PRIVACY_CONSENT_STORAGE_KEY = '@familytree:privacy_consent';

export default function ProfileSetupScreen() {
  const colorScheme = useColorScheme();
  const theme = colorScheme ?? 'light';
  const colors = Colors[theme];
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user?.id;
  const createEgoMutation = useCreateEgoProfile();
  const [formData, setFormData] = useState<ProfileFormData>({
    name: session?.user.name || '',
    bio: '',
    birthDate: '',
    gender: undefined,
    photoUrl: session?.user.photoUrl || undefined,
  });
  const [isSaving, setIsSaving] = useState(false);

  // COPPA Compliance: Check if user is blocked on component mount
  // Use ref to prevent duplicate checks (race condition prevention)
  const [isCheckingCOPPA, setIsCheckingCOPPA] = useState(true);
  const coppaCheckRef = useRef<Promise<boolean> | null>(null);

  useEffect(() => {
    const checkCOPPA = async () => {
      if (!userId || coppaCheckRef.current) {
        return;
      }

      const checkPromise = isCOPPABlocked(userId);
      coppaCheckRef.current = checkPromise;

      try {
        const isBlocked = await checkPromise;
        if (isBlocked) {
          // User is COPPA-blocked - redirect immediately
          router.replace('/(auth)/coppa-blocked');
          return;
        }
      } catch (error) {
        console.error('[ProfileSetup] Error checking COPPA status:', error);
        // Continue if check fails (fail open)
      } finally {
        setIsCheckingCOPPA(false);
      }
    };

    checkCOPPA();
  }, [userId, router]);

  const handleSave = async () => {
    if (!formData.name.trim()) {
      Alert.alert('Required Field', 'Please enter your name');
      return;
    }

    // COPPA Compliance: Require birth date and validate age >= 13
    if (!formData.birthDate) {
      Alert.alert('Birth Date Required', 'Please enter your date of birth to continue.');
      return;
    }

    // Validate age (must be at least 13 years old)
    const age = calculateAge(formData.birthDate);
    if (age === null) {
      Alert.alert('Invalid Date', 'Please enter a valid date of birth.');
      return;
    }

    if (!isAtLeast13(formData.birthDate)) {
      Alert.alert(
        'Age Requirement',
        'You must be at least 13 years old to create an account. If you made a mistake, please contact support.',
        [{ text: 'OK' }]
      );
      return;
    }

    if (!userId) {
      Alert.alert('Error', 'User not authenticated. Please sign in again.');
      return;
    }

    setIsSaving(true);
    try {
      // Retrieve privacy consent timestamp from AsyncStorage (set during age gate)
      const privacyConsent = await AsyncStorage.getItem(PRIVACY_CONSENT_STORAGE_KEY);
      const privacyPolicyAcceptedAt = privacyConsent === 'true' ? new Date().toISOString() : undefined;

      // Use React Query mutation (automatically handles cache update)
      // The API will check COPPA status again as a safety measure (RLS trigger)
      await createEgoMutation.mutateAsync({
        userId,
        name: formData.name.trim(),
        birthDate: formData.birthDate, // Required - validated above
        gender: formData.gender,
        photoUrl: formData.photoUrl,
        bio: formData.bio,
        privacyPolicyAcceptedAt, // Store privacy policy acceptance timestamp
      });
      
      // Cache is already updated by onSuccess callback in the mutation
      // Navigate immediately - data is ready in React Query cache
      router.push('/(onboarding)/location');
    } catch (error: any) {
      console.error('[ProfileSetup] Error creating profile:', error);
      
      // COPPA Compliance: Handle COPPA violation errors specially
      if (error instanceof COPPAViolationError) {
        // Redirect to COPPA blocked screen
        router.replace('/(auth)/coppa-blocked');
        return;
      }
      
      Alert.alert(
        'Error',
        error.message || 'Failed to save profile. Please try again.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Require name and birth date (COPPA compliance)
  const canContinue = formData.name.trim().length > 0 && !!formData.birthDate;

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
          disabled={!canContinue || isSaving || isCheckingCOPPA}
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
            {isCheckingCOPPA ? 'Checking...' : (isSaving ? 'Saving...' : 'Continue')}
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

