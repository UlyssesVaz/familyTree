/**
 * People API Service
 * 
 * Handles all Supabase operations related to people/person records.
 * Provides type-safe functions for fetching and creating person records.
 */

import { getSupabaseClient } from './supabase-init';
import type { Person, Gender } from '@/types/family-tree';
import { uploadImage, STORAGE_BUCKETS } from './storage-api';

/**
 * Database row type for people table
 * Maps directly to PostgreSQL schema
 * NOTE: updated_by and version columns are optional (may not exist in current schema)
 */
interface PeopleRow {
  id: string;
  user_id: string | null;
  name: string;
  birth_date: string | null;
  death_date: string | null;
  gender: 'male' | 'female' | 'other' | null;
  photo_url: string | null;
  bio: string | null;
  phone_number: string | null;
  created_at: string; // ISO 8601 timestamp
  updated_at: string; // ISO 8601 timestamp
  created_by: string | null;
  updated_by?: string | null; // Optional - may not exist in schema
  version?: number; // Optional - may not exist in schema
}

/**
 * Input type for creating a new person profile
 */
export interface CreatePersonInput {
  name: string;
  birthDate?: string;
  gender?: Gender;
  photoUrl?: string; // Can be local file:// URI or remote URL
  bio?: string;
  phoneNumber?: string;
}

/**
 * Get user's profile (ego) from Supabase
 * 
 * @param userId - The authenticated user's ID from auth.users
 * @returns Person object if found, null if not found
 * @throws Error if database query fails
 */
export async function getUserProfile(userId: string): Promise<Person | null> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('people')
    .select('*')
    .eq('user_id', userId)
    .single();
  
  // PGRST116 = no rows returned (expected for new users)
  if (error) {
    if (error.code === 'PGRST116') {
      // No profile found - this is a new user
      return null;
    }
    // Actual error - rethrow
    console.error('[People API] Error fetching user profile:', error);
    throw new Error(`Failed to fetch user profile: ${error.message}`);
  }
  
  if (!data) {
    return null;
  }
  
  // #region agent log
  fetch('http://127.0.0.1:7244/ingest/f336e8f0-8f7a-40aa-8f54-32371722b5de',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'people-api.ts:73',message:'Database response structure',data:{hasId:!!data.id,hasUserId:!!data.user_id,idValue:data.id,userIdValue:data.user_id,allKeys:Object.keys(data)},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'B'})}).catch(()=>{});
  // #endregion
  
  // Explicitly map every database field to Person type
  // Handle optional columns gracefully
  // CRITICAL: Use user_id as id if id doesn't exist (database schema uses user_id as primary key)
  const personId = data.id || data.user_id;
  if (!personId) {
    console.error('[People API] No id or user_id found in database response:', data);
    throw new Error('Database response missing identifier');
  }
  
  const person: Person = {
    id: personId,
    name: data.name,
    birthDate: data.birth_date || undefined,
    deathDate: data.death_date || undefined,
    gender: (data.gender as Gender) || undefined,
    photoUrl: data.photo_url || undefined,
    bio: data.bio || undefined,
    phoneNumber: data.phone_number || undefined,
    parentIds: [], // Will be loaded from relationships table later
    spouseIds: [], // Will be loaded from relationships table later
    childIds: [], // Will be loaded from relationships table later
    siblingIds: [], // Will be loaded from relationships table later
    createdAt: new Date(data.created_at).getTime(),
    updatedAt: new Date(data.updated_at).getTime(),
    createdBy: data.created_by || undefined,
    updatedBy: (data as any).updated_by || undefined, // Optional column
    version: (data as any).version || 1, // Optional column, default to 1
    hiddenTaggedUpdateIds: undefined, // Will be loaded later if needed
  };
  
  // #region agent log
  fetch('http://127.0.0.1:7244/ingest/f336e8f0-8f7a-40aa-8f54-32371722b5de',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'people-api.ts:100',message:'Mapped Person object',data:{personId:person.id,personCreatedBy:person.createdBy,requestedUserId:userId},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'B'})}).catch(()=>{});
  // #endregion
  
  return person;
}

/**
 * Create a new person profile (ego) in Supabase
 * 
 * IMPORTANT: Uploads local photos to Supabase Storage before saving to database.
 * Only navigates to next step after successful 201 Created response.
 * 
 * @param userId - The authenticated user's ID from auth.users (required)
 * @param input - Person data to create
 * @returns Created Person object
 * @throws Error if creation fails
 */
