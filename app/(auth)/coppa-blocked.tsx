/**
 * COPPA Blocked Screen
 * 
 * Displayed when a user tries to access the app after their account
 * was deleted for COPPA compliance violations (age < 13).
 * 
 * Prevents re-registration and explains the account closure.
 */

import { StyleSheet, View, Linking, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/contexts/auth-context';
import { ExternalLink } from '@/components/external-link';

export default function COPPABlockedScreen() {
  const colorScheme = useColorScheme();
  const theme = colorScheme ?? 'light';
  const colors = Colors[theme];
  const router = useRouter();
  const { signOut } = useAuth();
  const insets = useSafeAreaInsets();

  const handleSignOut = async () => {
    try {
      await signOut();
      router.replace('/(auth)/login');
    } catch (error) {
      console.error('[COPPABlocked] Error signing out:', error);
      // Still try to navigate even if sign out fails
      router.replace('/(auth)/login');
    }
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={styles.content}>
        {/* Icon */}
        <View style={[styles.iconContainer, { backgroundColor: colors.icon + '20' }]}>
          <MaterialIcons name="block" size={64} color={colors.icon} />
        </View>

        {/* Title */}
        <ThemedText type="title" style={[styles.title, { color: colors.text }]}>
          Account Closed
        </ThemedText>

        {/* Message */}
        <ThemedText style={[styles.message, { color: colors.icon }]}>
          Your account has been permanently closed due to age requirements.
        </ThemedText>

        <ThemedText style={[styles.message, { color: colors.icon, marginTop: 16 }]}>
          To use this app, you must be at least 13 years old. This is required by law to protect children's privacy online.
        </ThemedText>

        {/* Explanation */}
        <View style={[styles.infoBox, { backgroundColor: colors.background, borderColor: colors.icon }]}>
          <ThemedText style={[styles.infoText, { color: colors.text }]}>
            This account cannot be reopened or re-registered. If you believe this was an error, please contact support.
          </ThemedText>
          <Pressable
            onPress={() => Linking.openURL('mailto:support@familytreeapp.com?subject=COPPA Account Deletion Appeal')}
            style={styles.supportLink}
          >
            <MaterialIcons name="email" size={16} color={colors.tint} />
            <ThemedText style={[styles.supportLinkText, { color: colors.tint }]}>
              support@familytreeapp.com
            </ThemedText>
          </Pressable>
        </View>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <ThemedText 
          style={[styles.linkText, { color: colors.tint }]}
          onPress={handleSignOut}
        >
          Return to Login
        </ThemedText>
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
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 8,
  },
  infoBox: {
    marginTop: 32,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    width: '100%',
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  footer: {
    paddingBottom: 32,
    alignItems: 'center',
  },
  linkText: {
    fontSize: 16,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  supportLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    gap: 8,
  },
  supportLinkText: {
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
