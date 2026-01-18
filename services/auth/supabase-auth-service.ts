/**
 * Supabase Auth Service Implementation
 * 
 * Implements the AuthService interface using Supabase Auth.
 * Google SSO only - email/password authentication is not supported.
 * 
 * OAuth flow:
 * - Opens browser for Google sign-in
 * - Redirects back to app via deep link (familytreeapp://auth/callback)
 * - Supabase automatically completes session
 * - Callback handler (app/(auth)/callback.tsx) manages navigation
 */

import { AuthService, AuthSession, AuthProvider, User, AuthError } from './types';
import { getSupabaseClient } from '../supabase/supabase-init';
import * as Linking from 'expo-linking';

export class SupabaseAuthService implements AuthService {
  private supabase: ReturnType<typeof getSupabaseClient> | null = null;
  private authStateUnsubscribe: (() => void) | null = null;
  private isSigningOut: boolean = false; // Flag to prevent auto-restore during sign out

  // Lazy getter for Supabase client to prevent crashes if credentials are missing
  private getSupabase() {
    if (!this.supabase) {
      try {
        this.supabase = getSupabaseClient();
      } catch (error) {
        console.error('[SupabaseAuth] Failed to initialize Supabase:', error);
        throw error;
      }
    }
    return this.supabase;
  }

  async isAuthenticated(): Promise<boolean> {
    try {
      const supabase = this.getSupabase();
      const { data: { session } } = await supabase.auth.getSession();
      return session !== null;
    } catch (error) {
      console.error('[SupabaseAuth] Error checking authentication:', error);
      return false;
    }
  }

