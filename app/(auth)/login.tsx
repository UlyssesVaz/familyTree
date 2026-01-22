/**
 * Login Screen
 * 
 * Simple login screen with native Google Sign-In button.
 * Uses @react-native-google-signin/google-signin for native Google Sign-In experience.
 */

import { StyleSheet, View, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/contexts/auth-context';
import GoogleSignInButton, { AppleSignInButton } from '@/components/auth';

export default function LoginScreen() {
  const colorScheme = useColorScheme();
  const theme = colorScheme ?? 'light';
  const colors = Colors[theme];
  const router = useRouter();
  const { isLoading } = useAuth();
  const insets = useSafeAreaInsets();
  
  // iOS best practice: Safe area top inset + additional padding
  const topPadding = Platform.OS === 'ios' ? Math.max(insets.top, 44) + 20 : insets.top + 20;
  const bottomPadding = Math.max(insets.bottom, 20);

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

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.topSpacer, { height: topPadding }]} />
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <ThemedText type="title" style={styles.title}>
            Welcome to Family Tree
          </ThemedText>
          <ThemedText style={[styles.subtitle, { color: colors.icon }]}>
            Sign in to get started
          </ThemedText>
        </View>

        {/* Sign-In Buttons */}
        <View style={styles.ssoSection}>
          {/* Apple Sign-In (REQUIRED for App Store) - Show first on iOS */}
          {Platform.OS === 'ios' && (
            <View style={styles.signInButton}>
              {/* #region agent log */}
              {(() => { fetch('http://127.0.0.1:7244/ingest/f336e8f0-8f7a-40aa-8f54-32371722b5de',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'login.tsx:62',message:'Rendering AppleSignInButton in login screen',data:{platform:Platform.OS},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{}); return null; })()}
              {/* #endregion */}
              <AppleSignInButton onSignInSuccess={handleSignInSuccess} />
            </View>
          )}
          
          {/* Google Sign-In Button */}
          <View style={styles.signInButton}>
            <GoogleSignInButton
              onSignInSuccess={handleSignInSuccess}
              onSignInError={handleSignInError}
              disabled={isLoading}
            />
          </View>
          
          {/* Apple Sign-In (fallback for web/Android) - Show after Google */}
          {Platform.OS !== 'ios' && (
            <View style={styles.signInButton}>
              <AppleSignInButton onSignInSuccess={handleSignInSuccess} />
            </View>
          )}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <ThemedText style={[styles.footerText, { color: colors.icon }]}>
            By continuing, you agree to our Terms of Service and Privacy Policy
          </ThemedText>
        </View>
      </View>
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
    marginBottom: 32,
    width: '100%',
    alignItems: 'center',
    gap: 12,
  },
  signInButton: {
    width: '100%',
    alignItems: 'center',
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

