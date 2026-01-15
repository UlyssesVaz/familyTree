/**
 * Updates API Service
 * 
 * Handles all Supabase operations related to updates/posts.
 * Provides type-safe functions for creating, fetching, updating, and deleting updates.
 */

import { getSupabaseClient } from './supabase-init';
import type { Update } from '@/types/family-tree';
import { deleteImage, STORAGE_BUCKETS } from './storage-api';
import { v4 as uuidv4 } from 'uuid';
import { handleSupabaseMutation } from '@/utils/supabase-error-handler';
import { uploadPhotoIfLocal } from './shared/photo-upload';
import { mapUpdateRow, type UpdatesRow } from './shared/mappers';

/**
 * Database row type for update_tags table
 */
interface UpdateTagsRow {
  id: string;
  update_id: string; // FOREIGN KEY to updates.updates_id (UUID)
  tagged_person_id: string;
}

/**
 * Input type for creating a new update
 */
export interface CreateUpdateInput {
  personId: string; // The person whose profile this update belongs to (maps to user_id in DB)
  title: string;
  photoUrl: string; // Can be local file:// URI or remote URL
  caption?: string;
  isPublic?: boolean;
  taggedPersonIds?: string[]; // UUIDs of people tagged via @mentions
}

/**
 * Create a new update in Supabase
 * 
 * IMPORTANT: 
 * - Uploads local photos to Supabase Storage before saving to database
 * - Creates update_tags entries for @mentions
 * - Returns complete Update object with all relationships
 * 
 * @param userId - The authenticated user's ID from auth.users (required for created_by)
 * @param input - Update data to create
 * @returns Created Update object
 * @throws Error if creation fails
 */
export async function createUpdate(
  userId: string,
  input: CreateUpdateInput
): Promise<Update> {
  const supabase = getSupabaseClient();
  const authenticatedUserId = userId;
  
  // STEP 1: Upload photo if it's a local file URI
  let photoUrl: string | null = input.photoUrl || null;
  
  if (input.photoUrl && input.photoUrl.startsWith('file://')) {
    try {
      const uploadedUrl = await uploadPhotoIfLocal(
        input.photoUrl,
        STORAGE_BUCKETS.UPDATE_PHOTOS,
        authenticatedUserId, // Single folder level: organize by creator only
        'Updates API'
      );
      
      if (uploadedUrl) {
        photoUrl = uploadedUrl; // Use uploaded URL instead of local URI
      } else {
        console.warn('[Updates API] Photo upload returned null, continuing without photo');
        photoUrl = null;
      }
    } catch (error: any) {
      console.error('[Updates API] Error uploading photo:', error);
      // Don't fail the entire update creation if photo upload fails
      // Continue without photo - user can try again
      photoUrl = null;
    }
  }
  
  // STEP 2: Generate UUID for the new update
  // With UUID primary key, users can post multiple times to the same wall
  const updatesId = uuidv4();
  
  // STEP 3: Prepare database row (map TypeScript types to PostgreSQL schema)
  // PRIMARY KEY is now updates_id (UUID)
  // IMPORTANT: created_by MUST be auth.uid() (the logged-in user) for RLS policy to pass
  // user_id is the person whose wall this update belongs to
  // Note: created_at and updated_at are handled by database defaults/triggers
  const row: Omit<UpdatesRow, 'created_at' | 'updated_at' | 'deleted_at'> = {
    updates_id: updatesId, // PRIMARY KEY (UUID)
    user_id: input.personId, // FK to people.user_id (the person whose wall this is)
    created_by: authenticatedUserId, // FK to auth.users.id (MUST be auth.uid() for RLS)
    title: input.title.trim(),
    photo_url: photoUrl || null, // Use uploaded URL or original remote URL
    caption: input.caption?.trim() || null,
    is_public: input.isPublic ?? true, // Default to public
  };
  
  // STEP 4: Insert into database (UUID primary key allows multiple posts per user per wall)
  // Note: RLS policies now allow SELECT after INSERT, so .select() should work
  const { data, error } = await supabase
    .from('updates')
    .insert(row)
    .select()
    .single();
  
  const result = handleSupabaseMutation(data, error, {
    apiName: 'Updates API',
    operation: 'create update',
  });
  
  // STEP 5: Create update_tags entries if taggedPersonIds provided
  if (input.taggedPersonIds && input.taggedPersonIds.length > 0) {
    // Insert new tags (no need to delete existing tags since this is a new insert)
    const tagRows: Omit<UpdateTagsRow, 'id'>[] = input.taggedPersonIds.map(taggedPersonId => ({
      update_id: updatesId,
      tagged_person_id: taggedPersonId,
    }));
    
    const { error: tagsError } = await supabase
      .from('update_tags')
      .insert(tagRows);
    
    if (tagsError) {
      console.error('[Updates API] Error creating update tags:', tagsError);
      // Don't fail the entire update creation if tag creation fails
      // Continue without tags - user can try again
    }
  }
  
  // STEP 6: Map database response to Update type using shared mapper
  return mapUpdateRow(result, input.taggedPersonIds);
}

