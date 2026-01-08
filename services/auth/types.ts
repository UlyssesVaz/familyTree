/**
 * Provider-agnostic authentication types
 * 
 * This abstraction allows switching between Firebase, Auth0, Supabase, etc.
 * without changing component code.
 */

export type AuthProvider = 'google' | 'microsoft' | 'apple' | 'slack' | 'email';

export interface User {
  id: string;
  email: string | null;
  name: string | null;
  photoUrl: string | null;
  provider: AuthProvider;
  emailVerified: boolean;
}

export interface AuthSession {
  user: User;
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: number | null;
}

export interface AuthError {
  code: string;
  message: string;
  provider?: AuthProvider;
}

/**
 * Auth service interface - implement this for any auth provider
 */
export interface AuthService {
  /** Check if user is currently authenticated */
  isAuthenticated(): Promise<boolean>;
  
  /** Get current user session */
  getCurrentSession(): Promise<AuthSession | null>;
  
  /** Sign in with SSO provider */
  signInWithProvider(provider: AuthProvider): Promise<AuthSession>;
  
  /** Sign in with email/password */
  signInWithEmail(email: string, password: string): Promise<AuthSession>;
  
  /** Sign up with email/password */
  signUpWithEmail(email: string, password: string, name?: string): Promise<AuthSession>;
  
  /** Sign out */
  signOut(): Promise<void>;
  
  /** Refresh access token */
  refreshToken(): Promise<AuthSession | null>;
  
  /** Listen to auth state changes */
  onAuthStateChanged(callback: (session: AuthSession | null) => void): () => void;
}

