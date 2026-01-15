import React, { useState } from 'react';
import { ScrollView, StyleSheet, Alert, View, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { SettingsSection } from '@/components/settings/SettingsSection';
import { SettingsItem } from '@/components/settings/SettingsItem';
import { SettingsToggle } from '@/components/settings/SettingsToggle';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useColorSchemeContext } from '@/contexts/color-scheme-context';
import { useAuth } from '@/contexts/auth-context';
import { AccountDeletionModal, type DeletionOption } from '@/components/family-tree';
import { requestAccountDeletion } from '@/services/supabase/account-api';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const theme = colorScheme ?? 'light';
  const colors = Colors[theme];
  const { colorScheme: currentScheme, setColorScheme } = useColorSchemeContext();
  const { signOut, session } = useAuth();
  const [showAccountDeletionModal, setShowAccountDeletionModal] = useState(false);

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut();
            } catch (error) {
              Alert.alert('Error', 'Failed to sign out. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleDeleteAccount = async (option: DeletionOption) => {
    if (!session?.user?.id) {
      Alert.alert('Error', 'You must be signed in to delete your account.');
      return;
    }
    
    try {
      const deletionStatus = await requestAccountDeletion(session.user.id, option);
      
      const gracePeriodEnds = deletionStatus.gracePeriodEndsAt 
        ? new Date(deletionStatus.gracePeriodEndsAt).toLocaleDateString()
        : '30 days';
      
      Alert.alert(
        option === 'delete_profile' ? 'Deletion Requested' : 'Deactivation Requested',
        option === 'delete_profile'
          ? `Your profile deletion has been scheduled. Your photos and stories will be removed, and your account information will be deleted within 30 days. You can cancel before ${gracePeriodEnds}.\n\nRecovery Token: ${deletionStatus.recoveryToken}\n\nPlease save this token if you want to restore your account.`
          : `Your account deactivation has been scheduled. Your photos and stories will remain, but your account information will be removed within a year. You can cancel before ${gracePeriodEnds}.\n\nRecovery Token: ${deletionStatus.recoveryToken}\n\nPlease save this token if you want to restore your account.`,
        [
          { 
            text: 'OK', 
            onPress: () => {
              // Sign out after deletion request
              signOut();
            }
          }
        ]
      );
    } catch (error: any) {
      console.error('[Settings] Error requesting account deletion:', error);
      Alert.alert('Error', `Failed to request account deletion: ${error.message}`);
    }
  };

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={24} color={colors.text} />
          </Pressable>
          <ThemedText type="title" style={styles.headerTitle}>
            Settings
          </ThemedText>
          <View style={styles.placeholder} />
        </View>

        {/* Preferences Section */}
        <SettingsSection title="Preferences">
          <SettingsToggle
            icon={currentScheme === 'dark' ? 'light-mode' : 'dark-mode'}
            label={currentScheme === 'dark' ? 'Dark Mode' : 'Light Mode'}
            value={currentScheme === 'dark'}
            onValueChange={(value) => setColorScheme(value ? 'dark' : 'light')}
          />
        </SettingsSection>

        {/* Privacy & Security Section */}
        <SettingsSection title="Privacy & Security">
          <SettingsItem
            icon="privacy-tip"
            label="Privacy Policy"
            onPress={() => router.push('/privacy-policy')}
          />
          <SettingsItem
            icon="description"
            label="Terms of Use"
            onPress={() => router.push('/terms-of-use')}
          />
        </SettingsSection>

        {/* Account Section */}
        <SettingsSection title="Account">
          <SettingsItem
            icon="logout"
            label="Sign Out"
            onPress={handleSignOut}
            destructive
          />
          <SettingsItem
            icon="delete-outline"
            label="Delete Account"
            onPress={() => setShowAccountDeletionModal(true)}
            destructive
          />
        </SettingsSection>

        {/* App Info */}
        <View style={styles.footer}>
          <ThemedText style={[styles.footerText, { color: colors.icon }]}>
            Family Tree App
          </ThemedText>
          <ThemedText style={[styles.footerText, { color: colors.icon }]}>
            Version 1.0.0
          </ThemedText>
        </View>
      </ScrollView>

      {/* Account Deletion Modal */}
      <AccountDeletionModal
        visible={showAccountDeletionModal}
        onClose={() => setShowAccountDeletionModal(false)}
        onConfirm={handleDeleteAccount}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
  },
  placeholder: {
    width: 40,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 32,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    marginBottom: 4,
  },
});
