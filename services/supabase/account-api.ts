/**
 * Account API Service
 * 
 * Handles account deletion and restoration operations.
 * Provides functions for requesting deletion, canceling deletion, and restoring accounts.
 * 
 * Required for App Store compliance (Guideline 5.1.1 - Account Deletion)
 */

import { getSupabaseClient } from './supabase-init';
import { handleSupabaseMutation, handleSupabaseQuery } from '@/utils/supabase-error-handler';
import { deleteImage, STORAGE_BUCKETS } from './storage-api';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'expo-crypto';
import { clearCOPPACache } from '@/utils/coppa-utils';

/**
 * Deletion type options
 */
export type DeletionType = 'delete_profile' | 'deactivate_profile';

/**
 * Process COPPA deletion - immediately deletes account and marks as COPPA-blocked
 * 
 * This function calls the database function handle_coppa_deletion() which:
 * - Marks profile as COPPA shadow profile (coppa_deleted = true)
 * - Sets coppa_blocked flag in auth.users app_metadata
 * - Clears linked_auth_user_id to disconnect account
 * 
 * @param userId - The authenticated user's ID (auth.users.id)
 * @throws Error if deletion fails
 */
export async function processCOPPADeletion(userId: string): Promise<void> {
  const supabase = getSupabaseClient();

  try {
    // Call database function to handle COPPA deletion
    // This function is SECURITY DEFINER and handles both people table and auth.users metadata
    const { error } = await supabase.rpc('handle_coppa_deletion', {
      target_user_id: userId,
    });

    if (error) {
      console.error('[Account API] Error processing COPPA deletion:', error);
      throw new Error(`Failed to process COPPA deletion: ${error.message}`);
    }

    // Clear COPPA cache for this user (so next check is fresh)
    clearCOPPACache(userId);

    console.log('[Account API] COPPA deletion processed. User is now permanently blocked from re-registration.');
  } catch (error: any) {
    console.error('[Account API] Error in processCOPPADeletion:', error);
    throw error;
  }
}

/**
 * Account deletion status
 */
export interface AccountDeletionStatus {
  deletionRequestedAt: string | null;
  gracePeriodEndsAt: string | null;
  recoveryToken: string | null;
  isInGracePeriod: boolean;
}

/**
 * Request account deletion (starts grace period)
 * 
 * This function initiates the account deletion process with a 30-day grace period.
 * The user can cancel the deletion during this period.
 * 
 * Uses the database function `request_account_deletion()` which is a SECURITY DEFINER
 * function to handle the deletion request.
 * 
 * @param userId - The authenticated user's ID from auth.users
 * @param deletionType - Type of deletion: 'delete_profile' or 'deactivate_profile'
 * @returns Deletion status with grace period information
 * @throws Error if request fails
 */
export async function requestAccountDeletion(
  userId: string,
  deletionType: DeletionType
): Promise<AccountDeletionStatus> {
  const supabase = getSupabaseClient();
  
  // Generate recovery token (UUID v4)
  const recoveryToken = uuidv4();
  
  // Call the database function to set deletion tracking fields
  // This function is SECURITY DEFINER so it can update the people table
  const { data, error } = await supabase.rpc('request_account_deletion', {
    token_input: recoveryToken,
    deletion_type_input: deletionType,
  });
  
  if (error) {
    console.error('[Account API] Error requesting account deletion:', error);
    throw new Error(`Failed to request account deletion: ${error.message}`);
  }
  
  // Fetch the updated person record to get deletion timestamps
  const { data: personData, error: personError } = await supabase
    .from('people')
    .select('deletion_requested_at, deletion_grace_period_ends_at, deletion_recovery_token, deletion_type')
    .eq('linked_auth_user_id', userId)
    .single();
  
  if (personError || !personData) {
    console.error('[Account API] Error fetching deletion status:', personError);
    throw new Error(`Failed to fetch deletion status: ${personError?.message || 'No data returned'}`);
  }
  
  const gracePeriodEndsAt = personData.deletion_grace_period_ends_at 
    ? new Date(personData.deletion_grace_period_ends_at).toISOString()
    : null;
  
  return {
    deletionRequestedAt: personData.deletion_requested_at || null,
    gracePeriodEndsAt,
    recoveryToken: personData.deletion_recovery_token || null,
    isInGracePeriod: gracePeriodEndsAt ? new Date(gracePeriodEndsAt) > new Date() : false,
  };
}