export async function createEgoProfile(
  userId: string,
  input: CreatePersonInput
): Promise<Person> {
  const supabase = getSupabaseClient();
  
  // STEP 0: Check if profile already exists (prevent duplicate creation)
  const existingProfile = await getUserProfile(userId);
  if (existingProfile) {
    console.warn('[People API] Profile already exists for user, returning existing profile');
    return existingProfile;
  }
  
  // STEP 1: Upload photo to Supabase Storage if it's a local file URI
  // This must complete BEFORE we save to database
  let photoUrl = input.photoUrl;
  
  if (photoUrl?.startsWith('file://')) {
    try {
      // Upload local file to Supabase Storage
      const uploadedUrl = await uploadImage(
        photoUrl,
        STORAGE_BUCKETS.PERSON_PHOTOS,
        `profiles/${userId}` // Organize by user ID
      );
      
      if (uploadedUrl) {
        photoUrl = uploadedUrl; // Use uploaded URL instead of local URI
      } else {
        console.warn('[People API] Photo upload returned null, continuing without photo');
        photoUrl = null;
      }
    } catch (error: any) {
      console.error('[People API] Error uploading photo:', error);
      // Don't fail the entire profile creation if photo upload fails
      // Continue without photo - user can add it later
      photoUrl = null;
    }
  }
  
  // STEP 2: Prepare database row (map TypeScript types to PostgreSQL schema)
  // Only include columns that exist in your current schema
  const row = {
    user_id: userId, // Required: links person to auth.users
    name: input.name.trim(),
    birth_date: input.birthDate || null,
    death_date: null,
    gender: input.gender || null,
    photo_url: photoUrl || null, // Use uploaded URL or original remote URL
    bio: input.bio || null,
    phone_number: input.phoneNumber || null,
    created_by: userId, // User creates their own profile
    // Note: updated_by and version columns don't exist in current schema
    // Add them here if you add the columns to your database
  };
  
  // STEP 3: Insert into database (atomic operation)
  const { data, error } = await supabase
    .from('people')
    .insert(row)
    .select()
    .single();
  
  if (error) {
    console.error('[People API] Error creating ego profile:', error);
    
    // Handle specific error cases
    if (error.code === '23505') {
      // Duplicate key error - profile might have been created between check and insert
      // Try to fetch existing profile
      const existingProfile = await getUserProfile(userId);
      if (existingProfile) {
        console.warn('[People API] Profile was created concurrently, returning existing profile');
        return existingProfile;
      }
      throw new Error('Profile already exists. Please refresh and try again.');
    }
    
    throw new Error(`Failed to create profile: ${error.message}`);
  }
  
  if (!data) {
    throw new Error('Failed to create profile: No data returned');
  }
  
  // #region agent log
  fetch('http://127.0.0.1:7244/ingest/f336e8f0-8f7a-40aa-8f54-32371722b5de',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'people-api.ts:195',message:'Create profile database response',data:{hasId:!!data.id,hasUserId:!!data.user_id,idValue:data.id,userIdValue:data.user_id,allKeys:Object.keys(data)},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'D'})}).catch(()=>{});
  // #endregion
  
  // STEP 4: Map database response to Person type
  // Explicitly map every database field to Person type
  // CRITICAL: Use user_id as id if id doesn't exist (database schema uses user_id as primary key)
  const personId = data.id || data.user_id;
  if (!personId) {
    console.error('[People API] No id or user_id found in create response:', data);
    throw new Error('Database response missing identifier');
  }
  
  const person: Person = {
    id: personId,
    name: data.name,
    birthDate: data.birth_date || undefined,
    deathDate: data.death_date || undefined,
    gender: (data.gender as Gender) || undefined,
    photoUrl: data.photo_url || undefined,
    bio: data.bio || undefined,
    phoneNumber: data.phone_number || undefined,
    parentIds: [], // New profile has no relationships yet
    spouseIds: [],
    childIds: [],
    siblingIds: [],
    createdAt: new Date(data.created_at).getTime(),
    updatedAt: new Date(data.updated_at).getTime(),
    createdBy: data.created_by || undefined,
    updatedBy: (data as any).updated_by || undefined, // Optional column
    version: (data as any).version || 1, // Optional column, default to 1
    hiddenTaggedUpdateIds: undefined,
  };
  
  return person;
}

/**
 * Update user's profile (ego) in Supabase
 * 
 * IMPORTANT: 
 * - Only allows updating the profile that matches the userId (security check)
 * - Uploads local photos to Supabase Storage before saving to database
 * - Updates updated_at timestamp automatically
 * 
 * @param userId - The authenticated user's ID from auth.users (required for security)
 * @param updates - Partial Person data to update (only fields that can be updated)
 * @returns Updated Person object
 * @throws Error if update fails or user doesn't own the profile
 */
