/**
 * Updates API Service
 * 
 * Handles all Supabase operations related to updates/posts.
 * Provides type-safe functions for creating, fetching, updating, and deleting updates.
 */

import { getSupabaseClient } from './supabase-init';
import type { Update } from '@/types/family-tree';
import { uploadImage, STORAGE_BUCKETS } from './storage-api';

/**
 * Database row type for updates table
 * Maps directly to PostgreSQL schema
 * NOTE: Composite PRIMARY KEY is (user_id, created_by)
 */
interface UpdatesRow {
  user_id: string; // Part of composite PK, FOREIGN KEY to people.user_id
  created_by: string; // Part of composite PK, FOREIGN KEY to auth.users.id (NOT NULL now)
  title: string;
  photo_url: string | null;
  caption: string | null;
  is_public: boolean;
  created_at: string; // ISO 8601 timestamp
  updated_at: string; // ISO 8601 timestamp
}

/**
 * Database row type for update_tags table
 */
interface UpdateTagsRow {
  id: string;
  update_id: string;
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
  let photoUrl = input.photoUrl;
  
  if (photoUrl?.startsWith('file://')) {
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
  
  // STEP 2: Prepare database row (map TypeScript types to PostgreSQL schema)
  // Composite PRIMARY KEY is (user_id, created_by)
  // IMPORTANT: created_by MUST be auth.uid() (the logged-in user) for RLS policy to pass
  // user_id is the person whose wall this update belongs to
  // Note: created_at and updated_at are handled by database defaults/triggers
  const row: Omit<UpdatesRow, 'created_at' | 'updated_at'> = {
    user_id: input.personId, // Part of composite PK, FK to people.user_id (the person whose wall this is)
    created_by: authenticatedUserId, // Part of composite PK, FK to auth.users.id (MUST be auth.uid() for RLS)
    title: input.title.trim(),
    photo_url: photoUrl || null, // Use uploaded URL or original remote URL
    caption: input.caption?.trim() || null,
    is_public: input.isPublic ?? true, // Default to public
  };
  
  // STEP 3: Upsert into database (composite PK: user_id + created_by)
  // This allows each user to have one update per person, but multiple users can create updates for the same person
  // Note: RLS policies now allow SELECT after INSERT, so .select() should work
  const { data, error } = await supabase
    .from('updates')
    .upsert(row, {
      onConflict: 'user_id,created_by', // Conflict on composite primary key
    })
    .select()
    .single();
  
  if (error) {
    console.error('[Updates API] Error creating/updating update:', error);
    throw new Error(`Failed to create update: ${error.message}`);
  }
  
  if (!data) {
    throw new Error('Failed to create update: No data returned');
  }
  
  // Create a unique identifier for this update (composite key as string)
  // Format: "{user_id}:{created_by}" for use in update_tags and Update.id
  const finalUpdateId = `${data.user_id}:${data.created_by}`;
  
  // STEP 4: Create update_tags entries if taggedPersonIds provided
  // First, delete existing tags for this update (since we're upserting)
  if (input.taggedPersonIds && input.taggedPersonIds.length > 0) {
    // Delete existing tags for this update
    await supabase
      .from('update_tags')
      .delete()
      .eq('update_id', finalUpdateId);
    
    // Insert new tags
    const tagRows: Omit<UpdateTagsRow, 'id'>[] = input.taggedPersonIds.map(taggedPersonId => ({
      update_id: finalUpdateId, // References updates composite key
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
  } else {
    // If no tags provided, delete any existing tags
    await supabase
      .from('update_tags')
      .delete()
      .eq('update_id', finalUpdateId);
  }
  
  // STEP 5: Map database response to Update type
  const update: Update = {
    id: finalUpdateId, // Composite key as string
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
 * NOTE: With composite PK (user_id, created_by), multiple users can create updates
 * for the same person. This function returns all updates for that person.
 * 
 * @param personId - The person's user_id to get updates for
 * @returns Array of Update objects, sorted by created_at (newest first)
 * @throws Error if query fails
 */
export async function getUpdatesForPerson(personId: string): Promise<Update[]> {
  const supabase = getSupabaseClient();
  
  // Query updates table by user_id (part of composite PK)
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
  
  // Build array of composite update IDs for querying tags
  const updateIds = updatesData.map(u => `${u.user_id}:${u.created_by}`);
  
  // Query update_tags table for all updates
  // Note: update_id in tags table should match the composite key format
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
    const updateId = `${row.user_id}:${row.created_by}`;
    return {
      id: updateId, // Composite key as string
      personId: row.user_id, // The person this update belongs to
      title: row.title,
      photoUrl: row.photo_url || '', // Required field, use empty string if null
      caption: row.caption || undefined,
      isPublic: row.is_public,
      taggedPersonIds: tagsMap.get(updateId) || undefined,
      createdAt: new Date(row.created_at).getTime(),
      createdBy: row.created_by, // The user who created this update
    };
  });
  
  return updates;
}
