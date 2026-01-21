/**
 * Birth Date Screen (Onboarding - After Profile Claim)
 * 
 * Collects birth date for users who claimed a profile via invitation.
 * Required for COPPA compliance.
 */

import { useState } from 'react';
import { StyleSheet, View, Pressable, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { DatePickerField } from '@/components/family-tree/DatePickerField';
import { calculateAge, isAtLeast13 } from '@/utils/age-utils';
import { useAuth } from '@/contexts/auth-context';
import { updateEgoProfile } from '@/services/supabase/people-api';
import { useSessionStore } from '@/stores/session-store';

export default function BirthDateScreen() {
  const colorScheme = useColorScheme();
  const theme = colorScheme ?? 'light';
  const colors = Colors[theme];
  const router = useRouter();
  const { session } = useAuth();
  const [birthDate, setBirthDate] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleContinue = async () => {
    // COPPA Compliance: Require birth date and validate age >= 13
    if (!birthDate) {
      Alert.alert('Required', 'Please enter your date of birth to continue.');
      return;
    }

    const age = calculateAge(birthDate);
    if (age === null) {
      Alert.alert('Invalid Date', 'Please enter a valid date of birth.');
      return;
    }

    if (!isAtLeast13(birthDate)) {
      Alert.alert(
        'Age Requirement',
        'You must be at least 13 years old to use this app. If you made a mistake, please contact support.',
        [{ text: 'OK' }]
      );
      return;
    }

    if (!session?.user?.id) {
      Alert.alert('Error', 'User not authenticated. Please sign in again.');
      return;
    }

    setIsSaving(true);
    try {
      // Get current ego from store
      const ego = useSessionStore.getState().getEgo();
      if (!ego) {
        throw new Error('No profile found');
      }

      // Update profile with birth date
      await updateEgoProfile(session.user.id, {
        birthDate,
      });

      // Update local store
      useSessionStore.getState().updateEgo({ birthDate });

      // Navigate to location or tabs
      router.replace('/(onboarding)/location');
    } catch (error: any) {
      console.error('[BirthDate] Error updating profile:', error);
      Alert.alert('Error', error.message || 'Failed to save birth date. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.icon }]}>
        <ThemedText type="defaultSemiBold" style={styles.headerTitle}>
          One More Thing...
        </ThemedText>
        <ThemedText style={[styles.headerSubtitle, { color: colors.icon }]}>
          We need your date of birth for age verification
        </ThemedText>
      </View>

      {/* Form */}
      <View style={styles.content}>
        <MaterialIcons name="cake" size={64} color={colors.tint} style={styles.icon} />
        
        <ThemedText style={styles.description}>
          To comply with child safety regulations (COPPA), we need to verify your age.
        </ThemedText>

        <DatePickerField
          label="Date of Birth"
          value={birthDate}
          onChange={setBirthDate}
        />

        <ThemedText style={[styles.helpText, { color: colors.icon }]}>
          Your birth date is private and won't be shared publicly.
        </ThemedText>
      </View>

      {/* Footer */}
      <View style={[styles.footer, { borderTopColor: colors.icon }]}>
        <Pressable
          onPress={handleContinue}
          disabled={!birthDate || isSaving}
          style={({ pressed }) => [
            styles.continueButton,
            {
              backgroundColor: birthDate 
                ? colors.tint
                : colors.icon,
              opacity: (!birthDate || isSaving || pressed) ? 0.6 : 1,
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
  content: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    marginBottom: 24,
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  helpText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 16,
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
  },
});
