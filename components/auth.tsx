/**
 * Authentication Components
 * 
 * Provides Google Sign-In and Apple Sign-In buttons for authentication.
 * - Google Sign-In uses OAuth redirect via auth context
 * - Apple Sign-In uses native expo-apple-authentication (iOS only)
 * 
 * NOTE: Apple Sign-In allows users to "Hide My Email" which means we get
 * a relay email address (like abc123@privaterelay.appleid.com) instead of
 * the user's real email. This is handled by Supabase automatically.
 */

import React, { useState, useEffect } from 'react';
import { View, Pressable, StyleSheet, Alert, Platform, ActivityIndicator } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getAuthService } from '@/services/auth';
import { 
  GoogleSignin,
  statusCodes,
  type SignInResponse,
  type SignInSuccessResponse,
} from '@react-native-google-signin/google-signin';

// ✅ Google OAuth Client IDs
const WEB_CLIENT_ID = '25937956656-3d4qou777vqqlsfkbm00862chepv03t9.apps.googleusercontent.com';
const IOS_CLIENT_ID = '25937956656-a8ksba4gi4il4j7vms40ftu0cu91dbgu.apps.googleusercontent.com';

/**
 * Google Sign-In Button Component
 * 
 * Uses native Google Sign-In SDK to get ID token, then passes to Supabase.
 * This is the original implementation that was working.
 */
export default function GoogleSignInButton({ 
  onSignInSuccess, 
  onSignInError,
  disabled = false 
}: { 
  onSignInSuccess?: () => void;
  onSignInError?: (error: Error) => void;
  disabled?: boolean;
}) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [isLoading, setIsLoading] = useState(false);
  
  // ✅ CRITICAL: Configure Google Sign-In on mount
  useEffect(() => {
    GoogleSignin.configure({
      webClientId: WEB_CLIENT_ID,
      iosClientId: IOS_CLIENT_ID,
      scopes: ['email', 'profile'],
      offlineAccess: false,
    });
  }, []);
  
  const handleGoogleSignIn = async () => {
    if (disabled || isLoading) return;
    
    setIsLoading(true);
    try {
      // Check Play Services (Android)
      if (Platform.OS === 'android') {
        await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      }
      
      // ✅ Sign in with Google SDK - this returns the response with ID token
      const signInResponse: SignInResponse = await GoogleSignin.signIn();
      
      // Check if sign-in was cancelled
      if (signInResponse.type !== 'success') {
        throw new Error('Google sign-in was cancelled or failed');
      }
      
      // Extract ID token from the response
      const successResponse = signInResponse as SignInSuccessResponse;
      const userData = successResponse.data;
      const idToken = userData.idToken;
      
      if (!idToken) {
        throw new Error('No ID token received from Google Sign-In. Make sure webClientId is configured correctly.');
      }
      
      if (__DEV__) {
        console.log('[GoogleSignIn] Got ID token, signing in to Supabase...');
      }
      
      // ✅ Sign in to Supabase with the ID token
      const authService = getAuthService();
      await authService.signInWithIdToken('google', idToken);
      
      if (__DEV__) {
        console.log('[GoogleSignIn] Successfully authenticated with Supabase');
      }
      
      onSignInSuccess?.();
    } catch (error: any) {
      console.error('[GoogleSignIn] Sign-in error:', error);
      
      // Handle specific Google Sign-In errors
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        console.log('[GoogleSignIn] User cancelled sign-in');
        return; // User cancelled, don't show error
      } else if (error.code === statusCodes.IN_PROGRESS) {
        console.log('[GoogleSignIn] Sign-in already in progress');
        return;
      } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        Alert.alert(
          'Google Play Services Required',
          'Google Play Services is required for Google Sign-In. Please update Google Play Services and try again.'
        );
        onSignInError?.(new Error('Google Play Services not available'));
        return;
      }
      
      const errorMessage = error.message || 'Could not sign in with Google';
      Alert.alert('Sign In Failed', errorMessage);
      onSignInError?.(error instanceof Error ? error : new Error(errorMessage));
    } finally {
      setIsLoading(false);
    }
  };
  
  
  return (
    <Pressable
      onPress={handleGoogleSignIn}
      disabled={disabled || isLoading}
      style={[
        styles.googleButton,
        { 
          backgroundColor: colors.background,
          borderColor: colors.icon || '#E0E0E0',
        },
        (disabled || isLoading) && styles.buttonDisabled
      ]}
    >
      {isLoading ? (
        <ActivityIndicator size="small" color={colors.text} />
      ) : (
        <>
          <MaterialIcons name="login" size={20} color={colors.text} />
          <ThemedText style={[styles.googleButtonText, { color: colors.text }]}>
            Continue with Google
          </ThemedText>
        </>
      )}
    </Pressable>
  );
}