export async function updateEgoProfile(
  userId: string,
  updates: Partial<Pick<Person, 'name' | 'bio' | 'birthDate' | 'gender' | 'photoUrl'>>
): Promise<Person> {
  const supabase = getSupabaseClient();
  
  // STEP 0: Verify profile exists and user owns it
  const existingProfile = await getUserProfile(userId);
  if (!existingProfile) {
    throw new Error('Profile not found. Please create a profile first.');
  }
  
  // Security check: Ensure user_id matches (user can only update their own profile)
  if (existingProfile.id !== userId && existingProfile.createdBy !== userId) {
    throw new Error('Unauthorized: You can only update your own profile.');
  }
  
  // STEP 1: Upload photo to Supabase Storage if it's a local file URI
  // This must complete BEFORE we save to database
  let photoUrl = updates.photoUrl;
  
  if (photoUrl?.startsWith('file://')) {
    try {
      // Upload local file to Supabase Storage
      const uploadedUrl = await uploadImage(
        photoUrl,
        STORAGE_BUCKETS.PERSON_PHOTOS,
        `profiles/${userId}` // Organize by user ID
      );
      
      if (uploadedUrl) {
        photoUrl = uploadedUrl; // Use uploaded URL instead of local URI
      } else {
        console.warn('[People API] Photo upload returned null, keeping existing photo');
        // Don't update photo_url if upload failed - keep existing
        photoUrl = undefined;
      }
    } catch (error: any) {
      console.error('[People API] Error uploading photo:', error);
      // Don't fail the entire update if photo upload fails
      // Keep existing photo - user can try again
      photoUrl = undefined;
    }
  }
  
  // STEP 2: Prepare update object (only include fields that are being updated)
  // Map TypeScript types to PostgreSQL schema
  const updateRow: Partial<PeopleRow> = {};
  
  if (updates.name !== undefined) {
    updateRow.name = updates.name.trim();
  }
  if (updates.bio !== undefined) {
    updateRow.bio = updates.bio || null; // Allow clearing bio
  }
  if (updates.birthDate !== undefined) {
    updateRow.birth_date = updates.birthDate || null; // Allow clearing birth date
  }
  if (updates.gender !== undefined) {
    updateRow.gender = updates.gender || null; // Allow clearing gender
  }
  if (photoUrl !== undefined) {
    // Only update photo_url if we have a new value (either uploaded or remote URL)
    // If photoUrl is undefined, it means upload failed - don't update the field
    if (photoUrl !== null) {
      updateRow.photo_url = photoUrl;
    }
    // If photoUrl is null, we're explicitly clearing it
    else {
      updateRow.photo_url = null;
    }
  }
  
  // Don't update updated_at manually - let database handle it with DEFAULT NOW()
  // But we can explicitly set it if your schema requires it
  // updateRow.updated_at = new Date().toISOString();
  
  // STEP 3: Update database row (only update fields that changed)
  // Use user_id to identify the row (more reliable than id)
  const { data, error } = await supabase
    .from('people')
    .update(updateRow)
    .eq('user_id', userId) // Security: Only update if user_id matches
    .select()
    .single();
  
  if (error) {
    console.error('[People API] Error updating ego profile:', error);
    throw new Error(`Failed to update profile: ${error.message}`);
  }
  
  if (!data) {
    throw new Error('Failed to update profile: No data returned');
  }
  
  // STEP 4: Map database response to Person type
  const personId = data.id || data.user_id;
  if (!personId) {
    console.error('[People API] No id or user_id found in update response:', data);
    throw new Error('Database response missing identifier');
  }
  
  const person: Person = {
    id: personId,
    name: data.name,
    birthDate: data.birth_date || undefined,
    deathDate: data.death_date || undefined,
    gender: (data.gender as Gender) || undefined,
    photoUrl: data.photo_url || undefined,
    bio: data.bio || undefined,
    phoneNumber: data.phone_number || undefined,
    parentIds: existingProfile.parentIds, // Keep existing relationships
    spouseIds: existingProfile.spouseIds,
    childIds: existingProfile.childIds,
    siblingIds: existingProfile.siblingIds,
    createdAt: existingProfile.createdAt, // Keep original creation time
    updatedAt: new Date(data.updated_at).getTime(), // Use new updated_at from database
    createdBy: data.created_by || undefined,
    updatedBy: (data as any).updated_by || undefined, // Optional column
    version: ((data as any).version || existingProfile.version) + 1, // Increment version if column exists
    hiddenTaggedUpdateIds: existingProfile.hiddenTaggedUpdateIds, // Keep existing hidden updates
  };
  
  return person;
}
