/**
 * People API Service
 * 
 * Handles all Supabase operations related to people/person records.
 * Provides type-safe functions for fetching and creating person records.
 */

import { getSupabaseClient } from './supabase-init';
import type { Person, Gender } from '@/types/family-tree';
import { uploadImage, STORAGE_BUCKETS } from './storage-api';
import { handleSupabaseQuery, handleSupabaseMutation, handleDuplicateKeyError } from '@/utils/supabase-error-handler';

/**
 * Database row type for people table
 * Maps directly to PostgreSQL schema
 * NOTE: updated_by and version columns are optional (may not exist in current schema)
 */
interface PeopleRow {
  // NOTE: people table uses user_id as primary key, NOT id
  user_id: string; // Primary key - NOT NULL
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
  linked_auth_user_id?: string | null; // Links to auth.users.id - distinguishes Living vs Ancestor profiles
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
  
  // NOTE: Query by linked_auth_user_id (not user_id) since user_id is now DB-generated
  // linked_auth_user_id is the bridge to Supabase Auth (userId from auth.users)
  const { data, error } = await supabase
    .from('people')
    .select('*')
    .eq('linked_auth_user_id', userId) // Query by linked_auth_user_id (bridge to Supabase Auth)
    .single();
  
  // Handle error - allow null for "not found" (PGRST116)
  const result = handleSupabaseQuery(data, error, {
    apiName: 'People API',
    operation: 'fetch user profile',
  });
  
  if (!result) {
    return null;
  }
  
  // Explicitly map every database field to Person type
  // Handle optional columns gracefully
  // CRITICAL: Database uses user_id as primary key (NOT id)
  if (!data.user_id) {
    console.error('[People API] No user_id found in database response:', data);
    throw new Error('Database response missing user_id');
  }
  