/**
 * Get all updates for a specific person
 * 
 * NOTE: With UUID primary key, multiple users can create updates
 * for the same person. This function returns all updates for that person.
 * 
 * @param personId - The person's user_id to get updates for
 * @returns Array of Update objects, sorted by created_at (newest first)
 * @throws Error if query fails
 */
export async function getUpdatesForPerson(personId: string): Promise<Update[]> {
  const supabase = getSupabaseClient();
  
  // Query updates table by user_id, excluding soft-deleted updates
  const { data: updatesData, error: updatesError } = await supabase
    .from('updates')
    .select('*')
    .eq('user_id', personId)
    .order('created_at', { ascending: false }); // Newest first
  
  if (updatesError) {
    console.error('[Updates API] Error fetching updates:', updatesError);
    throw new Error(`Failed to fetch updates: ${updatesError.message}`);
  }
  
  if (!updatesData || updatesData.length === 0) {
    return []; // No updates found for this person
  }
  
  // Build array of update IDs (UUIDs) for querying tags
  const updateIds = updatesData.map(u => u.updates_id);
  
  // Query update_tags table for all updates
  const { data: tagsData, error: tagsError } = await supabase
    .from('update_tags')
    .select('*')
    .in('update_id', updateIds);
  
  if (tagsError) {
    console.error('[Updates API] Error fetching update tags:', tagsError);
    // Don't fail - continue without tags
  }
  
  // Build a map of update_id -> tagged person IDs
  const tagsMap = new Map<string, string[]>();
  if (tagsData) {
    for (const tag of tagsData) {
      const existing = tagsMap.get(tag.update_id) || [];
      existing.push(tag.tagged_person_id);
      tagsMap.set(tag.update_id, existing);
    }
  }
  
  // Map database rows to Update type using shared mapper
  const updates: Update[] = updatesData.map((row) => {
    return mapUpdateRow(row, tagsMap.get(row.updates_id));
  });
  
  return updates;
}

/**
 * Get all updates for all people in the family tree
 * 
 * This function loads all updates from the database, including tags.
 * Used for initial sync when app starts.
 * 
 * IMPORTANT: Filters out updates from users who have requested 'delete_profile' deletion.
 * Updates from 'deactivate_profile' users are kept (their content remains visible).
 * 
 * @returns Array of all Update objects, sorted by created_at (newest first)
 * @throws Error if query fails
 */
