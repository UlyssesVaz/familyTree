/**
 * Join/Claim Profile Screen
 * 
 * Handles invitation links for claiming ancestor profiles.
 * Route: /join/[token]
 * Deep link: familytreeapp://join/[token]
 * 
 * SECURITY: Implements proper error handling and state management to prevent
 * profile hijacking and provide clear user feedback.
 * 
 * Flow:
 * 1. User clicks invitation link
 * 2. Screen validates token (pre-auth)
 * 3. Shows invitation details (person name, family tree info)
 * 4. User signs in (if needed)
 * 5. User clicks "Accept" → atomic claim operation
 * 6. Profile's linked_auth_user_id is set, invitation is deleted
 * 7. User is redirected to their profile
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/contexts/auth-context';
import GoogleSignInButton from '@/components/auth';

const AGE_GATE_STORAGE_KEY = '@familytree:age_gate_passed';
import { 
  validateInvitationToken, 
  claimInvitationLink,
  InvitationError,
  type InvitationDetails 
} from '@/services/supabase/invitations-api';
import { useSessionStore } from '@/stores/session-store';
import { usePeopleStore } from '@/stores/people-store';

type ScreenState = 
  | 'loading'           // Initial load, validating token
  | 'invalid'          // Token is invalid or expired
  | 'already_claimed'  // Profile was already claimed by someone
  | 'ready'            // Valid token, waiting for user action
  | 'signing_in'       // User is signing in with Google
  | 'claiming'         // Claiming the profile
  | 'success'          // Successfully claimed
  | 'error';           // An error occurred during claim

export default function JoinScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string }>();
  const token = params.token;
  const colorScheme = useColorScheme();
  const theme = colorScheme ?? 'light';
  const colors = Colors[theme];
  const { session, signInWithProvider } = useAuth();

  const [screenState, setScreenState] = useState<ScreenState>('loading');
  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const hasAttemptedClaimRef = useRef(false); // Prevent double-claiming

  // Pre-auth validation using validateInvitationToken + age gate check
  useEffect(() => {
    async function validateToken() {
      if (!token) {
        setScreenState('invalid');
        setErrorMessage('No invitation token provided');
        return;
      }

      try {
        // COPPA Compliance: Check if age gate has been passed
        // If not, redirect to age gate first (with redirect param to come back here)
        const ageGatePassed = await AsyncStorage.getItem(AGE_GATE_STORAGE_KEY);
        if (ageGatePassed !== 'true') {
          // Age gate not passed - redirect to age gate with redirect param
          router.replace(`/(auth)/age-gate?redirect=/join/${token}`);
          return;
        }

        const result = await validateInvitationToken(token);
        
        if (!result.isValid) {
          if (result.isAlreadyClaimed) {
            setScreenState('already_claimed');
            setErrorMessage('This profile has already been claimed by another user.');
          } else {
            setScreenState('invalid');
            setErrorMessage(
              result.errorCode === 'EXPIRED'
                ? 'This invitation link has expired. Please request a new one.'
                : 'This invitation link is invalid or has been used.'
            );
          }
          return;
        }
        
        // Token is valid
        if (result.invitation) {
          setInvitation(result.invitation);
          setScreenState('ready');
        } else {
          setScreenState('invalid');
          setErrorMessage('Invalid invitation details');
        }
      } catch (err: any) {
        console.error('[JoinScreen] Error validating token:', err);
        setScreenState('invalid');
        setErrorMessage('Failed to validate invitation. Please try again.');
      }
    }

    validateToken();
  }, [token, router]);

  // Handle claiming the profile (after user is authenticated)
  const handleClaimProfile = useCallback(async () => {
    if (!token || !invitation || !session?.user?.id) return;
    if (hasAttemptedClaimRef.current) return; // Prevent double-claiming

    hasAttemptedClaimRef.current = true;
    setScreenState('claiming');
    setErrorMessage(null);
    
    try {
      const result = await claimInvitationLink({
        token: token,
        userId: session.user.id,
      });

      // Success!
      setScreenState('success');
      
      // Refresh family tree to load the claimed profile
      // CRITICAL: Wait for sync to complete before navigating
      try {
        await useSessionStore.getState().syncFamilyTree(session.user.id);
        
        // Verify ego is loaded
        const ego = useSessionStore.getState().getEgo();
        if (!ego) {
          throw new Error('Failed to load profile after claim');
        }
        
        // Verify people are loaded
        const peopleCount = usePeopleStore.getState().people.size;
        if (peopleCount === 0) {
          throw new Error('Failed to load family tree after claim');
        }
        
        if (__DEV__) {
          console.log(`[JoinScreen] Sync verified: ego=${ego.name}, people=${peopleCount}`);
        }
        
        // Navigate with success feedback (shorter delay since we know data is loaded)
        setTimeout(() => {
          router.replace('/(tabs)');
        }, 800);
        
      } catch (syncError: any) {
        console.error('[JoinScreen] Error after claim:', syncError);
        setScreenState('error');
        setErrorMessage('Your profile was claimed but we couldn\'t load your family tree. Please restart the app.');
        hasAttemptedClaimRef.current = false; // Allow retry
      }
    } catch (err: any) {
      console.error('[JoinScreen] Error claiming invitation:', err);
      
      if (err instanceof InvitationError) {
        switch (err.code) {
          case 'ALREADY_CLAIMED':
            setScreenState('already_claimed');
            setErrorMessage(err.userMessage);
            break;
          case 'EXPIRED':
          case 'INVALID_TOKEN':
            setScreenState('invalid');
            setErrorMessage(err.userMessage);
            break;
          case 'USER_HAS_PROFILE':
            // User already has a profile - redirect to home
            setScreenState('error');
            setErrorMessage(err.userMessage);
            setTimeout(() => router.replace('/(tabs)'), 2000);
            break;
          case 'NETWORK_ERROR':
            setScreenState('error');
            setErrorMessage(err.userMessage);
            hasAttemptedClaimRef.current = false; // Allow retry
            break;
          default:
            setScreenState('error');
            setErrorMessage(err.userMessage || 'Failed to claim profile. Please try again.');
            hasAttemptedClaimRef.current = false; // Allow retry
        }
      } else {
        setScreenState('error');
        setErrorMessage(err.message || 'An unexpected error occurred. Please try again.');
        hasAttemptedClaimRef.current = false; // Allow retry
      }
    }
  }, [token, invitation, session?.user?.id, router]);

  // Handle Google sign-in button press
  const handleGoogleSignIn = async () => {
    if (!token || !invitation) return;
    
    setScreenState('signing_in');
    setErrorMessage(null);
    
    try {
      await signInWithProvider('google');
      // After sign-in, the auth context will update and we can claim
      // We'll handle the claim in a useEffect that watches session
    } catch (err: any) {
      console.error('[JoinScreen] Error signing in:', err);
      setScreenState('ready'); // Return to ready state
      setErrorMessage(err.message || 'Failed to sign in. Please try again.');
    }
  };

  // Watch for session changes (after sign-in) - automatically claim profile
  useEffect(() => {
    if (session?.user?.id && invitation && screenState === 'ready' && !hasAttemptedClaimRef.current) {
      // User just signed in, now claim the profile automatically
      handleClaimProfile();
    }
  }, [session?.user?.id, invitation, screenState, handleClaimProfile]);

  // Loading state
  if (screenState === 'loading') {
    return (
      <ThemedView style={styles.container}>
        <ActivityIndicator size="large" color={colors.tint} />
        <ThemedText style={styles.loadingText}>Validating invitation...</ThemedText>
      </ThemedView>
    );
  }

  // Invalid token state
  if (screenState === 'invalid') {
    return (
      <ThemedView style={styles.container}>
        <MaterialIcons name="error-outline" size={64} color={colors.error || '#FF3B30'} />
        <ThemedText type="defaultSemiBold" style={styles.errorTitle}>
          Invalid Invitation
        </ThemedText>
        <ThemedText style={styles.errorText}>{errorMessage || 'This invitation link is invalid or has expired.'}</ThemedText>
        <Pressable
          onPress={() => router.replace('/(tabs)')}
          style={[styles.button, { backgroundColor: colors.tint }]}
        >
          <ThemedText style={styles.buttonText}>Go Home</ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  // Already claimed state
  if (screenState === 'already_claimed') {
    return (
      <ThemedView style={styles.container}>
        <MaterialIcons name="person-off" size={64} color={colors.error || '#FF3B30'} />
        <ThemedText type="defaultSemiBold" style={styles.errorTitle}>
          Already Claimed
        </ThemedText>
        <ThemedText style={styles.errorText}>
          {errorMessage || 'This profile has already been claimed by another user.'}
        </ThemedText>
        <Pressable
          onPress={() => router.replace('/(tabs)')}
          style={[styles.button, { backgroundColor: colors.tint }]}
        >
          <ThemedText style={styles.buttonText}>Go Home</ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  // Success state
  if (screenState === 'success') {
    return (
      <ThemedView style={styles.container}>
        <MaterialIcons name="check-circle" size={64} color={colors.tint} />
        <ThemedText type="defaultSemiBold" style={styles.successTitle}>
          Success!
        </ThemedText>
        <ThemedText style={styles.successText}>
          You have successfully claimed {invitation?.personName || 'this profile'}!
        </ThemedText>
        <ActivityIndicator size="small" color={colors.tint} style={styles.successSpinner} />
      </ThemedView>
    );
  }

  // Ready/Error state - show invitation details
  return (
    <ThemedView style={styles.container}>
      <MaterialIcons name="person-add" size={64} color={colors.tint} />
      
      <ThemedText type="title" style={styles.title}>
        You've Been Invited!
      </ThemedText>

      <ThemedText style={styles.description}>
        You've been invited to claim {invitation?.personName || 'this profile'} in the family tree.
        Join to see and contribute to your shared family history!
      </ThemedText>

      {errorMessage && screenState === 'error' && (
        <View style={[styles.errorBanner, { backgroundColor: colors.error || '#FF3B30' }]}>
          <MaterialIcons name="error-outline" size={20} color="#FFFFFF" />
          <ThemedText style={styles.errorBannerText}>{errorMessage}</ThemedText>
        </View>
      )}

      <View style={styles.buttonContainer}>
        {!session?.user?.id ? (
          // Show Google Sign-In button if not authenticated
          <>
            <GoogleSignInButton
              onSignInSuccess={() => {
                // Sign-in success is handled by useEffect watching session
                setScreenState('ready');
              }}
            />
            {screenState === 'signing_in' && (
              <View style={styles.signingInContainer}>
                <ActivityIndicator size="small" color={colors.tint} />
                <ThemedText style={styles.signingInText}>Signing in...</ThemedText>
              </View>
            )}
          </>
        ) : (
          // Show Accept button if already authenticated
          <Pressable
            onPress={handleClaimProfile}
            disabled={screenState === 'claiming'}
            style={[
              styles.button,
              styles.primaryButton,
              { backgroundColor: colors.tint },
              screenState === 'claiming' && styles.buttonDisabled,
            ]}
          >
            {screenState === 'claiming' ? (
              <>
                <ActivityIndicator size="small" color="#FFFFFF" />
                <ThemedText style={styles.buttonText}>Claiming...</ThemedText>
              </>
            ) : (
              <ThemedText style={styles.buttonText}>
                Accept Invitation
              </ThemedText>
            )}
          </Pressable>
        )}

        <Pressable
          onPress={() => router.replace('/(tabs)')}
          style={[styles.button, styles.secondaryButton]}
        >
          <ThemedText style={[styles.buttonText, { color: colors.text }]}>
            Cancel
          </ThemedText>
        </Pressable>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  title: {
    fontSize: 28,
    marginTop: 24,
    marginBottom: 16,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  errorTitle: {
    fontSize: 24,
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    opacity: 0.7,
  },
  successTitle: {
    fontSize: 24,
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  successText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  successSpinner: {
    marginTop: 16,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
    width: '100%',
  },
  errorBannerText: {
    color: '#FFFFFF',
    fontSize: 14,
    flex: 1,
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  button: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    flexDirection: 'row',
    gap: 8,
  },
  primaryButton: {
    // backgroundColor set dynamically
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  signingInContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  signingInText: {
    fontSize: 14,
    opacity: 0.7,
  },
});
