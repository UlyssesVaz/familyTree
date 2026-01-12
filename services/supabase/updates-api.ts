/**
 * Updates API Service
 * 
 * Handles all Supabase operations related to updates/posts.
 * Provides type-safe functions for creating, fetching, updating, and deleting updates.
 */

import { getSupabaseClient } from './supabase-init';
import type { Update } from '@/types/family-tree';
import { uploadImage, deleteImage, STORAGE_BUCKETS } from './storage-api';
import { v4 as uuidv4 } from 'uuid';

/**
 * Database row type for updates table
 * Maps directly to PostgreSQL schema
 * NOTE: PRIMARY KEY is now updates_id (UUID)
 */
interface UpdatesRow {
  updates_id: string; // PRIMARY KEY (UUID)
  user_id: string; // FOREIGN KEY to people.user_id (the person whose wall this update is on)
  created_by: string; // FOREIGN KEY to auth.users.id (the user who created this update)
  title: string;
  photo_url: string | null;
  caption: string | null;
  is_public: boolean;
  created_at: string; // ISO 8601 timestamp
  updated_at: string; // ISO 8601 timestamp
  deleted_at?: string | null; // ISO 8601 timestamp for soft delete
}

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
  
  // Get current auth user - use auth.uid() directly for created_by (RLS policy requirement)
  const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !authUser?.id) {
    throw new Error(`Authentication required: ${authError?.message || 'No user session'}`);
  }
  
  // Use auth.uid() directly instead of parameter to ensure it matches RLS policy
  const authenticatedUserId = authUser.id;
  
  // STEP 1: Upload photo to Supabase Storage if it's a local file URI
  // This must complete BEFORE we save to database
  let photoUrl: string | null = input.photoUrl || null;
  
  if (photoUrl && photoUrl.startsWith('file://')) {
    try {
      // Upload local file to Supabase Storage
      // Folder structure: update-photos/{authenticatedUserId}/uuid.jpg
      // Organized by creator - uploadImage generates unique filenames to prevent collisions
      const uploadedUrl = await uploadImage(
        photoUrl,
        STORAGE_BUCKETS.UPDATE_PHOTOS,
        authenticatedUserId // Single folder level: organize by creator only
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
  
  if (error) {
    console.error('[Updates API] Error creating update:', error);
    throw new Error(`Failed to create update: ${error.message}`);
  }
  
  if (!data) {
    throw new Error('Failed to create update: No data returned');
  }
  
  // STEP 5: Create update_tags entries if taggedPersonIds provided
  if (input.taggedPersonIds && input.taggedPersonIds.length > 0) {
    // Insert new tags (no need to delete existing tags since this is a new insert)
    const tagRows: Omit<UpdateTagsRow, 'id'>[] = input.taggedPersonIds.map(taggedPersonId => ({
      update_id: updatesId, // References updates.updates_id (UUID)
      tagged_person_id: taggedPersonId,
    }));
    
    const { error: tagsError } = await supabase
      .from('update_tags')
      .insert(tagRows);
    
    if (tagsError) {
      console.error('[Updates API] Error creating update tags:', tagsError);
      // Don't fail the entire update if tags fail - update is already created
      // Log error but continue
    }
  }
  
  // STEP 6: Map database response to Update type
  const update: Update = {
    id: updatesId, // UUID primary key
    personId: data.user_id, // The person this update belongs to
    title: data.title,
    photoUrl: data.photo_url || '', // Required field, use empty string if null
    caption: data.caption || undefined,
    isPublic: data.is_public,
    taggedPersonIds: input.taggedPersonIds && input.taggedPersonIds.length > 0 
      ? input.taggedPersonIds 
      : undefined,
    createdAt: new Date(data.created_at).getTime(),
    createdBy: data.created_by, // The user who created this update
  };
  
  return update;
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
    .is('deleted_at', null) // Exclude soft-deleted updates
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
  
  // Map database rows to Update type
  const updates: Update[] = updatesData.map((row) => {
    return {
      id: row.updates_id, // UUID primary key
      personId: row.user_id, // The person this update belongs to
      title: row.title,
      photoUrl: row.photo_url || '', // Required field, use empty string if null
      caption: row.caption || undefined,
      isPublic: row.is_public,
      taggedPersonIds: tagsMap.get(row.updates_id) || undefined,
      createdAt: new Date(row.created_at).getTime(),
      createdBy: row.created_by, // The user who created this update
      deletedAt: row.deleted_at ? new Date(row.deleted_at).getTime() : undefined,
    };
  });
  
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