/**
 * Apple Sign-In Button Component
 * 
 * iOS-only native Apple Sign-In button.
 * Uses Apple SDK to get ID token, then passes to Supabase signInWithIdToken().
 * 
 * IMPORTANT: Apple Sign-In allows users to "Hide My Email" which means
 * Supabase will receive a relay email address (e.g., abc123@privaterelay.appleid.com)
 * instead of the user's real email. This is handled automatically by Supabase.
 * The relay email is stable and unique per user.
 */
export function AppleSignInButton({ 
  onSignInSuccess,
  onSignInError,
  disabled = false 
}: { 
  onSignInSuccess?: () => void;
  onSignInError?: (error: Error) => void;
  disabled?: boolean;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [isAppleAvailable, setIsAppleAvailable] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  
  // Check if Apple Sign-In is available (iOS 13+)
  useEffect(() => {
    if (Platform.OS === 'ios') {
      AppleAuthentication.isAvailableAsync()
        .then((available) => {
          if (__DEV__) {
            console.log('[AppleSignIn] Availability check:', available);
          }
          setIsAppleAvailable(available);
        })
        .catch((error) => {
          console.error('[AppleSignIn] Error checking availability:', error);
          setIsAppleAvailable(false);
        })
        .finally(() => {
          setIsChecking(false);
        });
    } else {
      // Not iOS, skip check
      setIsChecking(false);
    }
  }, []);
  
  const handleAppleSignIn = async () => {
    if (isLoading || disabled) return;
    
    setIsLoading(true);
    try {
      // Request Apple authentication
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      
      if (!credential.identityToken) {
        throw new Error('No identity token received from Apple');
      }
      
      if (__DEV__) {
        console.log('[AppleSignIn] Got identity token, signing in to Supabase...');
      }
      
      // Sign in to Supabase with Apple ID token (same pattern as Google)
      const authService = getAuthService();
      await authService.signInWithIdToken('apple', credential.identityToken);
      
      if (__DEV__) {
        console.log('[AppleSignIn] Successfully authenticated');
      }
      
      onSignInSuccess?.();
    } catch (error: any) {
      console.error('[AppleSignIn] Error:', error);
      
      // Handle Apple-specific errors
      if (error.code === 'ERR_CANCELED') {
        console.log('[AppleSignIn] User cancelled sign-in');
        return; // User cancelled, don't show error
      }
      
      const errorMessage = error.message || 'Apple sign-in failed';
      Alert.alert('Sign In Failed', errorMessage);
      onSignInError?.(error instanceof Error ? error : new Error(errorMessage));
    } finally {
      setIsLoading(false);
    }
  };
  
  // Don't render while checking or if not available or not iOS
  if (isChecking) {
    // Wait for availability check to complete
    return null;
  }
  
  // Don't render on Android or if Apple Sign-In is not available
  if (!isAppleAvailable || Platform.OS !== 'ios') {
    if (__DEV__) {
      console.log('[AppleSignIn] Not rendering button:', { 
        isAppleAvailable, 
        platform: Platform.OS 
      });
    }
    return null;
  }
  
  // iOS native button (REQUIRED for App Store)
  return (
    <View style={isLoading && { opacity: 0.5 }}>
      <AppleAuthentication.AppleAuthenticationButton
        buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
        buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
        cornerRadius={8}
        style={{ width: '100%', height: 50 }}
        onPress={isLoading ? () => {} : handleAppleSignIn}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 50,
    gap: 12,
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  appleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: '#000000',
    minHeight: 50,
    gap: 12,
  },
  appleButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