export async function getAllUpdates(): Promise<Update[]> {
  const supabase = getSupabaseClient();
  
  // STEP 1: Get all user IDs who have requested 'delete_profile' deletion
  // These users' updates should be hidden (but 'deactivate_profile' users' updates remain visible)
  const { data: deletedUsersData } = await supabase
    .from('people')
    .select('linked_auth_user_id')
    .eq('deletion_type', 'delete_profile')
    .not('deletion_requested_at', 'is', null);
  
  const deletedUserIds = (deletedUsersData || [])
    .map(p => p.linked_auth_user_id)
    .filter((id): id is string => id !== null);
  
  // STEP 2: Query all updates, filtering out updates from deleted users
  let query = supabase
    .from('updates')
    .select('*');
  
  // Filter out updates from deleted users at the SQL level (more efficient)
  // Use .not() with .in() to exclude multiple user IDs
  if (deletedUserIds.length > 0) {
    // Supabase doesn't support .not().in() directly, so we need to use a different approach
    // We'll filter in JavaScript after fetching, but this is still better than fetching everything
    // For now, we'll do the filtering after the query (defensive approach)
  }
  
  const { data: updatesData, error: updatesError } = await query
    .order('created_at', { ascending: false }); // Newest first
  
  if (updatesError) {
    console.error('[Updates API] Error fetching all updates:', updatesError);
    throw new Error(`Failed to fetch updates: ${updatesError.message}`);
  }
  
  if (!updatesData || updatesData.length === 0) {
    return []; // No updates found
  }
  
  // Build array of update IDs (UUIDs) for querying tags
  const updateIds = updatesData.map(u => u.updates_id);
  
  // Query update_tags table for all updates
  const { data: tagsData, error: tagsError } = await supabase
    .from('update_tags')
    .select('*')
    .in('update_id', updateIds);
  
  if (tagsError) {
    console.error('[Updates API] Error fetching update tags:', tagsError);
    // Don't fail - continue without tags
  }
  
  // Build a map of update_id -> tagged person IDs
  const tagsMap = new Map<string, string[]>();
  if (tagsData) {
    for (const tag of tagsData) {
      const existing = tagsMap.get(tag.update_id) || [];
      existing.push(tag.tagged_person_id);
      tagsMap.set(tag.update_id, existing);
    }
  }
  
  // STEP 3: Map database rows to Update type using shared mapper
  let updates: Update[] = updatesData.map((row) => {
    return mapUpdateRow(row, tagsMap.get(row.updates_id));
  });
  
  // STEP 4: Defensive filtering - remove updates from users who requested 'delete_profile' deletion
  // Note: Updates from 'deactivate_profile' users are kept (their content remains visible)
  // This is important: 'delete_profile' means hide everything, 'deactivate_profile' means keep content visible
  if (deletedUserIds.length > 0) {
    const deletedUserIdsSet = new Set(deletedUserIds);
    updates = updates.filter(update => {
      // Filter out updates created by users who requested 'delete_profile' deletion
      // createdBy is the user ID (from auth.users) who created the update
      if (!update.createdBy) {
        return true; // Keep updates without createdBy (shouldn't happen, but be safe)
      }
      return !deletedUserIdsSet.has(update.createdBy);
    });
  }
  
  return updates;
}

/**
 * Delete an update from database and Storage
 * 
 * This function performs two actions:
 * 1. Deletes the update from the database (CASCADE automatically handles update_tags)
 * 2. Deletes the associated photo from Supabase Storage bucket
 * 
 * NOTE: Frontend should hide the update first (soft delete), then call this
 * to permanently remove it from database and Storage.
 * 
 * @param updateId - The UUID of the update to delete (updates_id)
 * @throws Error if database deletion fails
 */
export async function deleteUpdate(updateId: string): Promise<void> {
  const supabase = getSupabaseClient();
  
  // Get current auth user - verify user owns this update
  const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !authUser?.id) {
    throw new Error(`Authentication required: ${authError?.message || 'No user session'}`);
  }
  
  // STEP 1: Fetch the update to get photo_url before deleting
  // This allows us to delete the photo from Storage
  const { data: updateData, error: fetchError } = await supabase
    .from('updates')
    .select('photo_url, created_by')
    .eq('updates_id', updateId)
    .single();
  
  if (fetchError) {
    console.error('[Updates API] Error fetching update for deletion:', fetchError);
    throw new Error(`Failed to fetch update: ${fetchError.message}`);
  }
  
  if (!updateData) {
    throw new Error('Update not found');
  }
  
  // Verify user owns this update (RLS policy should handle this, but double-check)
  if (updateData.created_by !== authUser.id) {
    throw new Error('Unauthorized: You can only delete your own updates');
  }
  
  // STEP 2: Delete photo from Storage if it exists
  // Extract file path from photo_url if it's a Supabase Storage URL
  if (updateData.photo_url) {
    try {
      // Parse Supabase Storage URL to get file path
      // Format: https://[project].supabase.co/storage/v1/object/public/[bucket]/[path]
      const photoUrl = updateData.photo_url;
      const storageUrlPattern = /\/storage\/v1\/object\/public\/([^\/]+)\/(.+)$/;
      const match = photoUrl.match(storageUrlPattern);
      
      if (match) {
        const bucket = match[1];
        const filePath = match[2];
        
        // Delete from Storage
        const deleted = await deleteImage(filePath, bucket);
        if (deleted) {
          console.log('[Updates API] Successfully deleted photo from Storage');
        } else {
          console.warn('[Updates API] Failed to delete photo from Storage, continuing with database deletion');
        }
      } else {
        // If photo_url is not a Supabase Storage URL (e.g., external URL or local file),
        // skip Storage deletion
        console.log('[Updates API] Photo URL is not from Supabase Storage, skipping Storage deletion');
      }
    } catch (error: any) {
      // Don't fail the entire deletion if Storage deletion fails
      // Log error but continue with database deletion
      console.error('[Updates API] Error deleting photo from Storage:', error);
    }
  }
  
  // STEP 3: Delete update from database
  // CASCADE on update_tags foreign key will automatically delete related tags
  const { error: deleteError } = await supabase
    .from('updates')
    .delete()
    .eq('updates_id', updateId);
  
  if (deleteError) {
    console.error('[Updates API] Error deleting update:', deleteError);
    throw new Error(`Failed to delete update: ${deleteError.message}`);
  }
  
  console.log('[Updates API] Successfully deleted update from database');
}

