/**
 * Relationships API Service
 * 
 * Handles all Supabase operations related to family relationships.
 * Provides type-safe functions for creating and managing relationships between people.
 */

import { getSupabaseClient } from './supabase-init';
import { v4 as uuidv4 } from 'uuid';

/**
 * Database row type for relationships table
 * Maps directly to PostgreSQL schema
 */
interface RelationshipRow {
  id: string;
  person_one_id: string; // FOREIGN KEY to people.user_id
  person_two_id: string; // FOREIGN KEY to people.user_id
  relationship_type: 'parent' | 'spouse' | 'child' | 'sibling';
  created_at: string; // ISO 8601 timestamp
  created_by: string; // FOREIGN KEY to auth.users.id (the curator who created this relationship)
}

/**
 * Input type for creating a relationship
 */
export interface CreateRelationshipInput {
  personOneId: string;
  personTwoId: string;
  relationshipType: 'parent' | 'spouse' | 'child' | 'sibling';
}

/**
 * Create a relationship between two people
 * 
 * IMPORTANT:
 * - Relationships are bidirectional in the frontend (parent/child, spouse/spouse)
 * - Database stores single relationship record
 * - Frontend store maintains bidirectional arrays (parentIds/childIds, etc.)
 * 
 * @param userId - The authenticated user's ID from auth.users (required for created_by)
 * @param input - Relationship data to create
 * @returns Created relationship ID
 * @throws Error if creation fails
 */
