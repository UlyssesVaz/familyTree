import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Pressable } from 'react-native';

import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function PrivacyPolicyScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const theme = colorScheme ?? 'light';
  const colors = Colors[theme];

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <ThemedText type="title" style={styles.title}>
          Privacy Policy
        </ThemedText>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <ThemedText style={styles.lastUpdated}>
          Last Updated: {new Date().toLocaleDateString()}
        </ThemedText>

        <ThemedText style={styles.sectionTitle}>1. Introduction</ThemedText>
        <ThemedText style={styles.paragraph}>
          Welcome to Family Tree App. We are committed to protecting your privacy and ensuring transparency about how we collect, use, and share your personal information. This Privacy Policy explains our practices regarding data collection, use, and sharing.
        </ThemedText>

        <ThemedText style={styles.sectionTitle}>2. Data We Collect</ThemedText>
        <ThemedText style={styles.subsectionTitle}>2.1 Personal Information</ThemedText>
        <ThemedText style={styles.paragraph}>
          We collect the following personal information:
        </ThemedText>
        <ThemedText style={styles.listItem}>• Name (required)</ThemedText>
        <ThemedText style={styles.listItem}>• Email address (for account creation)</ThemedText>
        <ThemedText style={styles.listItem}>• Birth date (optional)</ThemedText>
        <ThemedText style={styles.listItem}>• Death date (optional, for deceased family members)</ThemedText>
        <ThemedText style={styles.listItem}>• Gender (optional)</ThemedText>
        <ThemedText style={styles.listItem}>• Phone number (optional)</ThemedText>
        <ThemedText style={styles.listItem}>• Location data (optional, if you choose to provide it)</ThemedText>
        <ThemedText style={styles.listItem}>• Photos (person photos and update photos)</ThemedText>
        <ThemedText style={styles.listItem}>• User-generated content (posts, updates, captions, tags)</ThemedText>

        <ThemedText style={styles.subsectionTitle}>2.2 Shadow Profiles</ThemedText>
        <ThemedText style={styles.paragraph}>
          Family members may create profiles for other family members (called "shadow profiles") without their direct consent. These profiles become collaborative and can be edited by any family member with appropriate permissions, similar to Wikipedia-style editing. If a shadow profile is created for you, you can claim it by creating an account and linking it to your profile.
        </ThemedText>

        <ThemedText style={styles.sectionTitle}>3. How We Collect Data</ThemedText>
        <ThemedText style={styles.paragraph}>
          We collect data through:
        </ThemedText>
        <ThemedText style={styles.listItem}>• Direct input from you when you create your account or profile</ThemedText>
        <ThemedText style={styles.listItem}>• Information provided by other family members who create shadow profiles</ThemedText>
        <ThemedText style={styles.listItem}>• Photos and content you upload</ThemedText>
        <ThemedText style={styles.listItem}>• Photos and content uploaded by other family members about you</ThemedText>
        <ThemedText style={styles.listItem}>• Authentication data from Google Sign-In (if you choose to sign in with Google)</ThemedText>

        <ThemedText style={styles.sectionTitle}>4. How We Use Your Data</ThemedText>
        <ThemedText style={styles.paragraph}>
          We use your data to:
        </ThemedText>
        <ThemedText style={styles.listItem}>• Display and manage your family tree</ThemedText>
        <ThemedText style={styles.listItem}>• Show updates and posts in the family feed</ThemedText>
        <ThemedText style={styles.listItem}>• Map relationships between family members</ThemedText>
        <ThemedText style={styles.listItem}>• Enable collaborative editing of family profiles</ThemedText>
        <ThemedText style={styles.listItem}>• Provide authentication and account management</ThemedText>
        <ThemedText style={styles.listItem}>• Improve our services through anonymized analytics</ThemedText>

        <ThemedText style={styles.sectionTitle}>5. Data Sharing</ThemedText>
        <ThemedText style={styles.subsectionTitle}>5.1 Third-Party Services</ThemedText>
        <ThemedText style={styles.paragraph}>
          We share data with the following third-party services:
        </ThemedText>
        <ThemedText style={styles.listItem}>• <ThemedText style={styles.bold}>Supabase</ThemedText>: Database and file storage services</ThemedText>
        <ThemedText style={styles.listItem}>• <ThemedText style={styles.bold}>Google Sign-In</ThemedText>: Authentication services (if you choose to use Google Sign-In)</ThemedText>
        <ThemedText style={styles.listItem}>• <ThemedText style={styles.bold}>Statsig</ThemedText>: Analytics services (anonymized data only, no personally identifiable information)</ThemedText>

        <ThemedText style={styles.subsectionTitle}>5.2 Family Members</ThemedText>
        <ThemedText style={styles.paragraph}>
          Your profile information, photos, and posts are visible to other family members who have access to your family tree. Family members can edit shadow profiles through a consensus-based permission system.
        </ThemedText>

        <ThemedText style={styles.sectionTitle}>6. Data Retention</ThemedText>
        <ThemedText style={styles.paragraph}>
          • <ThemedText style={styles.bold}>Active Accounts</ThemedText>: We retain your data indefinitely while your account is active.
        </ThemedText>
        <ThemedText style={styles.paragraph}>
          • <ThemedText style={styles.bold}>Deleted Accounts</ThemedText>: If you request account deletion, we provide a 30-day grace period during which you can cancel the deletion. After the grace period, your account and associated data will be permanently deleted.
        </ThemedText>
        <ThemedText style={styles.paragraph}>
          • <ThemedText style={styles.bold}>Shadow Profiles</ThemedText>: Shadow profiles remain in the family tree and are managed by family consensus even if the linked account is deleted.
        </ThemedText>

        <ThemedText style={styles.sectionTitle}>7. Your Rights</ThemedText>
        <ThemedText style={styles.paragraph}>
          You have the right to:
        </ThemedText>
        <ThemedText style={styles.listItem}>• Access your personal data</ThemedText>
        <ThemedText style={styles.listItem}>• Request correction of inaccurate data</ThemedText>
        <ThemedText style={styles.listItem}>• Request deletion of your account and data</ThemedText>
        <ThemedText style={styles.listItem}>• Export your data (GDPR compliance)</ThemedText>
        <ThemedText style={styles.listItem}>• Opt-out of analytics tracking</ThemedText>
        <ThemedText style={styles.paragraph}>
          To exercise these rights, please contact us through the app settings or use the account deletion feature in the settings page.
        </ThemedText>

        <ThemedText style={styles.sectionTitle}>8. Children's Privacy</ThemedText>
        <ThemedText style={styles.paragraph}>
          We comply with the Children's Online Privacy Protection Act (COPPA) and the European Union's General Data Protection Regulation (GDPR). We do not knowingly collect personal information from children under 13 without parental consent. If you believe we have collected information from a child under 13, please contact us immediately.
        </ThemedText>

        <ThemedText style={styles.sectionTitle}>9. Security</ThemedText>
        <ThemedText style={styles.paragraph}>
          We implement appropriate security measures to protect your personal information from unauthorized access, disclosure, or destruction. However, no method of transmission over the internet is 100% secure.
        </ThemedText>

        <ThemedText style={styles.sectionTitle}>10. Changes to This Policy</ThemedText>
        <ThemedText style={styles.paragraph}>
          We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last Updated" date.
        </ThemedText>

        <ThemedText style={styles.sectionTitle}>11. Contact Us</ThemedText>
        <ThemedText style={styles.paragraph}>
          If you have questions about this Privacy Policy or our data practices, please contact us:
        </ThemedText>
        <ThemedText style={styles.paragraph}>
          <ThemedText style={styles.bold}>Company:</ThemedText> Cera Tech LLC
        </ThemedText>
        <ThemedText style={styles.paragraph}>
          <ThemedText style={styles.bold}>Email:</ThemedText> ulysses@startceratech.com
        </ThemedText>
        <ThemedText style={styles.paragraph}>
          <ThemedText style={styles.bold}>Address:</ThemedText> 522 W Riverside Ave Ste N, Spokane, WA 99201, United States
        </ThemedText>
        <ThemedText style={styles.paragraph}>
          <ThemedText style={styles.bold}>Website:</ThemedText> startceratech.com
        </ThemedText>

        <View style={styles.footer} />
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  lastUpdated: {
    fontSize: 12,
    opacity: 0.6,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 24,
    marginBottom: 12,
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  paragraph: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 12,
  },
  listItem: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 8,
    paddingLeft: 8,
  },
  bold: {
    fontWeight: '600',
  },
  footer: {
    height: 32,
  },
});
