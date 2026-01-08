/**
 * Login Screen
 * 
 * Simple login screen with SSO options.
 * Minimal typing - focus on SSO for ease of use.
 */

import { useState } from 'react';
import { StyleSheet, View, Pressable, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/contexts/auth-context';
import type { AuthProvider } from '@/services/auth/types';

const SSO_PROVIDERS: Array<{ provider: AuthProvider; label: string; icon: string; color: string }> = [
  { provider: 'google', label: 'Google', icon: 'google', color: '#4285F4' },
  { provider: 'microsoft', label: 'Microsoft', icon: 'microsoft', color: '#00A4EF' },
  { provider: 'apple', label: 'Apple', icon: 'apple', color: '#000000' },
  { provider: 'slack', label: 'Slack', icon: 'slack', color: '#4A154B' },
];

export default function LoginScreen() {
  const colorScheme = useColorScheme();
  const theme = colorScheme ?? 'light';
  const colors = Colors[theme];
  const router = useRouter();
  const { signInWithProvider, isLoading, error } = useAuth();
  const [signingInProvider, setSigningInProvider] = useState<AuthProvider | null>(null);

  const handleSSOSignIn = async (provider: AuthProvider) => {
    try {
      setSigningInProvider(provider);
      await signInWithProvider(provider);
      // Auth context will handle routing
    } catch (err) {
      Alert.alert('Sign In Failed', error?.message || 'Please try again');
    } finally {
      setSigningInProvider(null);
    }
  };

  return (
    <ThemedView style={styles.container}>
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

        {/* SSO Buttons */}
        <View style={styles.ssoSection}>
          <ThemedText style={[styles.ssoLabel, { color: colors.icon }]}>
            Or continue with:
          </ThemedText>
          
          {SSO_PROVIDERS.map(({ provider, label, icon, color }) => {
            const isSigningIn = signingInProvider === provider;
            const disabled = isLoading || isSigningIn;

            return (
              <Pressable
                key={provider}
                onPress={() => handleSSOSignIn(provider)}
                disabled={disabled}
                style={({ pressed }) => [
                  styles.ssoButton,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.icon,
                    opacity: disabled ? 0.5 : pressed ? 0.8 : 1,
                  },
                ]}
              >
                {isSigningIn ? (
                  <ActivityIndicator size="small" color={color} />
                ) : (
                  <>
                    {/* Icon placeholder - you can add actual provider icons */}
                    <View style={[styles.iconPlaceholder, { backgroundColor: color }]}>
                      <ThemedText style={styles.iconText}>{label[0]}</ThemedText>
                    </View>
                    <ThemedText style={[styles.ssoButtonText, { color: colors.text }]}>
                      {label}
                    </ThemedText>
                  </>
                )}
              </Pressable>
            );
          })}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <ThemedText style={[styles.footerText, { color: colors.icon }]}>
            By continuing, you agree to our Terms of Service and Privacy Policy
          </ThemedText>
        </View>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 48,
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
  },
  ssoLabel: {
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
  },
  ssoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
    gap: 12,
  },
  iconPlaceholder: {
    width: 24,
    height: 24,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  ssoButtonText: {
    fontSize: 16,
    fontWeight: '500',
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

