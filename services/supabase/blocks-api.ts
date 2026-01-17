/**
 * Blocks API Service
 * 
 * Handles user blocking functionality for content moderation.
 * Implements bidirectional blocking: when User A blocks User B:
 * - User A cannot see User B's content
 * - User B cannot see User A's content
 * 
 * SECURITY:
 * - Uses RLS policies to enforce blocking
 * - Prevents self-blocking
 * - Validates user IDs before blocking
 */

import { getSupabaseClient } from './supabase-init';
import { handleSupabaseQuery, handleSupabaseMutation } from '@/utils/supabase-error-handler';

export interface BlockRecord {
  id: string;
  blockerId: string; // User who initiated the block (auth.users.id)
  blockedId: string; // User who was blocked (auth.users.id)
  createdAt: string;
}

/**
 * Block a user
 * 
 * Creates a block record in the user_blocks table.
 * After blocking, the blocked user's content will be hidden from the blocker's feed.
 * 
 * @param blockerId - The authenticated user's ID (auth.users.id)
 * @param blockedId - The user ID to block (auth.users.id)
 * @returns The created block record
 * @throws Error if blocking fails or user tries to block themselves
 */
export async function blockUser(
  blockerId: string,
  blockedId: string
): Promise<BlockRecord> {
  const supabase = getSupabaseClient();

  // Prevent self-blocking
  if (blockerId === blockedId) {
    throw new Error('You cannot block yourself');
  }

  // Check if already blocked
  const existingBlock = await getBlock(blockerId, blockedId);
  if (existingBlock) {
    return existingBlock; // Already blocked, return existing record
  }

  // Insert block record
  const { data, error } = await supabase
    .from('user_blocks')
    .insert({
      blocker_id: blockerId,
      blocked_id: blockedId,
    })
    .select()
    .single();

  const result = handleSupabaseMutation(data, error, {
    apiName: 'Blocks API',
    operation: 'block user',
  });

  return {
    id: result.id,
    blockerId: result.blocker_id,
    blockedId: result.blocked_id,
    createdAt: result.created_at,
  };
}

/**
 * Unblock a user
 * 
 * Removes a block record, allowing the previously blocked user's content to be visible again.
 * 
 * @param blockerId - The authenticated user's ID (auth.users.id)
 * @param blockedId - The user ID to unblock (auth.users.id)
 * @throws Error if unblocking fails
 */
export async function unblockUser(
  blockerId: string,
  blockedId: string
): Promise<void> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('user_blocks')
    .delete()
    .eq('blocker_id', blockerId)
    .eq('blocked_id', blockedId)
    .select()
    .single();

  // Handle case where block doesn't exist (idempotent - no error)
  if (error && error.code !== 'PGRST116') {
    handleSupabaseMutation(data, error, {
      apiName: 'Blocks API',
      operation: 'unblock user',
    });
  }
}

/**
 * Check if a user is blocked
 * 
 * @param blockerId - The authenticated user's ID (auth.users.id)
 * @param blockedId - The user ID to check (auth.users.id)
 * @returns Block record if blocked, null otherwise
 */
export async function getBlock(
  blockerId: string,
  blockedId: string
): Promise<BlockRecord | null> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('user_blocks')
    .select('*')
    .eq('blocker_id', blockerId)
    .eq('blocked_id', blockedId)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    console.error('[Blocks API] Error checking block:', error);
    return null;
  }

  if (!data) {
    return null;
  }

  return {
    id: data.id,
    blockerId: data.blocker_id,
    blockedId: data.blocked_id,
    createdAt: data.created_at,
  };
}

/**
 * Get all users blocked by the current user
 * 
 * @param blockerId - The authenticated user's ID (auth.users.id)
 * @returns Array of blocked user IDs
 */
export async function getBlockedUsers(blockerId: string): Promise<string[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('user_blocks')
    .select('blocked_id')
    .eq('blocker_id', blockerId);

  if (error) {
    console.error('[Blocks API] Error fetching blocked users:', error);
    return [];
  }

  return (data || []).map((row) => row.blocked_id);
}

/**
 * Get blocked users with their person profile information
 * 
 * Fetches blocked users directly from the database (not from PeopleStore)
 * because PeopleStore may have placeholder data (empty names) for blocked users.
 * 
 * @param blockerId - The authenticated user's ID (auth.users.id)
 * @returns Array of blocked user info with name and photoUrl
 */
export async function getBlockedUsersWithInfo(blockerId: string): Promise<Array<{
  userId: string; // auth.users.id (linkedAuthUserId)
  personId: string; // people.user_id
  name: string;
  photoUrl?: string;
}>> {
  const supabase = getSupabaseClient();

  // Fetch blocked user IDs
  const { data: blocksData, error: blocksError } = await supabase
    .from('user_blocks')
    .select('blocked_id')
    .eq('blocker_id', blockerId);

  if (blocksError) {
    console.error('[Blocks API] Error fetching blocked users:', blocksError);
    return [];
  }

  if (!blocksData || blocksData.length === 0) {
    return [];
  }

  const blockedUserIds = blocksData.map((row) => row.blocked_id);

  // Fetch person profiles for blocked users directly from database
  // Use linked_auth_user_id to find the person records
  const { data: peopleData, error: peopleError } = await supabase
    .from('people')
    .select('user_id, name, photo_url, linked_auth_user_id')
    .in('linked_auth_user_id', blockedUserIds);

  if (peopleError) {
    console.error('[Blocks API] Error fetching blocked users profiles:', peopleError);
    return [];
  }

  // Map to return format
  return (peopleData || []).map((person) => ({
    userId: person.linked_auth_user_id!,
    personId: person.user_id,
    name: person.name || 'Unknown User',
    photoUrl: person.photo_url || undefined,
  }));
}

/**
 * Check if two users have a blocking relationship (bidirectional)
 * 
 * Returns true if either user has blocked the other.
 * 
 * @param userId1 - First user ID (auth.users.id)
 * @param userId2 - Second user ID (auth.users.id)
 * @returns true if either user has blocked the other
 */
export async function isBlockedRelationship(
  userId1: string,
  userId2: string
): Promise<boolean> {
  const supabase = getSupabaseClient();

  // Check both directions: userId1 blocked userId2 OR userId2 blocked userId1
  const { data, error } = await supabase
    .from('user_blocks')
    .select('id')
    .or(`blocker_id.eq.${userId1},blocked_id.eq.${userId1}`)
    .or(`blocker_id.eq.${userId2},blocked_id.eq.${userId2}`)
    .limit(1);

  if (error) {
    console.error('[Blocks API] Error checking block relationship:', error);
    return false;
  }

  return (data || []).length > 0;
}