  async getCurrentSession(): Promise<AuthSession | null> {
    try {
      const supabase = this.getSupabase();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || !session.user) {
        return null;
      }

      return this.supabaseSessionToAuthSession(session);
    } catch (error) {
      console.error('[SupabaseAuth] Error getting current session:', error);
      return null;
    }
  }

  async signInWithProvider(provider: AuthProvider): Promise<AuthSession> {
    // For Google, use native sign-in with ID token (handled by components/Auth.tsx)
    // This OAuth flow is for web-based OAuth if needed in the future
    if (provider === 'google') {
      throw {
        code: 'native_signin_required',
        message: 'Google sign-in must use native Google Sign-In SDK. Use signInWithIdToken() instead.',
        provider: 'google',
      } as AuthError;
    }

    try {
      const redirectUrl = Linking.createURL('/auth/callback');
      const supabase = this.getSupabase();
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: provider === 'google' ? 'google' : provider,
        options: {
          redirectTo: redirectUrl,
        },
      });

      if (error) throw error;

      // OAuth flow:
      // 1. Opens browser for user to sign in with provider
      // 2. Provider redirects back to app via deep link
      // 3. Supabase automatically completes the session when deep link is received
      // 4. The callback route (app/(auth)/callback.tsx) handles navigation
      
      // Poll for session (gives the deep link time to complete)
      // The callback handler will also check, but we poll here as a fallback
      for (let i = 0; i < 20; i++) {
        await new Promise(resolve => setTimeout(resolve, 500));
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          return this.supabaseSessionToAuthSession(session);
        }
      }
      
      // If no session after polling, the OAuth flow is still in progress
      // The callback handler will complete it when the deep link arrives
      throw new Error('OAuth sign-in in progress. Please complete the sign-in in your browser.');
    } catch (error: any) {
      throw this.handleError(error, provider);
    }
  }

  async signInWithIdToken(provider: AuthProvider, idToken: string): Promise<AuthSession> {
    try {
      // Support both Google and Apple (and any OIDC provider)
      if (provider !== 'google' && provider !== 'apple') {
        throw {
          code: 'unsupported_provider',
          message: `signInWithIdToken is only supported for Google and Apple providers. Got: ${provider}`,
          provider,
        } as AuthError;
      }

      const supabase = this.getSupabase();
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: provider, // Use the provided provider (google or apple)
        token: idToken,
      });

      if (error) {
        console.error('[SupabaseAuth] signInWithIdToken error:', error);
        throw error;
      }

      if (!data.session) {
        throw {
          code: 'no_session',
          message: 'Sign-in succeeded but no session was returned',
          provider: 'google',
        } as AuthError;
      }

      return this.supabaseSessionToAuthSession(data.session);
    } catch (error: any) {
      // If it's already an AuthError, rethrow it
      if (error.code && error.message) {
        throw error;
      }
      // Otherwise, wrap it
      throw this.handleError(error, provider);
    }
  }

  async signInWithEmail(email: string, password: string): Promise<AuthSession> {
    // Email/password authentication is not supported - Google SSO only
    throw {
      code: 'not_supported',
      message: 'Email/password authentication is not available. Please use Google SSO.',
    } as AuthError;
  }

  async signUpWithEmail(email: string, password: string, name?: string): Promise<AuthSession> {
    // Email/password authentication is not supported - Google SSO only
    throw {
      code: 'not_supported',
      message: 'Email/password authentication is not available. Please use Google SSO.',
    } as AuthError;
  }

  async signOut(): Promise<void> {
    try {
      // Set flag to prevent auto-restore during sign out
      this.isSigningOut = true;
      
      const supabase = this.getSupabase();
      
      // Sign out from Google Sign-In SDK FIRST (clears cached credentials)
      // This prevents auto-sign-in when Supabase checks for existing session
      try {
        const { GoogleSignin } = await import('@react-native-google-signin/google-signin');
        await GoogleSignin.signOut();
        console.log('[SupabaseAuth] Signed out from Google Sign-In SDK - cached credentials cleared');
      } catch (googleError) {
        // If Google Sign-In sign-out fails, log but continue
        // We still want to sign out from Supabase
        console.warn('[SupabaseAuth] Failed to sign out from Google Sign-In SDK:', googleError);
      }
      
      // Sign out from Supabase (clears session from AsyncStorage)
      // This removes the stored session token, preventing auto-restore
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) throw error;
      
      console.log('[SupabaseAuth] Signed out from Supabase - session cleared from AsyncStorage');
      
      // Verify session is actually cleared (defensive check)
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        console.warn('[SupabaseAuth] WARNING: Session still exists after signOut. This should not happen.');
      }
      
      // Clear flag after sign out completes
      this.isSigningOut = false;
    } catch (error: any) {
      // Clear flag even on error
      this.isSigningOut = false;
      throw this.handleError(error);
    }
  }

  async refreshToken(): Promise<AuthSession | null> {
    try {
      const supabase = this.getSupabase();
      const { data: { session }, error } = await supabase.auth.refreshSession();
      if (error) throw error;
      if (!session) return null;

      return this.supabaseSessionToAuthSession(session);
    } catch (error) {
      console.error('[SupabaseAuth] Error refreshing token:', error);
      return null;
    }
  }

  onAuthStateChanged(callback: (session: AuthSession | null) => void): () => void {
    try {
      const supabase = this.getSupabase();
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (event, session) => {
          // Handle SIGNED_OUT event explicitly - always clear session
          if (event === 'SIGNED_OUT') {
            this.isSigningOut = false; // Reset flag
            callback(null);
            return;
          }
          
          // If we're in the middle of signing out, ignore any session restorations
          // This prevents auto-restore from AsyncStorage during sign out
          if (this.isSigningOut) {
            console.log('[SupabaseAuth] Ignoring auth state change during sign out:', event);
            callback(null);
            return;
          }
          
          // For all other events, use session state
          if (session) {
            callback(this.supabaseSessionToAuthSession(session));
          } else {
            callback(null);
          }
        }
      );

      this.authStateUnsubscribe = () => {
        subscription.unsubscribe();
      };

      return this.authStateUnsubscribe;
    } catch (error) {
      console.error('[SupabaseAuth] Error setting up auth state listener:', error);
      return () => {};
    }
  }

  /**
   * Convert Supabase session to our AuthSession format
   */
  private supabaseSessionToAuthSession(session: any): AuthSession {
    const user = session.user;
    const provider = this.getProviderFromSupabaseUser(user);

    return {
      user: {
        id: user.id,
        email: user.email || null,
        name: user.user_metadata?.name || user.user_metadata?.full_name || null,
        photoUrl: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
        provider,
        emailVerified: user.email_confirmed_at !== null,
      },
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      expiresAt: session.expires_at ? new Date(session.expires_at * 1000) : null,
    };
  }

  /**
   * Get provider from Supabase user
   */
  private getProviderFromSupabaseUser(user: any): AuthProvider {
    // Supabase stores provider in app_metadata or user_metadata
    const provider = user.app_metadata?.provider || user.user_metadata?.provider;
    
    if (provider === 'google') return 'google';
    if (provider === 'microsoft') return 'microsoft';
    if (provider === 'apple') return 'apple';
    if (provider === 'slack') return 'slack';
    
    // Default to email if no provider found
    return 'email';
  }

  /**
   * Handle Supabase errors and convert to AuthError
   */
  private handleError(error: any, provider?: AuthProvider): AuthError {
    return {
      code: error.code || 'unknown',
      message: error.message || 'An error occurred',
      provider,
    };
  }
}