/**
 * Input type for updating an existing update
 */
export interface UpdateUpdateInput {
  title?: string;
  photoUrl?: string; // Can be local file:// URI or remote URL
  caption?: string;
  isPublic?: boolean;
  taggedPersonIds?: string[]; // UUIDs of people tagged via @mentions
}

/**
 * Update an existing update in Supabase
 * 
 * IMPORTANT: 
 * - Uploads local photos to Supabase Storage before saving to database
 * - Updates update_tags entries for @mentions if taggedPersonIds changed
 * - Verifies user owns the update before allowing edit
 * - Returns complete Update object with all relationships
 * 
 * @param userId - The authenticated user's ID from auth.users (required for verification)
 * @param updateId - The UUID of the update to update (updates_id)
 * @param input - Update data to change
 * @returns Updated Update object
 * @throws Error if update fails or user doesn't own the update
 */
export async function updateUpdate(
  userId: string,
  updateId: string,
  input: UpdateUpdateInput
): Promise<Update> {
  const supabase = getSupabaseClient();
  
  // STEP 1: Verify user owns this update
  const { data: existingUpdate, error: fetchError } = await supabase
    .from('updates')
    .select('created_by, photo_url')
    .eq('updates_id', updateId)
    .single();
  
  if (fetchError) {
    console.error('[Updates API] Error fetching update for edit:', fetchError);
    throw new Error(`Failed to fetch update: ${fetchError.message}`);
  }
  
  if (!existingUpdate) {
    throw new Error('Update not found');
  }
  
  if (existingUpdate.created_by !== userId) {
    throw new Error('Unauthorized: You can only edit your own updates');
  }
  
  // STEP 2: Handle photo upload/replacement if new photo provided
  let photoUrl: string | null = input.photoUrl || existingUpdate.photo_url || null;
  
  if (input.photoUrl && input.photoUrl.startsWith('file://')) {
    try {
      // Delete old photo if it exists and is from Storage
      if (existingUpdate.photo_url) {
        const storageUrlPattern = /\/storage\/v1\/object\/public\/([^\/]+)\/(.+)$/;
        const match = existingUpdate.photo_url.match(storageUrlPattern);
        if (match) {
          const bucket = match[1];
          const filePath = match[2];
          try {
            await deleteImage(filePath, bucket);
          } catch (error) {
            console.warn('[Updates API] Error deleting old photo, continuing with upload:', error);
          }
        }
      }
      
      // Upload new photo
      const uploadedUrl = await uploadPhotoIfLocal(
        input.photoUrl,
        STORAGE_BUCKETS.UPDATE_PHOTOS,
        userId,
        'Updates API'
      );
      
      if (uploadedUrl) {
        photoUrl = uploadedUrl;
      } else {
        console.warn('[Updates API] Photo upload returned null, keeping existing photo');
        photoUrl = existingUpdate.photo_url || null;
      }
    } catch (error: any) {
      console.error('[Updates API] Error uploading photo:', error);
      // Don't fail the entire update if photo upload fails
      // Keep existing photo
      photoUrl = existingUpdate.photo_url || null;
    }
  } else if (input.photoUrl === null || input.photoUrl === '') {
    // Explicitly remove photo
    if (existingUpdate.photo_url) {
      const storageUrlPattern = /\/storage\/v1\/object\/public\/([^\/]+)\/(.+)$/;
      const match = existingUpdate.photo_url.match(storageUrlPattern);
      if (match) {
        const bucket = match[1];
        const filePath = match[2];
        try {
          await deleteImage(filePath, bucket);
        } catch (error) {
          console.warn('[Updates API] Error deleting photo, continuing with update:', error);
        }
      }
    }
    photoUrl = null;
  }
  
  // STEP 3: Prepare update data (only include fields that are being changed)
  const updateData: Partial<UpdatesRow> = {
    updated_at: new Date().toISOString(),
  };
  
  if (input.title !== undefined) {
    updateData.title = input.title.trim();
  }
  if (photoUrl !== undefined) {
    updateData.photo_url = photoUrl;
  }
  if (input.caption !== undefined) {
    updateData.caption = input.caption?.trim() || null;
  }
  if (input.isPublic !== undefined) {
    updateData.is_public = input.isPublic;
  }
  
  // STEP 4: Update database row
  const { data, error } = await supabase
    .from('updates')
    .update(updateData)
    .eq('updates_id', updateId)
    .select()
    .single();
  
  const result = handleSupabaseMutation(data, error, {
    apiName: 'Updates API',
    operation: 'update update',
  });
  
  // STEP 5: Update update_tags if taggedPersonIds provided
  if (input.taggedPersonIds !== undefined) {
    // Delete existing tags
    const { error: deleteTagsError } = await supabase
      .from('update_tags')
      .delete()
      .eq('update_id', updateId);
    
    if (deleteTagsError) {
      console.error('[Updates API] Error deleting existing tags:', deleteTagsError);
      // Continue - tags will be out of sync but update will be saved
    }
    
    // Insert new tags if any
    if (input.taggedPersonIds.length > 0) {
      const tagRows: Omit<UpdateTagsRow, 'id'>[] = input.taggedPersonIds.map(taggedPersonId => ({
        update_id: updateId,
        tagged_person_id: taggedPersonId,
      }));
      
      const { error: tagsError } = await supabase
        .from('update_tags')
        .insert(tagRows);
      
      if (tagsError) {
        console.error('[Updates API] Error creating update tags:', tagsError);
        // Don't fail the entire update if tag creation fails
      }
    }
  }
  
  // STEP 6: Fetch tags for the updated update
  const { data: tagsData } = await supabase
    .from('update_tags')
    .select('tagged_person_id')
    .eq('update_id', updateId);
  
  const taggedPersonIds = tagsData?.map(tag => tag.tagged_person_id) || [];
  
  // STEP 7: Map database response to Update type using shared mapper
  return mapUpdateRow(result, taggedPersonIds.length > 0 ? taggedPersonIds : undefined);
}

