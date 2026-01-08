/**
 * Welcome Screen (Onboarding Step 1)
 * 
 * First screen after SSO sign-in.
 * Welcomes user and explains what's next.
 */

import { StyleSheet, View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/contexts/auth-context';

export default function WelcomeScreen() {
  const colorScheme = useColorScheme();
  const theme = colorScheme ?? 'light';
  const colors = Colors[theme];
  const router = useRouter();
  const { session } = useAuth();

  const handleContinue = () => {
    router.push('/(onboarding)/profile');
  };

  const userName = session?.user.name || session?.user.email?.split('@')[0] || 'there';

  return (
    <ThemedView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        {/* Welcome Message */}
        <View style={styles.header}>
          <View style={[styles.iconContainer, { backgroundColor: colors.tint }]}>
            <MaterialIcons name="people" size={48} color="#FFFFFF" />
          </View>
          <ThemedText type="title" style={[styles.title, { color: colors.text }]}>
            Welcome, {userName}!
          </ThemedText>
          <ThemedText style={[styles.subtitle, { color: colors.icon }]}>
            Let's set up your profile to get started with your family tree.
          </ThemedText>
        </View>

        {/* Features Preview */}
        <View style={styles.features}>
          <View style={styles.feature}>
            <MaterialIcons name="person" size={24} color={colors.tint} />
            <ThemedText style={[styles.featureText, { color: colors.text }]}>Create your profile</ThemedText>
          </View>
          <View style={styles.feature}>
            <MaterialIcons name="location-on" size={24} color={colors.tint} />
            <ThemedText style={[styles.featureText, { color: colors.text }]}>Add your location</ThemedText>
          </View>
          <View style={styles.feature}>
            <MaterialIcons name="family-restroom" size={24} color={colors.tint} />
            <ThemedText style={[styles.featureText, { color: colors.text }]}>Start building your tree</ThemedText>
          </View>
        </View>

        {/* Continue Button */}
        <Pressable
          onPress={handleContinue}
          style={({ pressed }) => [
            styles.continueButton,
            {
              backgroundColor: colors.tint,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <ThemedText style={[styles.continueButtonText, { color: '#FFFFFF' }]}>Get Started</ThemedText>
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
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  features: {
    marginBottom: 48,
    gap: 20,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  featureText: {
    fontSize: 16,
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

