/**
 * Join/Claim Profile Screen
 * 
 * Handles invitation links for claiming ancestor profiles.
 * Route: /join/[token]
 * Deep link: familytreeapp://join/[token]
 * 
 * Flow:
 * 1. User clicks invitation link
 * 2. This screen shows invitation details (person name, family tree info)
 * 3. User clicks "Accept" → triggers auth flow
 * 4. After auth, claimInvitationLink() is called
 * 5. Profile's linked_auth_user_id is set, invitation is deleted
 * 6. User is redirected to their profile
 */

import { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Pressable, Alert, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/contexts/auth-context';
import GoogleSignInButton from '@/components/auth';
import { getInvitationLink, claimInvitationLink } from '@/services/supabase/invitations-api';
import { getUserProfile } from '@/services/supabase/people-api';
import { useFamilyTreeStore } from '@/stores/family-tree-store';

export default function JoinScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string }>();
  const token = params.token;
  const colorScheme = useColorScheme();
  const theme = colorScheme ?? 'light';
  const colors = Colors[theme];
  const { session, signInWithProvider } = useAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [isClaiming, setIsClaiming] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [invitation, setInvitation] = useState<{
    targetPersonId: string;
    personName: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hasAttemptedClaimRef = useRef(false); // Prevent double-claiming

  // Load invitation details
  useEffect(() => {
    async function loadInvitation() {
      if (!token) {
        setError('No invitation token provided');
        setIsLoading(false);
        return;
      }

      try {
        const invitationLink = await getInvitationLink(token);
        
        if (!invitationLink) {
          setError('Invalid or expired invitation link');
          setIsLoading(false);
          return;
        }

        // Get person details to show name
        // Note: We need to fetch person by user_id (target_person_id)
        // For now, we'll just show a generic message
        // TODO: Add API to get person by user_id without auth check for invitation flow
        setInvitation({
          targetPersonId: invitationLink.targetPersonId,
          personName: 'this profile', // Will be improved in next phase
        });
        setIsLoading(false);
      } catch (err: any) {
        console.error('[JoinScreen] Error loading invitation:', err);
        setError(err.message || 'Failed to load invitation');
        setIsLoading(false);
      }
    }

    loadInvitation();
  }, [token]);

  // Handle claiming the profile (after user is authenticated)
  const handleClaimProfile = async () => {
    if (!token || !invitation || !session?.user?.id) return;
    if (hasAttemptedClaimRef.current) return; // Prevent double-claiming

    hasAttemptedClaimRef.current = true;
    setIsClaiming(true);
    
    try {
      await claimInvitationLink({
        token: token,
        userId: session.user.id,
      });

      // Success! Redirect to profile
      Alert.alert(
        'Success!',
        'You have successfully claimed your profile!',
        [
          {
            text: 'OK',
            onPress: () => {
              // Refresh family tree to load the claimed profile
              useFamilyTreeStore.getState().syncFamilyTree(session.user.id);
              // Navigate to home
              router.replace('/(tabs)');
            },
          },
        ]
      );
    } catch (err: any) {
      console.error('[JoinScreen] Error claiming invitation:', err);
      Alert.alert('Error', err.message || 'Failed to claim profile. Please try again.');
      setIsClaiming(false);
      hasAttemptedClaimRef.current = false; // Allow retry
    }
  };

  // Handle Google sign-in button press
  const handleGoogleSignIn = async () => {
    if (!token || !invitation) return;
    
    setIsSigningIn(true);
    try {
      await signInWithProvider('google');
      // After sign-in, the auth context will update and we can claim
      // We'll handle the claim in a useEffect that watches session
    } catch (err: any) {
      console.error('[JoinScreen] Error signing in:', err);
      Alert.alert('Error', err.message || 'Failed to sign in. Please try again.');
      setIsSigningIn(false);
    }
  };

  // Watch for session changes (after sign-in) - automatically claim profile
  useEffect(() => {
    if (session?.user?.id && invitation && !isClaiming && !hasAttemptedClaimRef.current) {
      // User just signed in, now claim the profile automatically
      setIsSigningIn(false);
      handleClaimProfile();
    }
  }, [session?.user?.id, invitation]);

  if (isLoading) {
    return (
      <ThemedView style={styles.container}>
        <ActivityIndicator size="large" color={colors.tint} />
        <ThemedText style={styles.loadingText}>Loading invitation...</ThemedText>
      </ThemedView>
    );
  }

  if (error) {
    return (
      <ThemedView style={styles.container}>
        <MaterialIcons name="error-outline" size={64} color={colors.error || '#FF3B30'} />
        <ThemedText type="defaultSemiBold" style={styles.errorTitle}>
          Invalid Invitation
        </ThemedText>
        <ThemedText style={styles.errorText}>{error}</ThemedText>
        <Pressable
          onPress={() => router.replace('/(tabs)')}
          style={[styles.button, { backgroundColor: colors.tint }]}
        >
          <ThemedText style={styles.buttonText}>Go Home</ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <MaterialIcons name="person-add" size={64} color={colors.tint} />
      
      <ThemedText type="title" style={styles.title}>
        You've Been Invited!
      </ThemedText>

      <ThemedText style={styles.description}>
        You've been invited to claim {invitation?.personName} in the family tree.
        Join to see and contribute to your shared family history!
      </ThemedText>

      <View style={styles.buttonContainer}>
        {!session?.user?.id ? (
          // Show Google Sign-In button if not authenticated
          <>
            <GoogleSignInButton
              onSignInSuccess={() => {
                // Sign-in success is handled by useEffect watching session
                setIsSigningIn(false);
              }}
            />
            {isSigningIn && (
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
            disabled={isClaiming}
            style={[
              styles.button,
              styles.primaryButton,
              { backgroundColor: colors.tint },
              isClaiming && styles.buttonDisabled,
            ]}
          >
            {isClaiming ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
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