/**
 * Cancel account deletion during grace period
 * 
 * Allows users to cancel their deletion request before the grace period ends.
 * 
 * @param userId - The authenticated user's ID from auth.users
 * @throws Error if cancellation fails
 */
export async function cancelAccountDeletion(userId: string): Promise<void> {
  const supabase = getSupabaseClient();
  
  const { error } = await supabase
    .from('people')
    .update({
      deletion_requested_at: null,
      deletion_grace_period_ends_at: null,
      deletion_recovery_token: null,
      deletion_type: null,
    })
    .eq('linked_auth_user_id', userId);
  
  if (error) {
    console.error('[Account API] Error canceling account deletion:', error);
    throw new Error(`Failed to cancel account deletion: ${error.message}`);
  }
}

/**
 * Get account deletion status
 * 
 * Returns the current deletion status for a user's account.
 * 
 * @param userId - The authenticated user's ID from auth.users
 * @returns Account deletion status or null if no deletion requested
 * @throws Error if query fails
 */
export async function getAccountDeletionStatus(userId: string): Promise<AccountDeletionStatus | null> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('people')
    .select('deletion_requested_at, deletion_grace_period_ends_at, deletion_recovery_token, deletion_type')
    .eq('linked_auth_user_id', userId)
    .single();
  
  if (error) {
    // If no row found, return null (not an error)
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('[Account API] Error fetching deletion status:', error);
    throw new Error(`Failed to fetch deletion status: ${error.message}`);
  }
  
  if (!data || !data.deletion_requested_at) {
    return null; // No deletion requested
  }
  
  const gracePeriodEndsAt = data.deletion_grace_period_ends_at 
    ? new Date(data.deletion_grace_period_ends_at).toISOString()
    : null;
  
  return {
    deletionRequestedAt: data.deletion_requested_at || null,
    gracePeriodEndsAt,
    recoveryToken: data.deletion_recovery_token || null,
    isInGracePeriod: gracePeriodEndsAt ? new Date(gracePeriodEndsAt) > new Date() : false,
  };
}

/**
 * Restore account using recovery token
 * 
 * Allows users to restore their account during the grace period using the recovery token.
 * 
 * @param recoveryToken - The recovery token provided when deletion was requested
 * @returns User ID if restoration successful
 * @throws Error if restoration fails
 */
export async function restoreAccount(recoveryToken: string): Promise<string> {
  const supabase = getSupabaseClient();
  
  // Find the person record with this recovery token
  const { data: personData, error: personError } = await supabase
    .from('people')
    .select('linked_auth_user_id, deletion_grace_period_ends_at')
    .eq('deletion_recovery_token', recoveryToken)
    .single();
  
  if (personError || !personData) {
    throw new Error('Invalid or expired recovery token');
  }
  
  // Check if grace period has expired
  if (personData.deletion_grace_period_ends_at) {
    const gracePeriodEnds = new Date(personData.deletion_grace_period_ends_at);
    if (gracePeriodEnds < new Date()) {
      throw new Error('Recovery token has expired. Account deletion cannot be canceled.');
    }
  }
  
  // Clear deletion tracking fields
  const { error: updateError } = await supabase
    .from('people')
    .update({
      deletion_requested_at: null,
      deletion_grace_period_ends_at: null,
      deletion_recovery_token: null,
      deletion_type: null,
    })
    .eq('deletion_recovery_token', recoveryToken);
  
  if (updateError) {
    console.error('[Account API] Error restoring account:', updateError);
    throw new Error(`Failed to restore account: ${updateError.message}`);
  }
  
  if (!personData.linked_auth_user_id) {
    throw new Error('Account restoration failed: No linked auth user found');
  }
  
  return personData.linked_auth_user_id;
}

