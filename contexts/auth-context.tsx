/**
 * Auth Context
 * 
 * Provides authentication state and methods throughout the app.
 * Handles session management only.
 * 
 * NOTE: 
 * - Profile checking is handled by ProfileContext (contexts/profile-context.tsx)
 * - Routing guards are handled by AuthGuard component (contexts/guards/auth-guard.tsx)
 */

import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { useRouter } from 'expo-router';
import { AuthSession, AuthProvider as AuthProviderType, AuthError } from '@/services/auth/types';
import { getAuthService } from '@/services/auth';

interface AuthContextType {
  session: AuthSession | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signInWithProvider: (provider: AuthProviderType) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, name?: string) => Promise<void>;
  signOut: () => Promise<void>;
  error: AuthError | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<AuthError | null>(null);
  const router = useRouter();
  const authService = useRef(getAuthService());
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Initialize auth state
  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        // Check if already authenticated
        const currentSession = await authService.current.getCurrentSession();
        
        if (mounted) {
          setSession(currentSession);
          setIsLoading(false);
        }
      } catch (err: any) {
        console.error('Auth initialization error:', err);
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    initializeAuth();

    // Subscribe to auth state changes
    unsubscribeRef.current = authService.current.onAuthStateChanged(async (newSession) => {
      if (mounted) {
        setSession(newSession);
        setIsLoading(false);
      }
    });

    return () => {
      mounted = false;
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, []); // No dependencies - only run once on mount

  const signInWithProvider = async (provider: AuthProviderType) => {
    try {
      setError(null);
      const newSession = await authService.current.signInWithProvider(provider);
      // Session will trigger profile check in ProfileContext
      setSession(newSession);
    } catch (err: any) {
      setError(err);
      throw err;
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    try {
      setError(null);
      const newSession = await authService.current.signInWithEmail(email, password);
      setSession(newSession);
    } catch (err: any) {
      setError(err);
      throw err;
    }
  };

  const signUpWithEmail = async (email: string, password: string, name?: string) => {
    try {
      setError(null);
      const newSession = await authService.current.signUpWithEmail(email, password, name);
      setSession(newSession);
    } catch (err: any) {
      setError(err);
      throw err;
    }
  };

  const signOut = async () => {
    try {
      setError(null);
      
      // Clear local state FIRST (before sign out completes)
      // This prevents any race conditions where auth state listener might restore session
      setSession(null); // Clear session state immediately
      
      // Now sign out from services (Google + Supabase)
      // This clears stored tokens/credentials
      await authService.current.signOut();
      
      // Double-check: Ensure session is null after sign out
      // The auth state listener should fire, but we set it explicitly here too
      const currentSession = await authService.current.getCurrentSession();
      if (currentSession) {
        console.warn('[AuthContext] Session still exists after signOut, forcing clear');
        setSession(null);
      }
      
      // Ensure session state is null
      setSession(null);
      
      // Manually redirect to login after sign out completes
      // This ensures immediate navigation rather than waiting for routing guard to react
      // The routing guard will also handle this, but explicit navigation is more reliable
      router.replace('/(auth)/login');
    } catch (err: any) {
      setError(err);
      // Clear session anyway to ensure sign out completes
      setSession(null);
      
      // Redirect to login even on error (user should be logged out)
      router.replace('/(auth)/login');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        isLoading,
        isAuthenticated: !!session,
        signInWithProvider,
        signInWithEmail,
        signUpWithEmail,
        signOut,
        error,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

