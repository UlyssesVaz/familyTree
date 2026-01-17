/**
 * Supabase Edge Function: Process Expired Deletions
 * 
 * This function processes account deletions whose grace period has expired.
 * It performs COMPLETE cleanup:
 * 1. Finds expired deletion requests (grace period ended)
 * 2. Deletes updates and their photos (if delete_profile type)
 * 3. Deletes person photos from storage
 * 4. Cleans up people table (converts to shadow profile)
 * 5. Deletes auth.users record (permanent deletion)
 * 
 * Should be called daily by a scheduled job (Supabase Cron).
 * 
 * Security: This function requires service_role key to delete auth.users records.
 * It should only be called from scheduled jobs, not directly by users.
 * 
 * Required for App Store compliance (Apple Guideline 5.1.1 - Account Deletion)
 */

import { createClient } from '@supabase/supabase-js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Storage bucket names (must match storage-api.ts)
const STORAGE_BUCKETS = {
  PERSON_PHOTOS: 'profile-images',
  UPDATE_PHOTOS: 'update-photos',
} as const;

interface ExpiredDeletionRPC {
  target_user_id: string; // auth.users.id (linked_auth_user_id)
  target_person_id: string; // person.user_id
}

interface PersonRecord {
  user_id: string;
  deletion_type: 'delete_profile' | 'deactivate_profile';
  photo_url: string | null;
}

/**
 * Extract file path from Supabase storage URL
 * URL format: https://...supabase.co/storage/v1/object/public/{bucket}/{path}
 */
function extractStoragePath(photoUrl: string): { bucket: string; path: string } | null {
  const storageUrlPattern = /\/storage\/v1\/object\/public\/([^\/]+)\/(.+)$/;
  const match = photoUrl.match(storageUrlPattern);
  if (match) {
    return { bucket: match[1], path: match[2] };
  }
  return null;
}

/**
 * Delete image from Supabase Storage
 */
async function deleteImageFromStorage(
  supabaseAdmin: ReturnType<typeof createClient>,
  photoUrl: string
): Promise<boolean> {
  const pathInfo = extractStoragePath(photoUrl);
  if (!pathInfo) {
    return false;
  }

  try {
    const { error } = await supabaseAdmin.storage
      .from(pathInfo.bucket)
      .remove([pathInfo.path]);

    if (error) {
      console.error(`[Process Expired Deletions] Error deleting image: ${error.message}`);
      return false;
    }

    return true;
  } catch (error: any) {
    console.error(`[Process Expired Deletions] Exception deleting image: ${error.message}`);
    return false;
  }
}

/**
 * Process a single user's account deletion
 */
