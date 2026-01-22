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
    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/f336e8f0-8f7a-40aa-8f54-32371722b5de',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth.tsx:182',message:'Apple Sign-In availability check starting',data:{platform:Platform.OS},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    if (Platform.OS === 'ios') {
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/f336e8f0-8f7a-40aa-8f54-32371722b5de',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth.tsx:185',message:'Platform is iOS, checking availability',data:{platform:Platform.OS},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      AppleAuthentication.isAvailableAsync()
        .then((available) => {
          // #region agent log
          fetch('http://127.0.0.1:7244/ingest/f336e8f0-8f7a-40aa-8f54-32371722b5de',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth.tsx:188',message:'Apple availability check result',data:{available,platform:Platform.OS},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
          // #endregion
          if (__DEV__) {
            console.log('[AppleSignIn] Availability check:', available);
          }
          setIsAppleAvailable(available);
        })
        .catch((error) => {
          // #region agent log
          fetch('http://127.0.0.1:7244/ingest/f336e8f0-8f7a-40aa-8f54-32371722b5de',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth.tsx:193',message:'Apple availability check error',data:{error:error?.message||String(error),platform:Platform.OS},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
          // #endregion
          console.error('[AppleSignIn] Error checking availability:', error);
          setIsAppleAvailable(false);
        })
        .finally(() => {
          // #region agent log
          fetch('http://127.0.0.1:7244/ingest/f336e8f0-8f7a-40aa-8f54-32371722b5de',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth.tsx:197',message:'Apple availability check completed',data:{platform:Platform.OS},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
          // #endregion
          setIsChecking(false);
        });
    } else {
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/f336e8f0-8f7a-40aa-8f54-32371722b5de',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth.tsx:200',message:'Not iOS platform, skipping check',data:{platform:Platform.OS},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      // Not iOS, skip check
      setIsChecking(false);
    }
  }, []);
  
  const handleAppleSignIn = async () => {
    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/f336e8f0-8f7a-40aa-8f54-32371722b5de',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth.tsx:222',message:'Apple Sign-In button pressed',data:{isLoading,disabled},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
    // #endregion
    if (isLoading || disabled) return;
    
    setIsLoading(true);
    try {
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/f336e8f0-8f7a-40aa-8f54-32371722b5de',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth.tsx:228',message:'Calling AppleAuthentication.signInAsync',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      // Request Apple authentication
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/f336e8f0-8f7a-40aa-8f54-32371722b5de',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth.tsx:237',message:'Apple sign-in credential received',data:{hasIdentityToken:!!credential.identityToken,hasEmail:!!credential.email,user:credential.user},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      
      if (!credential.identityToken) {
        throw new Error('No identity token received from Apple');
      }
      
      if (__DEV__) {
        console.log('[AppleSignIn] Got identity token, signing in to Supabase...');
      }
      
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/f336e8f0-8f7a-40aa-8f54-32371722b5de',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth.tsx:245',message:'Calling authService.signInWithIdToken',data:{provider:'apple'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      // Sign in to Supabase with Apple ID token (same pattern as Google)
      const authService = getAuthService();
      await authService.signInWithIdToken('apple', credential.identityToken);
      
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/f336e8f0-8f7a-40aa-8f54-32371722b5de',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth.tsx:249',message:'Apple Sign-In successful',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      
      if (__DEV__) {
        console.log('[AppleSignIn] Successfully authenticated');
      }
      
      onSignInSuccess?.();
    } catch (error: any) {
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/f336e8f0-8f7a-40aa-8f54-32371722b5de',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth.tsx:252',message:'Apple Sign-In error',data:{error:error?.message||String(error),code:error?.code},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      console.error('[AppleSignIn] Error:', error);
      
      // Handle Apple-specific errors (per Expo docs: ERR_REQUEST_CANCELED)
      if (error.code === 'ERR_REQUEST_CANCELED' || error.code === 'ERR_CANCELED') {
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
    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/f336e8f0-8f7a-40aa-8f54-32371722b5de',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth.tsx:252',message:'Still checking availability, returning null',data:{isChecking,isAppleAvailable,platform:Platform.OS},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    // Wait for availability check to complete
    return null;
  }
  
  // Don't render on Android or if Apple Sign-In is not available
  if (!isAppleAvailable || Platform.OS !== 'ios') {
    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/f336e8f0-8f7a-40aa-8f54-32371722b5de',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth.tsx:258',message:'Not rendering Apple button - conditions not met',data:{isAppleAvailable,platform:Platform.OS,isChecking},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    if (__DEV__) {
      console.log('[AppleSignIn] Not rendering button:', { 
        isAppleAvailable, 
        platform: Platform.OS 
      });
    }
    return null;
  }
  
  // #region agent log
  fetch('http://127.0.0.1:7244/ingest/f336e8f0-8f7a-40aa-8f54-32371722b5de',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth.tsx:268',message:'Rendering Apple Sign-In button',data:{isAppleAvailable,platform:Platform.OS,isChecking},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  
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
