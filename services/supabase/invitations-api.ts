/**
 * Invitations API
 * 
 * Handles invitation link creation and claiming for family tree profiles.
 * Allows curators to invite relatives to claim their "Ancestor Profiles" (shadow profiles).
 */

import { getSupabaseClient } from './supabase-init';
import { v4 as uuidv4 } from 'uuid';
import { handleSupabaseQuery, handleSupabaseMutation } from '@/utils/supabase-error-handler';

export interface InvitationLink {
  id: string;
  targetPersonId: string;
  token: string;
  expiresAt: string;
  createdAt: string;
  createdBy: string;
}

export interface CreateInvitationLinkInput {
  targetPersonId: string;
  userId: string; // The curator creating the invitation
}

export interface ClaimInvitationLinkInput {
  token: string;
  userId: string; // The user claiming the profile
}

/**
 * Creates an invitation link for a person profile.
 * 
 * @param input - Target person ID and user ID of curator
 * @returns The invitation link with token
 */
export async function createInvitationLink(
  input: CreateInvitationLinkInput
): Promise<InvitationLink> {
  const supabase = getSupabaseClient();

  // Generate a unique token (using UUID for simplicity, can switch to nanoid later)
  const token = uuidv4().replace(/-/g, '').substring(0, 24); // 24-char token

  // Set expiration to 7 days from now
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  const { data, error } = await supabase
    .from('invitation_links')
    .insert({
      target_person_id: input.targetPersonId,
      token: token,
      expires_at: expiresAt.toISOString(),
      created_by: input.userId,
    })
    .select()
    .single();

  const result = handleSupabaseMutation(data, error, {
    apiName: 'Invitations API',
    operation: 'create invitation link',
  });

  return {
    id: result.id,
    targetPersonId: result.target_person_id,
    token: result.token,
    expiresAt: result.expires_at,
    createdAt: result.created_at,
    createdBy: result.created_by,
  };
}

/**
 * Gets an invitation link by token (for validation).
 * 
 * @param token - The invitation token
 * @returns The invitation link if valid and not expired
 */
export async function getInvitationLink(token: string): Promise<InvitationLink | null> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('invitation_links')
    .select('*')
    .eq('token', token)
    .single();

  // Handle error - allow null for "not found" (PGRST116)
  const result = handleSupabaseQuery(data, error, {
    apiName: 'Invitations API',
    operation: 'get invitation link',
  });
  
  if (!result) {
    return null;
  }

  // Check if expired
  const expiresAt = new Date(result.expires_at);
  if (expiresAt < new Date()) {
    return null; // Expired
  }

  return {
    id: result.id,
    targetPersonId: result.target_person_id,
    token: result.token,
    expiresAt: result.expires_at,
    createdAt: result.created_at,
    createdBy: result.created_by,
  };
}

/**
 * Claims an invitation link (sets linked_auth_user_id and deletes the link).
 * 
 * This must be a transaction to prevent double-claiming:
 * 1. Update people.linked_auth_user_id
 * 2. Delete invitation_links row
 * 
 * @param input - Token and user ID claiming the profile
 * @returns The target person ID that was claimed
 */
export async function claimInvitationLink(
  input: ClaimInvitationLinkInput
): Promise<string> {
  const supabase = getSupabaseClient();

  // First, get the invitation link to validate it exists and get target_person_id
  const invitation = await getInvitationLink(input.token);
  if (!invitation) {
    throw new Error('Invalid or expired invitation link');
  }

  // Use a transaction-like approach: Update person first, then delete link
  // If update fails, link remains (can retry)
  // If update succeeds but delete fails, we'll handle it gracefully

  // Step 1: Update the person's linked_auth_user_id
  const { error: updateError } = await supabase
    .from('people')
    .update({ linked_auth_user_id: input.userId })
    .eq('user_id', invitation.targetPersonId);

  if (updateError) {
    handleSupabaseMutation(null, updateError, {
      apiName: 'Invitations API',
      operation: 'claim invitation (update linked_auth_user_id)',
    });
  }

  // Step 2: Delete the invitation link (prevent double-claiming)
  const { error: deleteError } = await supabase
    .from('invitation_links')
    .delete()
    .eq('token', input.token);

  if (deleteError) {
    // Log error but don't fail - the profile is already claimed
    console.error('[Invitations API] Error deleting invitation link:', deleteError);
    // Profile is claimed, so we can continue
  }

  return invitation.targetPersonId;
}

/**
 * Gets all active invitation links for a person (created by current user).
 * 
 * @param targetPersonId - The person ID
 * @param userId - The user who created the invitations
 * @returns Array of active invitation links
 */
export async function getInvitationLinksForPerson(
  targetPersonId: string,
  userId: string
): Promise<InvitationLink[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('invitation_links')
    .select('*')
    .eq('target_person_id', targetPersonId)
    .eq('created_by', userId)
    .gt('expires_at', new Date().toISOString()) // Only non-expired
    .order('created_at', { ascending: false });

  // Handle error - allow empty array for "not found" or errors
  if (error) {
    handleSupabaseMutation(data, error, {
      apiName: 'Invitations API',
      operation: 'get invitation links',
    });
  }

  return (data || []).map((row) => ({
    id: row.id,
    targetPersonId: row.target_person_id,
    token: row.token,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    createdBy: row.created_by,
  }));
}
