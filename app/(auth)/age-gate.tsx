/**
 * Age Gate Screen
 * 
 * COPPA Compliance: Age verification before login.
 * Blocks users under 13 from accessing the app.
 * 
 * Flow: Age Gate → Privacy Policy Consent → Login
 */

import { useState, useEffect } from 'react';
import { StyleSheet, View, Platform, Pressable, ScrollView, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/contexts/auth-context';
import { isAtLeast13 } from '@/utils/age-utils';
import { DatePickerField } from '@/components/family-tree/DatePickerField';

const AGE_GATE_STORAGE_KEY = '@familytree:age_gate_passed';
const BIRTH_DATE_STORAGE_KEY = '@familytree:birth_date';
const PRIVACY_CONSENT_STORAGE_KEY = '@familytree:privacy_consent';

export default function AgeGateScreen() {
  const colorScheme = useColorScheme();
  const theme = colorScheme ?? 'light';
  const colors = Colors[theme];
  const router = useRouter();
  const params = useLocalSearchParams<{ redirect?: string }>();
  const { session } = useAuth();
  const insets = useSafeAreaInsets();
  
  const [birthDate, setBirthDate] = useState<string>('');
  const [isEligible, setIsEligible] = useState<boolean | null>(null);
  const [hasConsent, setHasConsent] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // iOS best practice: Safe area top inset + additional padding
  const topPadding = Platform.OS === 'ios' ? Math.max(insets.top, 44) + 20 : insets.top + 20;
  const bottomPadding = Math.max(insets.bottom, 20);

  // Load stored age gate status on mount
  useEffect(() => {
    const loadStoredStatus = async () => {
      try {
        // If user is already authenticated, check if they have a redirect param
        // Otherwise, skip age gate and let ProfileContext handle routing
        if (session) {
          if (params.redirect) {
            router.replace(params.redirect as any);
          } else {
            router.replace('/(auth)/login');
          }
          return;
        }

        // Check if age gate already passed
        const ageGatePassed = await AsyncStorage.getItem(AGE_GATE_STORAGE_KEY);
        const storedBirthDate = await AsyncStorage.getItem(BIRTH_DATE_STORAGE_KEY);
        const storedConsent = await AsyncStorage.getItem(PRIVACY_CONSENT_STORAGE_KEY);

        if (ageGatePassed === 'true' && storedBirthDate && storedConsent === 'true') {
          // Age gate already passed - go to login (or redirect if provided)
          if (params.redirect) {
            router.replace(params.redirect as any);
          } else {
            router.replace('/(auth)/login');
          }
          return;
        }

        // Restore state if available
        if (storedBirthDate) {
          setBirthDate(storedBirthDate);
          checkAge(storedBirthDate);
        }

        if (storedConsent === 'true') {
          setHasConsent(true);
        }
      } catch (error) {
        console.error('[AgeGate] Error loading stored status:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadStoredStatus();
  }, [session, router, params.redirect]);

  const checkAge = (date: string) => {
    if (!date) {
      setIsEligible(null);
      return;
    }

    const eligible = isAtLeast13(date);
    setIsEligible(eligible);

    // Store birth date in AsyncStorage (for profile creation after login)
    AsyncStorage.setItem(BIRTH_DATE_STORAGE_KEY, date).catch((error) => {
      console.error('[AgeGate] Error storing birth date:', error);
    });
  };

  const handleBirthDateChange = (date: string) => {
    setBirthDate(date);
    checkAge(date);
  };

  const handleContinue = async () => {
    if (!isEligible) {
      Alert.alert(
        'Age Requirement',
        'You must be at least 13 years old to use FamilyTree. If you are under 13, please have a parent or guardian create an account.',
        [{ text: 'OK' }]
      );
      return;
    }

    if (!hasConsent) {
      Alert.alert(
        'Consent Required',
        'Please review and accept the Privacy Policy and Terms of Service to continue.',
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      // Mark age gate as passed
      await AsyncStorage.setItem(AGE_GATE_STORAGE_KEY, 'true');
      await AsyncStorage.setItem(PRIVACY_CONSENT_STORAGE_KEY, 'true');
      
      // Navigate to login (or redirect if provided, e.g., for join flow)
      if (params.redirect) {
        router.replace(params.redirect as any);
      } else {
        router.replace('/(auth)/login');
      }
    } catch (error) {
      console.error('[AgeGate] Error storing age gate status:', error);
      Alert.alert('Error', 'Failed to save your information. Please try again.');
    }
  };

  if (isLoading) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText>Loading...</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.topSpacer, { height: topPadding }]} />
      
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <View style={[styles.iconContainer, { backgroundColor: colors.icon + '20' }]}>
              <MaterialIcons name="cake" size={48} color={colors.tint} />
            </View>
            <ThemedText type="title" style={styles.title}>
              Welcome to FamilyTree
            </ThemedText>
            <ThemedText style={[styles.subtitle, { color: colors.icon }]}>
              We need to verify your age to continue
            </ThemedText>
          </View>

          {/* Age Selection */}
          <View style={styles.ageSection}>
            <DatePickerField
              label="What is your date of birth?"
              value={birthDate}
              onChange={handleBirthDateChange}
              placeholder="Select your birth date"
              hint="You must be at least 13 years old to use this app"
            />

            {/* Age Eligibility Status */}
            {isEligible !== null && birthDate && (
              <View
                style={[
                  styles.statusBox,
                  {
                    backgroundColor: isEligible ? colors.tint + '20' : '#FFE5E5',
                    borderColor: isEligible ? colors.tint : '#FF4444',
                  },
                ]}
              >
                <MaterialIcons
                  name={isEligible ? 'check-circle' : 'cancel'}
                  size={24}
                  color={isEligible ? colors.tint : '#FF4444'}
                />
                <ThemedText
                  style={[
                    styles.statusText,
                    { color: isEligible ? colors.tint : '#FF4444' },
                  ]}
                >
                  {isEligible
                    ? 'You are eligible to use FamilyTree'
                    : 'You must be at least 13 years old to use this app'}
                </ThemedText>
              </View>
            )}
          </View>

          {/* Privacy Policy Consent */}
          {isEligible && (
            <View style={styles.consentSection}>
              <Pressable
                onPress={() => setHasConsent(!hasConsent)}
                style={styles.consentCheckbox}
              >
                <View
                  style={[
                    styles.checkbox,
                    {
                      backgroundColor: hasConsent ? colors.tint : 'transparent',
                      borderColor: hasConsent ? colors.tint : colors.icon,
                    },
                  ]}
                >
                  {hasConsent && (
                    <MaterialIcons name="check" size={20} color="#FFFFFF" />
                  )}
                </View>
                <ThemedText style={[styles.consentText, { color: colors.text }]}>
                  I agree to the{' '}
                  <ThemedText
                    style={[styles.linkText, { color: colors.tint }]}
                    onPress={() => router.push('/privacy-policy')}
                  >
                    Privacy Policy
                  </ThemedText>
                  {' '}and{' '}
                  <ThemedText
                    style={[styles.linkText, { color: colors.tint }]}
                    onPress={() => router.push('/terms-of-use')}
                  >
                    Terms of Service
                  </ThemedText>
                </ThemedText>
              </Pressable>
            </View>
          )}

          {/* Continue Button */}
          <Pressable
            onPress={handleContinue}
            disabled={!isEligible || !hasConsent}
            style={[
              styles.continueButton,
              {
                backgroundColor: isEligible && hasConsent ? colors.tint : colors.icon + '40',
                opacity: isEligible && hasConsent ? 1 : 0.5,
              },
            ]}
          >
            <ThemedText
              style={[
                styles.continueButtonText,
                { color: isEligible && hasConsent ? '#FFFFFF' : colors.text },
              ]}
            >
              Continue
            </ThemedText>
          </Pressable>
        </View>
      </ScrollView>
      
      <View style={[styles.bottomSpacer, { height: bottomPadding }]} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topSpacer: {
    // Height set dynamically based on safe area insets
  },
  bottomSpacer: {
    // Height set dynamically based on safe area insets
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
  },
  ageSection: {
    marginBottom: 24,
  },
  statusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  consentSection: {
    marginBottom: 24,
  },
  consentCheckbox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  consentText: {
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },
  linkText: {
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  continueButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueButtonText: {
    fontSize: 18,
    fontWeight: '600',
  },
});