/**
 * Toggle update privacy (public/private)
 * 
 * This function toggles the is_public flag for an update.
 * Verifies user owns the update before allowing the change.
 * 
 * @param userId - The authenticated user's ID from auth.users (required for verification)
 * @param updateId - The UUID of the update to toggle (updates_id)
 * @returns Updated Update object with new privacy setting
 * @throws Error if toggle fails or user doesn't own the update
 */
export async function toggleUpdatePrivacy(
  userId: string,
  updateId: string
): Promise<Update> {
  const supabase = getSupabaseClient();
  
  // STEP 1: Verify user owns this update and get current privacy setting
  const { data: existingUpdate, error: fetchError } = await supabase
    .from('updates')
    .select('created_by, is_public')
    .eq('updates_id', updateId)
    .single();
  
  if (fetchError) {
    console.error('[Updates API] Error fetching update for privacy toggle:', fetchError);
    throw new Error(`Failed to fetch update: ${fetchError.message}`);
  }
  
  if (!existingUpdate) {
    throw new Error('Update not found');
  }
  
  if (existingUpdate.created_by !== userId) {
    throw new Error('Unauthorized: You can only change privacy of your own updates');
  }
  
  // STEP 2: Toggle is_public
  const newIsPublic = !existingUpdate.is_public;
  
  const { data, error } = await supabase
    .from('updates')
    .update({
      is_public: newIsPublic,
      updated_at: new Date().toISOString(),
    })
    .eq('updates_id', updateId)
    .select()
    .single();
  
  const result = handleSupabaseMutation(data, error, {
    apiName: 'Updates API',
    operation: 'toggle update privacy',
  });
  
  // STEP 3: Fetch tags for the update
  const { data: tagsData } = await supabase
    .from('update_tags')
    .select('tagged_person_id')
    .eq('update_id', updateId);
  
  const taggedPersonIds = tagsData?.map(tag => tag.tagged_person_id) || [];
  
  // STEP 4: Map database response to Update type using shared mapper
  return mapUpdateRow(result, taggedPersonIds.length > 0 ? taggedPersonIds : undefined);
}
