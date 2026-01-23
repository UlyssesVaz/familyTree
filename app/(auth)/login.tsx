/**
 * Login Screen
 * 
 * Simple login screen with native Google Sign-In button.
 * Uses @react-native-google-signin/google-signin for native Google Sign-In experience.
 * 
 * Hidden demo login: Tap the title "Welcome to Family Tree" 5 times quickly to access.
 */

import { useState, useRef, useEffect } from 'react';
import { StyleSheet, View, Platform, Pressable, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/contexts/auth-context';
import GoogleSignInButton, { AppleSignInButton } from '@/components/auth';
import { DemoLoginModal } from '@/components/DemoLoginModal';

export default function LoginScreen() {
  const colorScheme = useColorScheme();
  const theme = colorScheme ?? 'light';
  const colors = Colors[theme];
  const router = useRouter();
  const { isLoading } = useAuth();
  const insets = useSafeAreaInsets();
  
  // Demo login modal state
  const [showDemoLogin, setShowDemoLogin] = useState(false);
  
  // Terms acceptance state
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState(false);
  
  // Secret tap sequence state (race condition safe)
  const tapCountRef = useRef(0);
  const lastTapTimeRef = useRef(0);
  const resetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // iOS best practice: Safe area top inset + additional padding
  const topPadding = Platform.OS === 'ios' ? Math.max(insets.top, 44) + 20 : insets.top + 20;
  const bottomPadding = Math.max(insets.bottom, 20);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (resetTimeoutRef.current) {
        clearTimeout(resetTimeoutRef.current);
        resetTimeoutRef.current = null;
      }
    };
  }, []);

  // Secret tap sequence: Tap the title 5 times quickly to show demo login
  const handleTitlePress = () => {
    const now = Date.now();
    const timeSinceLastTap = now - lastTapTimeRef.current;

    // Clear existing timeout
    if (resetTimeoutRef.current) {
      clearTimeout(resetTimeoutRef.current);
    }

    // Reset if more than 2 seconds between taps
    if (timeSinceLastTap > 2000) {
      tapCountRef.current = 0;
    }

    tapCountRef.current += 1;
    lastTapTimeRef.current = now;

    // Show demo login after 5 taps
    if (tapCountRef.current >= 5) {
      setShowDemoLogin(true);
      tapCountRef.current = 0; // Reset
    } else {
      // Set timeout to reset tap count if no more taps within 2 seconds
      resetTimeoutRef.current = setTimeout(() => {
        tapCountRef.current = 0;
        resetTimeoutRef.current = null;
      }, 2000);
    }
  };

  // Callback when Google sign-in succeeds
  // The auth context will automatically detect the session change via onAuthStateChanged
  const handleSignInSuccess = () => {
    if (__DEV__) {
      console.log('[LoginScreen] Google sign-in successful');
    }
    // Auth context will handle routing automatically
  };

  const handleSignInError = (error: Error) => {
    console.error('[LoginScreen] Google sign-in error:', error);
    // Error handling is done in the GoogleSignInButton component
  };

  // Wrapper for Apple Sign-In to check terms
  const handleAppleSignInWrapper = () => {
    if (!hasAcceptedTerms) {
      Alert.alert('Terms Required', 'Please accept the Terms of Service and Privacy Policy to continue.');
      return;
    }
    // Terms accepted, proceed with sign-in (handled by AppleSignInButton)
  };

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.topSpacer, { height: topPadding }]} />
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={handleTitlePress}>
            <ThemedText type="title" style={styles.title}>
              Welcome to Family Tree
            </ThemedText>
          </Pressable>
          <ThemedText style={[styles.subtitle, { color: colors.icon }]}>
            Sign in to get started
          </ThemedText>
        </View>

        {/* Sign-In Buttons */}
        <View style={styles.ssoSection}>
          {/* Apple Sign-In (REQUIRED for App Store) - Show first on iOS */}
          {Platform.OS === 'ios' && (
            <View style={styles.signInButton}>
              <AppleSignInButton 
                onSignInSuccess={handleSignInSuccess}
                disabled={!hasAcceptedTerms}
              />
              {!hasAcceptedTerms && (
                <View style={styles.disabledOverlay} pointerEvents="box-only">
                  <Pressable 
                    style={StyleSheet.absoluteFill} 
                    onPress={() => Alert.alert('Terms Required', 'Please accept the Terms of Service and Privacy Policy to continue.')}
                  />
                </View>
              )}
            </View>
          )}
          
          {/* Google Sign-In Button */}
          <View style={styles.signInButton}>
            <GoogleSignInButton
              onSignInSuccess={handleSignInSuccess}
              onSignInError={handleSignInError}
              disabled={isLoading || !hasAcceptedTerms}
            />
          </View>
          
          {/* Apple Sign-In (fallback for web/Android) - Show after Google */}
          {Platform.OS !== 'ios' && (
            <View style={styles.signInButton}>
              <AppleSignInButton 
                onSignInSuccess={handleSignInSuccess}
                disabled={!hasAcceptedTerms}
              />
              {!hasAcceptedTerms && (
                <View style={styles.disabledOverlay} pointerEvents="box-only">
                  <Pressable 
                    style={StyleSheet.absoluteFill} 
                    onPress={() => Alert.alert('Terms Required', 'Please accept the Terms of Service and Privacy Policy to continue.')}
                  />
                </View>
              )}
            </View>
          )}
        </View>

        {/* Terms Acceptance Checkbox */}
        <View style={styles.termsSection}>
          <Pressable
            onPress={() => setHasAcceptedTerms(!hasAcceptedTerms)}
            style={styles.termsCheckbox}
          >
            <View
              style={[
                styles.checkbox,
                {
                  backgroundColor: hasAcceptedTerms ? colors.tint : 'transparent',
                  borderColor: hasAcceptedTerms ? colors.tint : colors.icon,
                },
              ]}
            >
              {hasAcceptedTerms && (
                <MaterialIcons name="check" size={18} color="#FFFFFF" />
              )}
            </View>
            <ThemedText style={[styles.termsText, { color: colors.text }]}>
              I agree to the{' '}
              <ThemedText
                style={[styles.linkText, { color: colors.tint }]}
                onPress={(e) => {
                  e.stopPropagation();
                  router.push('/privacy-policy');
                }}
              >
                Privacy Policy
              </ThemedText>
              {' '}and{' '}
              <ThemedText
                style={[styles.linkText, { color: colors.tint }]}
                onPress={(e) => {
                  e.stopPropagation();
                  router.push('/terms-of-use');
                }}
              >
                Terms of Service
              </ThemedText>
            </ThemedText>
          </Pressable>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <ThemedText style={[styles.footerText, { color: colors.icon }]}>
            By continuing, you confirm that you are at least 13 years old
          </ThemedText>
        </View>
      </View>
      <View style={[styles.bottomSpacer, { height: bottomPadding }]} />
      
      {/* Demo Login Modal (hidden, only accessible via secret tap) */}
      <DemoLoginModal
        visible={showDemoLogin}
        onClose={() => setShowDemoLogin(false)}
      />
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
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
  },
  ssoSection: {
    marginBottom: 24,
    width: '100%',
    alignItems: 'center',
    gap: 12,
  },
  signInButton: {
    width: '100%',
    alignItems: 'center',
    position: 'relative',
  },
  disabledOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  termsSection: {
    marginBottom: 20,
    width: '100%',
  },
  termsCheckbox: {
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
    flexShrink: 0,
  },
  termsText: {
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },
  linkText: {
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  footer: {
    marginTop: 'auto',
    paddingTop: 24,
  },
  footerText: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
});

