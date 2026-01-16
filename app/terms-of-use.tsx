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

export default function TermsOfUseScreen() {
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
          Terms of Use
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

        <ThemedText style={styles.sectionTitle}>1. Acceptance of Terms</ThemedText>
        <ThemedText style={styles.paragraph}>
          By accessing and using Family Tree App, you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to these Terms of Use, please do not use the app.
        </ThemedText>

        <ThemedText style={styles.sectionTitle}>2. Description of Service</ThemedText>
        <ThemedText style={styles.paragraph}>
          Family Tree App is a collaborative platform that allows families to create, manage, and share their family tree. The service includes features for adding family members, sharing updates, uploading photos, and managing relationships.
        </ThemedText>

        <ThemedText style={styles.sectionTitle}>3. User Accounts</ThemedText>
        <ThemedText style={styles.paragraph}>
          • You are responsible for maintaining the confidentiality of your account credentials.
        </ThemedText>
        <ThemedText style={styles.paragraph}>
          • You are responsible for all activities that occur under your account.
        </ThemedText>
        <ThemedText style={styles.paragraph}>
          • You must be at least 13 years old to create an account, or have parental consent if under 18.
        </ThemedText>
        <ThemedText style={styles.paragraph}>
          • You agree to provide accurate and complete information when creating your account.
        </ThemedText>

        <ThemedText style={styles.sectionTitle}>4. User-Generated Content</ThemedText>
        <ThemedText style={styles.subsectionTitle}>4.1 Content Ownership</ThemedText>
        <ThemedText style={styles.paragraph}>
          You retain ownership of content you create and upload. By uploading content, you grant Family Tree App a license to use, display, and distribute your content within the app for the purpose of providing the service.
        </ThemedText>

        <ThemedText style={styles.subsectionTitle}>4.2 Shadow Profiles</ThemedText>
        <ThemedText style={styles.paragraph}>
          Family members may create profiles for other family members (shadow profiles). These profiles become collaborative and can be edited by family members with appropriate permissions. If a shadow profile is created for you, you can claim it by creating an account.
        </ThemedText>

        <ThemedText style={styles.subsectionTitle}>4.3 Content Responsibility</ThemedText>
        <ThemedText style={styles.paragraph}>
          You are responsible for all content you post, including ensuring you have the right to post it and that it does not violate any laws or infringe on others' rights.
        </ThemedText>

        <ThemedText style={styles.sectionTitle}>5. Prohibited Activities</ThemedText>
        <ThemedText style={styles.paragraph}>
          You agree not to:
        </ThemedText>
        <ThemedText style={styles.listItem}>• Post false, misleading, or defamatory content</ThemedText>
        <ThemedText style={styles.listItem}>• Harass, abuse, or harm other users</ThemedText>
        <ThemedText style={styles.listItem}>• Violate any applicable laws or regulations</ThemedText>
        <ThemedText style={styles.listItem}>• Infringe on intellectual property rights</ThemedText>
        <ThemedText style={styles.listItem}>• Attempt to gain unauthorized access to the service</ThemedText>
        <ThemedText style={styles.listItem}>• Use the service for any illegal or unauthorized purpose</ThemedText>

        <ThemedText style={styles.sectionTitle}>6. Collaborative Editing</ThemedText>
        <ThemedText style={styles.paragraph}>
          Family Tree App uses a consensus-based editing model for shadow profiles. Family members can edit profiles through a collaborative process. Disputes about profile content should be resolved among family members.
        </ThemedText>

        <ThemedText style={styles.sectionTitle}>7. Account Termination</ThemedText>
        <ThemedText style={styles.paragraph}>
          • You may delete your account at any time through the settings page.
        </ThemedText>
        <ThemedText style={styles.paragraph}>
          • We reserve the right to suspend or terminate accounts that violate these Terms of Use.
        </ThemedText>
        <ThemedText style={styles.paragraph}>
          • Upon account deletion, you have a 30-day grace period to cancel the deletion.
        </ThemedText>
        <ThemedText style={styles.paragraph}>
          • Shadow profiles may remain in the family tree after account deletion, managed by family consensus.
        </ThemedText>

        <ThemedText style={styles.sectionTitle}>8. Limitation of Liability</ThemedText>
        <ThemedText style={styles.paragraph}>
          Family Tree App is provided "as is" without warranties of any kind. We are not liable for any damages arising from your use of the service, including but not limited to data loss, unauthorized access, or content disputes.
        </ThemedText>

        <ThemedText style={styles.sectionTitle}>9. Intellectual Property</ThemedText>
        <ThemedText style={styles.paragraph}>
          The Family Tree App service, including its design, features, and functionality, is owned by Family Tree App and protected by copyright, trademark, and other intellectual property laws.
        </ThemedText>

        <ThemedText style={styles.sectionTitle}>10. Privacy</ThemedText>
        <ThemedText style={styles.paragraph}>
          Your use of Family Tree App is also governed by our Privacy Policy. Please review the Privacy Policy to understand how we collect, use, and protect your information.
        </ThemedText>

        <ThemedText style={styles.sectionTitle}>11. Changes to Terms</ThemedText>
        <ThemedText style={styles.paragraph}>
          We reserve the right to modify these Terms of Use at any time. We will notify users of significant changes. Your continued use of the service after changes constitutes acceptance of the new terms.
        </ThemedText>

        <ThemedText style={styles.sectionTitle}>12. Dispute Resolution</ThemedText>
        <ThemedText style={styles.paragraph}>
          Any disputes arising from these Terms of Use or your use of the service shall be resolved through good faith negotiation. If a resolution cannot be reached, disputes may be subject to binding arbitration.
        </ThemedText>

        <ThemedText style={styles.sectionTitle}>13. Contact Information</ThemedText>
        <ThemedText style={styles.paragraph}>
          If you have questions about these Terms of Use, please contact us:
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
  footer: {
    height: 32,
  },
});
