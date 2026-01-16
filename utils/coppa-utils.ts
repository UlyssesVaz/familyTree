/**
 * COPPA Utilities
 * 
 * Functions for checking COPPA block status and preventing re-registration.
 * Uses memoization to prevent race conditions and duplicate checks.
 */

import { getSupabaseClient } from '@/services/supabase/supabase-init';

/**
 * Cache for COPPA status checks to prevent duplicate API calls
 * Key: userId, Value: { isBlocked: boolean, timestamp: number }
 */
const coppaStatusCache = new Map<string, { isBlocked: boolean; timestamp: number }>();

/**
 * Cache expiration time: 5 minutes
 * This ensures we don't cache indefinitely but avoid repeated checks in short time windows
 */
const CACHE_EXPIRY_MS = 5 * 60 * 1000;

/**
 * Check if a user is COPPA-blocked from their auth metadata
 * 
 * Uses memoization to prevent race conditions and duplicate checks.
 * 
 * @param userId - The authenticated user's ID (auth.users.id)
 * @returns true if user is COPPA-blocked, false otherwise
 */
export async function isCOPPABlocked(userId: string): Promise<boolean> {
  // Check cache first (prevent race conditions)
  const cached = coppaStatusCache.get(userId);
  if (cached && Date.now() - cached.timestamp < CACHE_EXPIRY_MS) {
    return cached.isBlocked;
  }

  try {
    const supabase = getSupabaseClient();
    
    // Get user metadata from auth
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) {
      console.error('[COPPA Utils] Error fetching user metadata:', error);
      // If we can't check, assume not blocked (fail open, but log error)
      return false;
    }

    // Check app_metadata for coppa_blocked flag
    // app_metadata is set by handle_coppa_deletion() database function
    const isBlocked = user.app_metadata?.coppa_blocked === true;

    // Cache the result (with timestamp for expiration)
    coppaStatusCache.set(userId, {
      isBlocked,
      timestamp: Date.now(),
    });

    return isBlocked;
  } catch (error: any) {
    console.error('[COPPA Utils] Error checking COPPA status:', error);
    // Fail open if check fails (don't block users due to API errors)
    return false;
  }
}

/**
 * Clear COPPA status cache for a user
 * 
 * Call this after account deletion to ensure next check is fresh.
 * 
 * @param userId - The user ID to clear from cache
 */
export function clearCOPPACache(userId: string): void {
  coppaStatusCache.delete(userId);
}

/**
 * Clear all COPPA status cache
 * 
 * Useful for testing or when you want to force fresh checks.
 */
export function clearAllCOPPACache(): void {
  coppaStatusCache.clear();
}