async function processUserDeletion(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string,
  personId: string,
  personData: PersonRecord
): Promise<{ success: boolean; error?: string }> {
  const { deletion_type, photo_url } = personData;

  try {
    if (deletion_type === 'delete_profile') {
      // Delete Profile: Remove photos/stories, keep name in tree

      // 1. Delete all updates created by this user and their photos
      const { data: updatesData } = await supabaseAdmin
        .from('updates')
        .select('updates_id, photo_url')
        .eq('created_by', userId);

      if (updatesData && updatesData.length > 0) {
        // Delete photos from Storage
        for (const update of updatesData) {
          if (update.photo_url) {
            await deleteImageFromStorage(supabaseAdmin, update.photo_url);
          }
        }

        // Delete updates from database
        const { error: deleteUpdatesError } = await supabaseAdmin
          .from('updates')
          .delete()
          .eq('created_by', userId);

        if (deleteUpdatesError) {
          console.error(`[Process Expired Deletions] Error deleting updates for user ${userId}:`, deleteUpdatesError);
          // Continue with deletion even if updates deletion fails
        }
      }

      // 2. Delete person photo from Storage if exists
      if (photo_url) {
        await deleteImageFromStorage(supabaseAdmin, photo_url);
      }

      // 3. Clear PII from person record (keep name for family history)
      const { error: updatePersonError } = await supabaseAdmin
        .from('people')
        .update({
          linked_auth_user_id: null, // Convert to shadow profile
          photo_url: null,
          bio: null,
          phone_number: null,
          deleted_at: new Date().toISOString(),
          deletion_requested_at: null,
          deletion_grace_period_ends_at: null,
          deletion_recovery_token: null,
          deletion_type: null,
        })
        .eq('user_id', personId);

      if (updatePersonError) {
        throw new Error(`Failed to update person record: ${updatePersonError.message}`);
      }
    } else if (deletion_type === 'deactivate_profile') {
      // Deactivate Profile: Keep photos/stories, remove account info only

      const { error: updatePersonError } = await supabaseAdmin
        .from('people')
        .update({
          linked_auth_user_id: null, // Convert to shadow profile
          bio: null,
          phone_number: null,
          deletion_requested_at: null,
          deletion_grace_period_ends_at: null,
          deletion_recovery_token: null,
          deletion_type: null,
          // Note: deleted_at will be set after 1 year (handled by separate background job)
        })
        .eq('user_id', personId);

      if (updatePersonError) {
        throw new Error(`Failed to update person record: ${updatePersonError.message}`);
      }
    }

    // 4. Delete from auth.users (permanent deletion - user can no longer sign in)
    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (deleteAuthError) {
      // If user not found, that's okay (idempotent operation)
      if (deleteAuthError.message.includes('User not found') || deleteAuthError.message.includes('not found')) {
        console.log(`[Process Expired Deletions] User ${userId} not found in auth.users (already deleted)`);
      } else {
        throw new Error(`Failed to delete auth user: ${deleteAuthError.message}`);
      }
    }

    return { success: true };
  } catch (error: any) {
    console.error(`[Process Expired Deletions] Error processing user ${userId}:`, error);
    return { success: false, error: error.message || 'Unknown error' };
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error('[Process Expired Deletions] Missing environment variables');
      return new Response(
        JSON.stringify({ 
          error: 'Server configuration error',
          message: 'Missing required environment variables' 
        }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Create admin client with service_role key
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Find expired deletions using RPC function (cleaner query logic)
    const { data: expiredDeletions, error: rpcError } = await supabaseAdmin.rpc('get_expired_deletions');

    if (rpcError) {
      console.error('[Process Expired Deletions] Error calling get_expired_deletions RPC:', rpcError);
      return new Response(
        JSON.stringify({ 
          error: 'Database query error',
          message: rpcError.message
        }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    if (!expiredDeletions || expiredDeletions.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true,
          processed_count: 0,
          message: 'No expired deletions to process'
        }),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log(`[Process Expired Deletions] Found ${expiredDeletions.length} expired deletions to process`);

    const results: Array<{ user_id: string; status: string; error?: string }> = [];

    // Process each expired deletion
    for (const record of expiredDeletions as ExpiredDeletionRPC[]) {
      const userId = record.target_user_id;
      const personId = record.target_person_id;

      // Fetch person data to get deletion_type and photo_url
      const { data: personData, error: personError } = await supabaseAdmin
        .from('people')
        .select('user_id, deletion_type, photo_url')
        .eq('user_id', personId)
        .single();

      if (personError || !personData) {
        console.error(`[Process Expired Deletions] Error fetching person data for ${personId}:`, personError);
        results.push({
          user_id: userId,
          status: 'error',
          error: `Failed to fetch person data: ${personError?.message || 'No data'}`,
        });
        continue;
      }

      const result = await processUserDeletion(supabaseAdmin, userId, personId, personData as PersonRecord);
      
      results.push({
        user_id: userId,
        status: result.success ? 'success' : 'error',
        error: result.error,
      });

      if (result.success) {
        console.log(`[Process Expired Deletions] Successfully processed deletion for user: ${userId}`);
      }
    }

    const successCount = results.filter(r => r.status === 'success').length;
    const errorCount = results.filter(r => r.status === 'error').length;

    return new Response(
      JSON.stringify({ 
        success: true,
        processed_count: expiredDeletions.length,
        success_count: successCount,
        error_count: errorCount,
        results: results,
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error: any) {
    console.error('[Process Expired Deletions] Unexpected error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal Server Error',
        message: error.message || 'An unexpected error occurred'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
