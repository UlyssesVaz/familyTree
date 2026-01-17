/**
 * People API Service
 * 
 * Handles all Supabase operations related to people/person records.
 * Provides type-safe functions for fetching and creating person records.
 */

import { getSupabaseClient } from './supabase-init';
import type { Person, Gender } from '@/types/family-tree';
import { STORAGE_BUCKETS } from './storage-api';
import { handleSupabaseQuery, handleSupabaseMutation, handleDuplicateKeyError } from '@/utils/supabase-error-handler';
import { uploadPhotoIfLocal } from './shared/photo-upload';
import { mapPersonRow, type PeopleRow } from './shared/mappers';
import { calculateAge, isAtLeast13 } from '@/utils/age-utils';
import { processAccountDeletion, processCOPPADeletion } from './account-api';
import { isCOPPABlocked, clearCOPPACache } from '@/utils/coppa-utils';

/**
 * Custom error class for COPPA violations - account deleted
 * This error is thrown when a user's age becomes < 13 after birth date update
 */
export class COPPAViolationError extends Error {
  constructor(message: string = 'Account deleted due to COPPA compliance violation') {
    super(message);
    this.name = 'COPPAViolationError';
  }
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
  privacyPolicyAcceptedAt?: string; // ISO 8601 timestamp (YYYY-MM-DDTHH:mm:ssZ) - when user accepted privacy policy
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
  
  // Map database row to Person type using shared mapper
  return mapPersonRow(result);
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
  
  // STEP 0: COPPA Compliance - Check if user is blocked from re-registration
  // This prevents users who were COPPA-deleted from creating new accounts
  const isBlocked = await isCOPPABlocked(userId);
  if (isBlocked) {
    throw new COPPAViolationError('You cannot create an account. Your previous account was permanently closed due to age requirements. You must be at least 13 years old to use this app.');
  }
  
  // STEP 1: Check if profile already exists (prevent duplicate creation)
  const existingProfile = await getUserProfile(userId);
  if (existingProfile) {
    console.warn('[People API] Profile already exists for user, returning existing profile');
    return existingProfile;
  }
  
  // STEP 1: Upload photo to Supabase Storage if it's a local file URI
  // This must complete BEFORE we save to database
  const photoUrl = await uploadPhotoIfLocal(
    input.photoUrl,
    STORAGE_BUCKETS.PERSON_PHOTOS,
    `profiles/${userId}`,
    'People API'
  ) ?? undefined; // Convert null to undefined for consistency
  
  // STEP 2: Prepare database row (map TypeScript types to PostgreSQL schema)
  // NOTE: user_id is now DB-generated (gen_random_uuid()), not manually set
  // NOTE: linked_auth_user_id is the bridge to Supabase Auth (userId from auth.users)
  const row: any = {
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
  
  // COPPA Compliance: Store privacy policy acceptance timestamp if provided
  // This field may not exist in all database schemas, so we conditionally include it
  if (input.privacyPolicyAcceptedAt) {
    row.privacy_policy_accepted_at = input.privacyPolicyAcceptedAt;
  }
  
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
  
  // STEP 4: Map database response to Person type using shared mapper
  return mapPersonRow(result);
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
  const photoUrl = await uploadPhotoIfLocal(
    updates.photoUrl,
    STORAGE_BUCKETS.PERSON_PHOTOS,
    `profiles/${userId}`,
    'People API'
  ) ?? undefined; // Convert null to undefined for consistency
  
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
  
  // STEP 4: COPPA Compliance - Check age after birth date update
  // If birth date was updated and user is now under 13, immediately delete account
  if (updates.birthDate !== undefined && result.birth_date) {
    const birthDate = result.birth_date;
    const age = calculateAge(birthDate);
    
    if (age !== null && !isAtLeast13(birthDate)) {
      // User is under 13 - COPPA violation - delete account immediately
      console.warn('[People API] COPPA violation detected: User age < 13 after birth date update. Deleting account immediately.');
      
      // Immediately process COPPA deletion (marks as COPPA-blocked to prevent re-registration)
      try {
        await processCOPPADeletion(userId);
      } catch (deletionError: any) {
        console.error('[People API] Error deleting account after COPPA violation:', deletionError);
        // Continue to throw COPPA error even if deletion fails
      }
      
      // Clear COPPA cache to ensure next check sees the block
      clearCOPPACache(userId);
      
      // Throw special error that frontend can catch to sign out user
      throw new COPPAViolationError('Your account has been deleted due to COPPA compliance. You must be at least 13 years old to use this app.');
    }
  }
  
  // STEP 5: Map database response to Person type using shared mapper
  // Preserve existing profile relationships and metadata
  return mapPersonRow(result, undefined, existingProfile);
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
  const photoUrl = await uploadPhotoIfLocal(
    input.photoUrl,
    STORAGE_BUCKETS.PERSON_PHOTOS,
    `relatives/${userId}`,
    'People API'
  ); // Keep as null (not undefined) for createRelative
  
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
  
  // STEP 5: Map database response to Person type using shared mapper
  return mapPersonRow(result);
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
  // IMPORTANT: Filter out people who have requested 'delete_profile' deletion
  // People with 'deactivate_profile' remain visible (their profile stays in tree)
  const [peopleResponse, relationshipsResponse] = await Promise.all([
    supabase
      .from('people')
      .select('*')
      .or('deletion_type.is.null,deletion_type.neq.delete_profile')
      .order('created_at', { ascending: true }),
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
  
  // STEP 4: Map database rows to Person objects with relationships using shared mapper
  const people: Person[] = peopleData
    .filter((row) => row.user_id != null) // Filter out rows without user_id
    .map((row) => {
      const personId = row.user_id!; // We know it's not null from filter above
      
      return mapPersonRow(row, {
        parentIds: parentMap.get(personId) || [],
        spouseIds: spouseMap.get(personId) || [],
        childIds: childMap.get(personId) || [],
        siblingIds: siblingMap.get(personId) || [],
      });
    });
  return people;
}
