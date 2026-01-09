/**
 * OAuth Callback Handler
 * 
 * Handles OAuth redirects from Supabase after Google SSO sign-in.
 * Supabase automatically completes the session when the deep link is received.
 * This route simply checks for the session and redirects appropriately.
 */

import { useEffect, useState } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { getSupabaseClient } from '@/services/supabase/supabase-init';

export default function AuthCallback() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const supabase = getSupabaseClient();
  const [status, setStatus] = useState<'checking' | 'success' | 'error'>('checking');

  useEffect(() => {
    async function handleCallback() {
      try {
        // Supabase automatically handles the session from deep link
        // Check if we have a session now
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('[AuthCallback] Error getting session:', error);
          setStatus('error');
          // Wait a moment before redirecting to show error state
          setTimeout(() => {
            router.replace('/(auth)/login');
          }, 2000);
          return;
        }

        if (session) {
          // Success! Session is available
          setStatus('success');
          // Small delay to show success state, then redirect
          setTimeout(() => {
            router.replace('/(tabs)');
          }, 500);
        } else {
          // No session yet - might still be processing
          // Wait a moment and check again (deep link might be delayed)
          await new Promise(resolve => setTimeout(resolve, 1500));
          
          const { data: { session: retrySession }, error: retryError } = await supabase.auth.getSession();
          
          if (retryError) {
            console.error('[AuthCallback] Retry error:', retryError);
            setStatus('error');
            setTimeout(() => {
              router.replace('/(auth)/login');
            }, 2000);
            return;
          }
          
          if (retrySession) {
            setStatus('success');
            setTimeout(() => {
              router.replace('/(tabs)');
            }, 500);
          } else {
            // Still no session - redirect to login
            console.warn('[AuthCallback] No session found after retry');
            setStatus('error');
            setTimeout(() => {
              router.replace('/(auth)/login');
            }, 2000);
          }
        }
      } catch (error) {
        console.error('[AuthCallback] Unexpected error:', error);
        setStatus('error');
        setTimeout(() => {
          router.replace('/(auth)/login');
        }, 2000);
      }
    }

    handleCallback();
  }, [params, router, supabase]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#007AFF" />
      <Text style={styles.text}>
        {status === 'checking' && 'Completing sign in...'}
        {status === 'success' && 'Sign in successful!'}
        {status === 'error' && 'Sign in failed. Redirecting...'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  text: {
    marginTop: 16,
    fontSize: 16,
    color: '#333',
  },
});