/**
 * Process account deletion after grace period (background job)
 * 
 * This function should be called by a scheduled function/trigger, not directly by users.
 * It performs the actual deletion based on the deletion type.
 * 
 * IMPORTANT: Deleting from auth.users requires service_role key or Edge Function.
 * This function handles the people table and related data, but auth.users deletion
 * must be handled separately via Edge Function or admin action.
 * 
 * @param userId - The authenticated user's ID from auth.users
 * @param deletionType - Type of deletion: 'delete_profile' or 'deactivate_profile'
 * @throws Error if deletion fails
 */
export async function processAccountDeletion(
  userId: string,
  deletionType: DeletionType
): Promise<void> {
  const supabase = getSupabaseClient();
  
  // Get the person record
  const { data: personData, error: personError } = await supabase
    .from('people')
    .select('user_id, photo_url')
    .eq('linked_auth_user_id', userId)
    .single();
  
  if (personError || !personData) {
    throw new Error(`Person record not found: ${personError?.message || 'No data'}`);
  }
  
  const personId = personData.user_id;
  
  if (deletionType === 'delete_profile') {
    // Delete Profile: Remove photos/stories, keep name in tree
    
    // 1. Delete all updates created by this user
    const { data: updatesData } = await supabase
      .from('updates')
      .select('updates_id, photo_url')
      .eq('created_by', userId);
    
    if (updatesData) {
      // Delete photos from Storage
      for (const update of updatesData) {
        if (update.photo_url) {
          try {
            // Extract file path from photo_url
            const storageUrlPattern = /\/storage\/v1\/object\/public\/([^\/]+)\/(.+)$/;
            const match = update.photo_url.match(storageUrlPattern);
            if (match) {
              const bucket = match[1];
              const filePath = match[2];
              await deleteImage(filePath, bucket);
            }
          } catch (error) {
            console.error('[Account API] Error deleting update photo:', error);
            // Continue with deletion even if photo deletion fails
          }
        }
      }
      
      // Delete updates from database
      const { error: deleteUpdatesError } = await supabase
        .from('updates')
        .delete()
        .eq('created_by', userId);
      
      if (deleteUpdatesError) {
        console.error('[Account API] Error deleting updates:', deleteUpdatesError);
        // Continue with deletion even if updates deletion fails
      }
    }
    
    // 2. Delete person photo from Storage if exists
    if (personData.photo_url) {
      try {
        const storageUrlPattern = /\/storage\/v1\/object\/public\/([^\/]+)\/(.+)$/;
        const match = personData.photo_url.match(storageUrlPattern);
        if (match) {
          const bucket = match[1];
          const filePath = match[2];
          await deleteImage(filePath, bucket);
        }
      } catch (error) {
        console.error('[Account API] Error deleting person photo:', error);
        // Continue with deletion even if photo deletion fails
      }
    }
    
    // 3. Clear PII from person record (keep name for family history)
    const { error: updatePersonError } = await supabase
      .from('people')
      .update({
        linked_auth_user_id: null, // Convert to shadow profile
        photo_url: null,
        bio: null,
        phone_number: null,
        deleted_at: new Date().toISOString(),
      })
      .eq('user_id', personId);
    
    if (updatePersonError) {
      throw new Error(`Failed to update person record: ${updatePersonError.message}`);
    }
    
  } else if (deletionType === 'deactivate_profile') {
    // Deactivate Profile: Keep photos/stories, remove account info only
    
    // 1. Clear PII from person record (keep photo_url and updates)
    const { error: updatePersonError } = await supabase
      .from('people')
      .update({
        linked_auth_user_id: null, // Convert to shadow profile
        bio: null,
        phone_number: null,
        // Note: deleted_at will be set after 1 year (handled by background job)
      })
      .eq('user_id', personId);
    
    if (updatePersonError) {
      throw new Error(`Failed to update person record: ${updatePersonError.message}`);
    }
  }
  
  // Note: auth.users deletion must be handled separately via Edge Function
  // because it requires service_role key or admin privileges
  console.log('[Account API] Account deletion processed. Auth user deletion must be handled separately.');
}
