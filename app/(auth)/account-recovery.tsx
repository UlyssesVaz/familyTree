/**
 * Account Recovery Screen
 * 
 * Displays when a user with a pending account deletion signs in.
 * Shows the deletion countdown and allows users to restore their account
 * or confirm the deletion.
 * 
 * Required for App Store compliance (Guideline 5.1.1 - Account Deletion)
 */

import React from 'react';
import { View, StyleSheet, Pressable, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useSessionStore } from '@/stores/session-store';
import { cancelAccountDeletion, getAccountDeletionStatus } from '@/services/supabase/account-api';
import { useAuth } from '@/contexts/auth-context';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { AccountDeletionStatus } from '@/services/supabase/account-api';

export default function AccountRecoveryScreen() {
  const router = useRouter();
  const { session, signOut } = useAuth();
  const [deletionStatus, setDeletionStatus] = React.useState<AccountDeletionStatus | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isChecking, setIsChecking] = React.useState(true);
  const colorScheme = useColorScheme();
  const theme = colorScheme ?? 'light';
  const colors = Colors[theme];
  
  // Fetch deletion status directly (don't rely on store state which may not be set yet)
  React.useEffect(() => {
    const checkDeletionStatus = async () => {
      if (!session) {
        console.log('[AccountRecovery] No session, redirecting to login');
        router.replace('/(auth)/login');
        return;
      }
      
      try {
        console.log('[AccountRecovery] Fetching deletion status for user:', session.user.id);
        const status = await getAccountDeletionStatus(session.user.id);
        
        if (status && status.isInGracePeriod) {
          if (__DEV__) {
            console.log('[AccountRecovery] Deletion status found, showing recovery screen');
          }
          setDeletionStatus(status);
          // Also update store for consistency
          useSessionStore.getState().setDeletionStatus(status);
        } else {
          if (__DEV__) {
            console.log('[AccountRecovery] No pending deletion found, redirecting to login');
          }
          router.replace('/(auth)/login');
        }
      } catch (error) {
        console.error('[AccountRecovery] Error checking deletion status:', error);
        router.replace('/(auth)/login');
      } finally {
        setIsChecking(false);
      }
    };
    
    checkDeletionStatus();
  }, [session, router]);
  
  // Show loading while checking deletion status
  if (isChecking || !deletionStatus || !session) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.content}>
          <ActivityIndicator size="large" />
        </View>
      </ThemedView>
    );
  }
  
  const gracePeriodEnds = deletionStatus.gracePeriodEndsAt
    ? new Date(deletionStatus.gracePeriodEndsAt)
    : null;
  
  const formattedDate = gracePeriodEnds
    ? gracePeriodEnds.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'the scheduled date';
  
  // Calculate days remaining
  const daysRemaining = gracePeriodEnds
    ? Math.max(0, Math.ceil((gracePeriodEnds.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;
  
  const handleCancelDeletion = async () => {
    setIsLoading(true);
    try {
      await cancelAccountDeletion(session.user.id);
      
      // Clear deletion status from store
      useSessionStore.getState().setDeletionStatus(null);
      
      // Show success message
      Alert.alert(
        'Account Restored',
        'Your account has been successfully restored. Welcome back!',
        [
          {
            text: 'Continue',
            onPress: () => {
              // Navigate to tabs - profile context will detect no deletion status
              // and continue with normal profile loading flow
              router.replace('/(tabs)');
            }
          }
        ]
      );
    } catch (error: any) {
      console.error('[AccountRecovery] Failed to cancel deletion:', error);
      
      // Handle specific error cases
      if (error.message?.includes('expired') || error.message?.includes('grace period')) {
        Alert.alert(
          'Recovery Period Expired',
          'The 30-day recovery period has ended. Your account deletion cannot be cancelled.',
          [{ text: 'OK', onPress: handleConfirmDeletion }]
        );
      } else {
        Alert.alert(
          'Restoration Failed',
          'We couldn\'t restore your account. Please try again or contact support.',
          [{ text: 'OK' }]
        );
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleConfirmDeletion = () => {
    Alert.alert(
      'Confirm Deletion',
      'Are you sure you want to keep your account deletion scheduled? This action will permanently delete your account on the scheduled date.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Keep Deletion',
          style: 'destructive',
          onPress: async () => {
            // Sign out - account will be deleted on schedule
            await signOut();
            router.replace('/(auth)/login');
          }
        }
      ]
    );
  };
  
  return (
    <ThemedView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        {/* Warning Icon */}
        <View style={[styles.iconContainer, { backgroundColor: '#FF3B30' + '20' }]}>
          <ThemedText style={styles.iconText}>⚠️</ThemedText>
        </View>
        
        {/* Title */}
        <ThemedText type="title" style={[styles.title, { color: colors.text }]}>
          Account Deletion Scheduled
        </ThemedText>
        
        {/* Days Remaining */}
        <View style={[styles.countdownContainer, { borderColor: '#FF3B30' }]}>
          <ThemedText style={styles.countdownNumber}>{daysRemaining}</ThemedText>
          <ThemedText style={[styles.countdownLabel, { color: colors.icon }]}>
            {daysRemaining === 1 ? 'day' : 'days'} remaining
          </ThemedText>
        </View>
        
        {/* Message */}
        <ThemedText style={[styles.message, { color: colors.text }]}>
          Your account is scheduled for permanent deletion on {formattedDate}.
        </ThemedText>
        
        <ThemedText style={[styles.message, { color: colors.icon }]}>
          You can restore your account now to cancel the deletion, or proceed with the scheduled deletion.
        </ThemedText>
        
        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          {/* Primary Button - Restore Account */}
          <Pressable 
            style={[styles.button, styles.primaryButton, isLoading && styles.buttonDisabled]}
            onPress={handleCancelDeletion}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <ThemedText style={styles.primaryButtonText}>
                Restore My Account
              </ThemedText>
            )}
          </Pressable>
          
          {/* Secondary Button - Keep Deletion */}
          <Pressable 
            style={[styles.button, styles.secondaryButton, { borderColor: colors.icon }, isLoading && styles.buttonDisabled]}
            onPress={handleConfirmDeletion}
            disabled={isLoading}
          >
            <ThemedText style={[styles.secondaryButtonText, { color: colors.text }]}>
              Keep Deletion Scheduled
            </ThemedText>
          </Pressable>
        </View>
        
        {/* Footer Info */}
        <ThemedText style={[styles.footerText, { color: colors.icon }]}>
          After deletion, your account data will be permanently removed and cannot be recovered.
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
    paddingHorizontal: 32,
    paddingVertical: 48,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 24,
  },
  iconText: {
    fontSize: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 24,
    textAlign: 'center',
  },
  countdownContainer: {
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 2,
  },
  countdownNumber: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#FF3B30',
  },
  countdownLabel: {
    fontSize: 16,
    marginTop: 4,
  },
  message: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 16,
    textAlign: 'center',
  },
  buttonContainer: {
    marginTop: 32,
    gap: 16,
  },
  button: {
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#007AFF',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
  secondaryButtonText: {
    fontSize: 17,
    fontWeight: '600',
  },
  footerText: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 32,
    lineHeight: 18,
  },
});
