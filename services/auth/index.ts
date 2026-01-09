/**
 * Auth Service Factory
 * 
 * Central export point for auth service.
 * Switch implementations here without changing component code.
 */

import { AuthService } from './types';
import { SupabaseAuthService } from './supabase-auth-service';

// Mock service for development (no backend)
class MockAuthService implements AuthService {
  private mockUser: any = null;

  async isAuthenticated(): Promise<boolean> {
    return this.mockUser !== null;
  }

  async getCurrentSession(): Promise<any> {
    return this.mockUser;
  }

  async signInWithProvider(provider: any): Promise<any> {
    // Simulate SSO sign in
    this.mockUser = {
      user: {
        id: 'mock-user-id',
        email: 'user@example.com',
        name: 'Mock User',
        photoUrl: null,
        provider,
        emailVerified: true,
      },
      accessToken: 'mock-token',
      refreshToken: null,
      expiresAt: null,
    };
    return this.mockUser;
  }

  async signInWithEmail(email: string, password: string): Promise<any> {
    this.mockUser = {
      user: {
        id: 'mock-user-id',
        email,
        name: null,
        photoUrl: null,
        provider: 'email' as const,
        emailVerified: false,
      },
      accessToken: 'mock-token',
      refreshToken: null,
      expiresAt: null,
    };
    return this.mockUser;
  }

  async signUpWithEmail(email: string, password: string, name?: string): Promise<any> {
    return this.signInWithEmail(email, password);
  }

  async signOut(): Promise<void> {
    this.mockUser = null;
  }

  async refreshToken(): Promise<any> {
    return this.mockUser;
  }

  onAuthStateChanged(callback: (session: any) => void): () => void {
    // Mock: call immediately if user exists
    if (this.mockUser) {
      setTimeout(() => callback(this.mockUser), 100);
    }
    return () => {}; // Unsubscribe
  }
}

/**
 * Get auth service instance
 * 
 * Switch between implementations:
 * - MockAuthService: For development (no backend)
 * - SupabaseAuthService: For production (Supabase)
 */
export function getAuthService(): AuthService {
  const useMock = process.env.EXPO_PUBLIC_USE_MOCK_AUTH === 'true' || false; // Default to Supabase
  
  if (useMock) {
    return new MockAuthService();
  }
  
  return new SupabaseAuthService();
}

export * from './types';