  const person: Person = {
    id: data.user_id, // Use user_id as Person.id (frontend uses 'id' for consistency)
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
    createdAt: new Date(result.created_at).getTime(),
    updatedAt: new Date(result.updated_at).getTime(),
    createdBy: result.created_by || undefined,
    updatedBy: (result as any).updated_by || undefined, // Optional column
    version: (result as any).version || 1, // Optional column, default to 1
    hiddenTaggedUpdateIds: undefined, // Will be loaded later if needed
    linkedAuthUserId: result.linked_auth_user_id || undefined, // Living profile if set, Ancestor if null
  };
  
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
        photoUrl = undefined;
      }
    } catch (error: any) {
      console.error('[People API] Error uploading photo:', error);
      // Don't fail the entire profile creation if photo upload fails
      // Continue without photo - user can add it later
      photoUrl = undefined;
    }
  }
  
  // STEP 2: Prepare database row (map TypeScript types to PostgreSQL schema)
  // NOTE: user_id is now DB-generated (gen_random_uuid()), not manually set
  // NOTE: linked_auth_user_id is the bridge to Supabase Auth (userId from auth.users)
  const row = {
    // REMOVED: user_id - Let database generate it automatically
    name: input.name.trim(),
    birth_date: input.birthDate || null,
    death_date: null,
    gender: input.gender || null,
    photo_url: photoUrl || null, // Use uploaded URL or original remote URL
    bio: input.bio || null,
    phone_number: input.phoneNumber || null,
    created_by: userId, // The curator (authenticated user who created this profile)
    linked_auth_user_id: userId, // CRITICAL: Bridge to Supabase Auth - links profile to authenticated user
    // Note: updated_by and version columns don't exist in current schema
    // Add them here if you add the columns to your database
  };
  
  // STEP 3: Insert into database (atomic operation)
  let { data, error } = await supabase
    .from('people')
    .insert(row)
    .select()
    .single();
  
  // Handle duplicate key error with recovery (race condition)
  let result;
  try {
    result = handleSupabaseMutation(data, error, {
      apiName: 'People API',
      operation: 'create ego profile',
    });
  } catch (err: any) {
    // Check if it's a duplicate key error and try to recover
    if (error?.code === '23505') {
      const existingProfile = await handleDuplicateKeyError(
        error,
        () => getUserProfile(userId),
        'People API',
        'create ego profile'
      );
      if (existingProfile) {
        return existingProfile;
      }
    }
    // Re-throw if not a duplicate key error or recovery failed
    throw err;
  }
  
  // STEP 4: Map database response to Person type
  // Explicitly map every database field to Person type
  // CRITICAL: Database uses user_id as primary key (NOT id)
  if (!result.user_id) {
    console.error('[People API] No user_id found in create response:', result);
    throw new Error('Database response missing user_id');
  }
  
  const person: Person = {
    id: result.user_id, // Use user_id as Person.id (frontend uses 'id' for consistency)
    name: result.name,
    birthDate: result.birth_date || undefined,
    deathDate: result.death_date || undefined,
    gender: (result.gender as Gender) || undefined,
    photoUrl: result.photo_url || undefined,
    bio: result.bio || undefined,
    phoneNumber: result.phone_number || undefined,
    parentIds: [], // New profile has no relationships yet
    spouseIds: [],
    childIds: [],
    siblingIds: [],
    createdAt: new Date(result.created_at).getTime(),
    updatedAt: new Date(result.updated_at).getTime(),
    createdBy: result.created_by || undefined,
    updatedBy: (result as any).updated_by || undefined, // Optional column
    version: (result as any).version || 1, // Optional column, default to 1
    hiddenTaggedUpdateIds: undefined,
    linkedAuthUserId: result.linked_auth_user_id || undefined, // Living profile if set, Ancestor if null
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
  
  // Security check: Ensure linked_auth_user_id matches (user can only update their own profile)
  // NOTE: existingProfile.id is now DB-generated user_id, not auth.uid()
  // NOTE: We check linkedAuthUserId which is the bridge to Supabase Auth
  if (existingProfile.linkedAuthUserId !== userId) {
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
  // NOTE: Query by linked_auth_user_id (not user_id) since user_id is now DB-generated
  // linked_auth_user_id is the bridge to Supabase Auth (userId from auth.users)
  const { data, error } = await supabase
    .from('people')
    .update(updateRow)
    .eq('linked_auth_user_id', userId) // Security: Only update if linked_auth_user_id matches
    .select()
    .single();
  
  const result = handleSupabaseMutation(data, error, {
    apiName: 'People API',
    operation: 'update ego profile',
  });
  
  // STEP 4: Map database response to Person type
  // CRITICAL: Database uses user_id as primary key (NOT id)
  if (!result.user_id) {
    console.error('[People API] No user_id found in update response:', result);
    throw new Error('Database response missing user_id');
  }
  
  const person: Person = {
    id: result.user_id, // Use user_id as Person.id (frontend uses 'id' for consistency)
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
    linkedAuthUserId: data.linked_auth_user_id || existingProfile.linkedAuthUserId || undefined, // Preserve linked auth user ID
  };
  
  return person;
}

/**
 * Create a new relative (non-ego person) in Supabase
 * 
 * IMPORTANT: 
 * - Creates an Ancestor profile (linked_auth_user_id is NULL)
 * - Uploads local photos to Supabase Storage before saving to database
 * - Used for adding family members who don't have accounts yet
 * 
 * @param userId - The authenticated user's ID from auth.users (required for created_by)
 * @param input - Person data to create
 * @returns Created Person object
 * @throws Error if creation fails
 */
export async function createRelative(
  userId: string,
  input: CreatePersonInput
): Promise<Person> {
  const supabase = getSupabaseClient();
  
  // STEP 1: Upload photo to Supabase Storage if it's a local file URI
  let photoUrl: string | null = input.photoUrl || null;
  
  if (photoUrl?.startsWith('file://')) {
    try {
      const uploadedUrl = await uploadImage(
        photoUrl,
        STORAGE_BUCKETS.PERSON_PHOTOS,
        `relatives/${userId}` // Organize by creator
      );
      
      if (uploadedUrl) {
        photoUrl = uploadedUrl;
      } else {
        console.warn('[People API] Photo upload returned null, continuing without photo');
        photoUrl = null;
      }
    } catch (error: any) {
      console.error('[People API] Error uploading photo:', error);
      photoUrl = null;
    }
  }
  
  // STEP 2: Prepare database row
  // NOTE: user_id is now DB-generated (gen_random_uuid()), not manually set
  // NOTE: linked_auth_user_id is NULL for relatives (Ancestor/Shadow profiles)
  // NOTE: Do NOT include 'id' - table only has user_id as primary key
  // CRITICAL: created_by MUST match auth.uid() for RLS policy to allow insert
  const row = {
    // REMOVED: user_id - Let database generate it automatically
    name: input.name.trim(),
    birth_date: input.birthDate || null,
    death_date: null,
    gender: input.gender || null,
    photo_url: photoUrl,
    bio: input.bio || null,
    phone_number: input.phoneNumber || null,
    created_by: userId, // CRITICAL: MUST match the logged-in user's UUID (auth.uid()) for RLS policy
    linked_auth_user_id: null, // Always null for new relatives (Ancestor/Shadow profiles)
  };
  
  // STEP 4: Insert into database
  // CRITICAL: .select() is required to get the new user_id back from the database
  const { data, error } = await supabase
    .from('people')
    .insert(row)
    .select() // This is important to get the new user_id back
    .single();
  
  const result = handleSupabaseMutation(data, error, {
    apiName: 'People API',
    operation: 'create relative',
  });
  
  // STEP 5: Map database response to Person type
  // NOTE: Database uses user_id as primary key (NOT id)
  if (!result.user_id) {
    throw new Error('Database response missing user_id');
  }
  
  const person: Person = {
    id: result.user_id, // Use user_id as the Person.id (frontend uses 'id' for consistency)
    name: result.name,
    birthDate: result.birth_date || undefined,
    deathDate: result.death_date || undefined,
    gender: (result.gender as Gender) || undefined,
    photoUrl: result.photo_url || undefined,
    bio: result.bio || undefined,
    phoneNumber: result.phone_number || undefined,
    parentIds: [], // New relative has no relationships yet
    spouseIds: [],
    childIds: [],
    siblingIds: [],
    createdAt: new Date(result.created_at).getTime(),
    updatedAt: new Date(result.updated_at).getTime(),
    createdBy: result.created_by || undefined,
    updatedBy: (result as any).updated_by || undefined,
    version: (result as any).version || 1,
    hiddenTaggedUpdateIds: undefined,
    linkedAuthUserId: result.linked_auth_user_id || undefined, // Should be null/undefined for relatives
  };
  
  return person;
}

/**
 * Get all people in the family tree
 * 
 * This function loads all people and their relationships from the database.
 * Used for initial sync when app starts.
 * 
 * @returns Array of Person objects with relationships populated
 */
export async function getAllPeople(): Promise<Person[]> {
  const supabase = getSupabaseClient();
  
  // STEP 1: Fetch all people and relationships in parallel for efficiency
  // This is significantly faster than sequential fetching
  const [peopleResponse, relationshipsResponse] = await Promise.all([
    supabase.from('people').select('*').order('created_at', { ascending: true }),
    supabase.from('relationships').select('*'),
  ]);

  const { data: peopleData, error: peopleError } = peopleResponse;
  const { data: relationshipsData, error: relationshipsError } = relationshipsResponse;
  
  if (__DEV__) {
    console.log('[People API] getAllPeople: Fetched data', { 
      peopleCount: peopleData?.length || 0,
      relationshipsCount: relationshipsData?.length || 0,
    });
  }

  // Handle people fetch error (must throw if error)
  if (peopleError) {
    handleSupabaseMutation(peopleData, peopleError, {
      apiName: 'People API',
      operation: 'fetch people',
    });
    return []; // Never reached, but satisfies TypeScript
  }

  if (!peopleData || peopleData.length === 0) {
    return []; // No people in database yet
  }

  // Handle relationships fetch error (non-fatal - continue without relationships)
  if (relationshipsError) {
    if (__DEV__) {
      console.warn('[People API] Error fetching relationships (non-fatal):', relationshipsError);
    }
    // Don't fail - continue without relationships (can be loaded separately)
  }
  
  // STEP 3: Build relationship maps for efficient lookup
  const parentMap = new Map<string, string[]>(); // personId -> parentIds[]
  const childMap = new Map<string, string[]>(); // personId -> childIds[]
  const spouseMap = new Map<string, string[]>(); // personId -> spouseIds[]
  const siblingMap = new Map<string, string[]>(); // personId -> siblingIds[]
  
  if (relationshipsData) {
    for (const rel of relationshipsData) {
      const personOneId = rel.person_one_id;
      const personTwoId = rel.person_two_id;
      const type = rel.relationship_type;
      
      switch (type) {
        case 'parent':
          // person_one is parent of person_two
          const childIds = childMap.get(personOneId) || [];
          if (!childIds.includes(personTwoId)) {
            childMap.set(personOneId, [...childIds, personTwoId]);
          }
          const parentIds = parentMap.get(personTwoId) || [];
          if (!parentIds.includes(personOneId)) {
            parentMap.set(personTwoId, [...parentIds, personOneId]);
          }
          break;
          
        case 'child':
          // CRITICAL FIX: When relationship_type is 'child', person_one is the PARENT, person_two is the CHILD
          // This matches how addChild stores it: personOneId=parentId, personTwoId=childId, relationshipType='child'
          // So: person_one (parent) has child person_two (child)
          const childIds2 = childMap.get(personOneId) || [];
          if (!childIds2.includes(personTwoId)) {
            childMap.set(personOneId, [...childIds2, personTwoId]);
          }
          const parentIds2 = parentMap.get(personTwoId) || [];
          if (!parentIds2.includes(personOneId)) {
            parentMap.set(personTwoId, [...parentIds2, personOneId]);
          }
          break;
          
        case 'spouse':
          // Bidirectional relationship
          const spouseIds1 = spouseMap.get(personOneId) || [];
          if (!spouseIds1.includes(personTwoId)) {
            spouseMap.set(personOneId, [...spouseIds1, personTwoId]);
          }
          const spouseIds2 = spouseMap.get(personTwoId) || [];
          if (!spouseIds2.includes(personOneId)) {
            spouseMap.set(personTwoId, [...spouseIds2, personOneId]);
          }
          break;
          
        case 'sibling':
          // Bidirectional relationship
          const siblingIds1 = siblingMap.get(personOneId) || [];
          if (!siblingIds1.includes(personTwoId)) {
            siblingMap.set(personOneId, [...siblingIds1, personTwoId]);
          }
          const siblingIds2 = siblingMap.get(personTwoId) || [];
          if (!siblingIds2.includes(personOneId)) {
            siblingMap.set(personTwoId, [...siblingIds2, personOneId]);
          }
          break;
      }
    }
  }
  
  // STEP 4: Map database rows to Person objects with relationships
  // CRITICAL: Database uses user_id as primary key (NOT id)
  const people: Person[] = peopleData
    .filter((row) => row.user_id != null) // Filter out rows without user_id
    .map((row) => {
      const personId = row.user_id!; // We know it's not null from filter above
      
      return {
        id: personId, // Use user_id as Person.id (frontend uses 'id' for consistency)
        name: row.name,
        birthDate: row.birth_date || undefined,
        deathDate: row.death_date || undefined,
        gender: (row.gender as Gender) || undefined,
        photoUrl: row.photo_url || undefined,
        bio: row.bio || undefined,
        phoneNumber: row.phone_number || undefined,
        parentIds: parentMap.get(personId) || [],
        spouseIds: spouseMap.get(personId) || [],
        childIds: childMap.get(personId) || [],
        siblingIds: siblingMap.get(personId) || [],
        createdAt: new Date(row.created_at).getTime(),
        updatedAt: new Date(row.updated_at).getTime(),
        createdBy: row.created_by || undefined,
        updatedBy: (row as any).updated_by || undefined,
        version: (row as any).version || 1,
        hiddenTaggedUpdateIds: undefined, // Will be loaded from updates if needed
        linkedAuthUserId: row.linked_auth_user_id || undefined,
      };
    });
  return people;
}
