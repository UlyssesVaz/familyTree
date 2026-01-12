/**
 * Supabase Initialization Module
 * 
 * Handles Supabase client initialization.
 * Uses environment variables for configuration.
 * 
 * IMPORTANT: Import 'react-native-url-polyfill' before this module in app entry point!
 */

import 'react-native-url-polyfill/auto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

let supabaseClient: SupabaseClient | null = null;
let initializationError: Error | null = null;

/**
 * Initialize Supabase client
 * 
 * @returns Supabase client instance
 * @throws Error if Supabase URL or key is missing
 */
export function initializeSupabase(): SupabaseClient {
  if (supabaseClient) {
    return supabaseClient;
  }

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    const error = new Error(
      'Supabase configuration missing. Please set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY in your .env file.'
    );
    initializationError = error;
    throw error;
  }

  try {
    supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: AsyncStorage, // Use AsyncStorage for React Native session persistence
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false, // React Native doesn't use URL-based auth
      },
    });

    if (__DEV__) {
      console.log('[Supabase] Initialized successfully');
    }
    return supabaseClient;
  } catch (error) {
    initializationError = error as Error;
    console.error('[Supabase] Initialization error:', error);
    throw error;
  }
}

/**
 * Get Supabase client instance
 * 
 * @returns Supabase client instance
 * @throws Error if Supabase is not initialized
 */
export function getSupabaseClient(): SupabaseClient {
  if (!supabaseClient && !initializationError) {
    return initializeSupabase();
  }

  if (initializationError) {
    throw initializationError;
  }

  if (!supabaseClient) {
    throw new Error('Supabase client not initialized');
  }

  return supabaseClient;
}

/**
 * Check if Supabase is initialized
 */
export function isSupabaseInitialized(): boolean {
  return supabaseClient !== null;
}

/**
 * Get initialization error if any
 */
export function getInitializationError(): Error | null {
  return initializationError;
}