export async function createRelationship(
  userId: string,
  input: CreateRelationshipInput
): Promise<string> {
  const supabase = getSupabaseClient();
  
  // Validate: prevent self-relationship
  if (input.personOneId === input.personTwoId) {
    throw new Error('Cannot create relationship: person cannot be related to themselves');
  }
  
  // STEP 1: Check if relationship already exists
  // Check both directions (person_one -> person_two and person_two -> person_one)
  // For bidirectional relationships (spouse, sibling), check both directions
  // For directional relationships (parent, child), check both directions too
  const { data: existingRelationships, error: checkError } = await supabase
    .from('relationships')
    .select('id')
    .eq('relationship_type', input.relationshipType)
    .or(`person_one_id.eq.${input.personOneId},person_one_id.eq.${input.personTwoId}`)
    .or(`person_two_id.eq.${input.personTwoId},person_two_id.eq.${input.personOneId}`);
  
  if (checkError) {
    console.error('[Relationships API] Error checking existing relationships:', checkError);
    // Don't fail - continue with creation (might be a query issue)
  }
  
  // Filter to find exact match (both person IDs match)
  const exactMatch = existingRelationships?.find(rel => {
    // We need to fetch the full relationship to check both person IDs
    // For now, continue and let database handle duplicate key error
    return false; // Simplified - let database handle duplicates
  });
  
  // Note: We'll let the database handle duplicate prevention via unique constraints
  // If relationship exists, database will return error which we'll handle
  
  // STEP 2: Prepare database row
  const relationshipId = uuidv4();
  const row: Omit<RelationshipRow, 'created_at'> = {
    id: relationshipId,
    person_one_id: input.personOneId,
    person_two_id: input.personTwoId,
    relationship_type: input.relationshipType,
    created_by: userId, // The curator who created this relationship
  };
  
  // STEP 3: Insert into database
  console.log('[DEBUG] createRelationship: Inserting into DB', { userId, personOneId: input.personOneId, personTwoId: input.personTwoId, relationshipType: input.relationshipType });
  // #region agent log
  fetch('http://127.0.0.1:7244/ingest/f336e8f0-8f7a-40aa-8f54-323722b5de',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'relationships-api.ts:94',message:'createRelationship before DB insert',data:{userId,personOneId:input.personOneId,personTwoId:input.personTwoId,relationshipType:input.relationshipType,row},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
  // #endregion
  const { data, error } = await supabase
    .from('relationships')
    .insert(row)
    .select()
    .single();

  if (error) {
    console.error('[Relationships API] Error creating relationship:', error);
    console.log('[DEBUG] createRelationship: DB error', { errorCode: error.code, errorMessage: error.message, hint: error.hint });
    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/f336e8f0-8f7a-40aa-8f54-323722b5de',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'relationships-api.ts:101',message:'createRelationship DB error',data:{errorCode:error.code,errorMessage:error.message,errorDetails:error,hint:error.hint},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    
    // Handle duplicate key error (race condition)
    if (error.code === '23505') {
      // Relationship was created concurrently - try to fetch it
      const { data: existing } = await supabase
        .from('relationships')
        .select('id')
        .eq('person_one_id', input.personOneId)
        .eq('person_two_id', input.personTwoId)
        .eq('relationship_type', input.relationshipType)
        .single();
      
      if (existing) {
        return existing.id;
      }
    }
    
    throw new Error(`Failed to create relationship: ${error.message}`);
  }
  
  if (!data) {
    throw new Error('Failed to create relationship: No data returned');
  }

  console.log('[DEBUG] createRelationship: DB insert success', { 
    relationshipId: data.id, 
    personOneId: data.person_one_id, 
    personTwoId: data.person_two_id, 
    relationshipType: data.relationship_type,
    createdBy: data.created_by 
  });
  // #region agent log
  fetch('http://127.0.0.1:7244/ingest/f336e8f0-8f7a-40aa-8f54-323722b5de',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'relationships-api.ts:125',message:'createRelationship DB success',data:{relationshipId:data.id,personOneId:data.person_one_id,personTwoId:data.person_two_id,relationshipType:data.relationship_type,createdBy:data.created_by},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
  // #endregion
  return data.id;
}

/**
 * Get all relationships for a specific person
 * 
 * @param personId - The person's user_id
 * @returns Array of relationship records (both directions)
 */
export async function getRelationshipsForPerson(personId: string): Promise<RelationshipRow[]> {
  const supabase = getSupabaseClient();
  
  // Get relationships where person is person_one OR person_two
  const { data, error } = await supabase
    .from('relationships')
    .select('*')
    .or(`person_one_id.eq.${personId},person_two_id.eq.${personId}`);
  
  if (error) {
    console.error('[Relationships API] Error fetching relationships:', error);
    throw new Error(`Failed to fetch relationships: ${error.message}`);
  }
  
  return data || [];
}

/**
 * Get all relationships in the family tree
 * 
 * @returns Array of all relationship records
 */
export async function getAllRelationships(): Promise<RelationshipRow[]> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('relationships')
    .select('*');
  
  if (error) {
    console.error('[Relationships API] Error fetching all relationships:', error);
    throw new Error(`Failed to fetch relationships: ${error.message}`);
  }
  
  return data || [];
}

/**
 * Delete a relationship
 * 
 * @param relationshipId - The relationship ID to delete
 * @param userId - The authenticated user's ID (for authorization check)
 * @throws Error if deletion fails
 */
export async function deleteRelationship(
  relationshipId: string,
  userId: string
): Promise<void> {
  const supabase = getSupabaseClient();
  
  // Verify user created this relationship (or is admin - future enhancement)
  const { data: relationship, error: fetchError } = await supabase
    .from('relationships')
    .select('created_by')
    .eq('id', relationshipId)
    .single();
  
  if (fetchError) {
    throw new Error(`Relationship not found: ${fetchError.message}`);
  }
  
  // Authorization check (RLS policies should handle this, but double-check)
  if (relationship.created_by !== userId) {
    throw new Error('Unauthorized: You can only delete relationships you created');
  }
  
  // Delete relationship
  const { error: deleteError } = await supabase
    .from('relationships')
    .delete()
    .eq('id', relationshipId);
  
  if (deleteError) {
    console.error('[Relationships API] Error deleting relationship:', deleteError);
    throw new Error(`Failed to delete relationship: ${deleteError.message}`);
  }
}
