/**
 * Invitations API
 * 
 * Handles invitation link creation and claiming for family tree profiles.
 * Allows curators to invite relatives to claim their "Ancestor Profiles" (shadow profiles).
 * 
 * SECURITY:
 * - Uses atomic RPC calls to prevent race conditions and profile hijacking
 * - Server-side rate limiting (10 invitations per hour per user)
 * - Validates claiming user doesn't already have a profile
 */

import { getSupabaseClient } from './supabase-init';
import * as Crypto from 'expo-crypto';
import { handleSupabaseQuery } from '@/utils/supabase-error-handler';

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

export interface ClaimResult {
  targetPersonId: string;
  personName: string;
}

export interface InvitationDetails {
  targetPersonId: string;
  personName: string;
  expiresAt: string;
}

export interface ValidateInvitationTokenResult {
  isValid: boolean;
  isAlreadyClaimed: boolean;
  invitation?: InvitationDetails;
  errorCode?: 'INVALID_TOKEN' | 'EXPIRED' | 'ALREADY_CLAIMED';
}

/**
 * Custom error class for invitation-related errors.
 * Provides structured error codes and user-friendly messages.
 */
export class InvitationError extends Error {
  constructor(
    public code: string,
    message: string,
    public userMessage: string
  ) {
    super(message);
    this.name = 'InvitationError';
  }
}

/**
 * Parses error messages from the RPC function into structured error codes.
 */
function parseClaimErrorMessage(errorMessage: string): { code: string; userMessage: string } {
  const msg = errorMessage.toLowerCase();
  
  // Already claimed errors
  if (msg.includes('already claimed') || msg.includes('already_claimed')) {
    return {
      code: 'ALREADY_CLAIMED',
      userMessage: 'This profile has already been claimed by another user.',
    };
  }
  
  // User already has a profile
  if (msg.includes('already have a profile')) {
    return {
      code: 'USER_HAS_PROFILE',
      userMessage: 'You already have a profile and cannot claim another one.',
    };
  }
  
  // Profile already has owner (for invitation creation)
  if (msg.includes('already has an owner')) {
    return {
      code: 'ALREADY_CLAIMED',
      userMessage: 'This profile already has an owner and cannot be invited.',
    };
  }
  
  // Expiration errors
  if (msg.includes('expired')) {
    return {
      code: 'EXPIRED',
      userMessage: 'This invitation link has expired. Please request a new one.',
    };
  }
  
  // Invalid/not found errors
  if (msg.includes('invalid') || msg.includes('not found')) {
    return {
      code: 'INVALID_TOKEN',
      userMessage: 'This invitation link is invalid or has been used.',
    };
  }
  
  // Rate limit errors
  if (msg.includes('rate limit') || msg.includes('too many') || msg.includes('please wait')) {
    return {
      code: 'RATE_LIMIT',
      userMessage: 'Too many invitations created. Please wait before creating more.',
    };
  }
  
  // Permission errors
  if (msg.includes('permission') || msg.includes('unauthorized') || msg.includes('mismatch')) {
    return {
      code: 'PERMISSION_DENIED',
      userMessage: 'You do not have permission to perform this action.',
    };
  }
  
  // Default error
  return {
    code: 'UNKNOWN',
    userMessage: 'An error occurred while processing your request. Please try again.',
  };
}

/**
 * Creates an invitation link for a person profile.
 * 
 * Uses server-side rate limiting (10 invitations per hour).
 * Verifies target is a shadow profile (no linked_auth_user_id).
 * 
 * @param input - Target person ID and user ID of curator
 * @returns The invitation link with token
 * @throws InvitationError with specific error codes
 */
export async function createInvitationLink(
  input: CreateInvitationLinkInput
): Promise<InvitationLink> {
  const supabase = getSupabaseClient();

  // Generate a cryptographically secure random token (24 hex characters)
  const randomBytes = await Crypto.getRandomBytesAsync(32);
  const token = Array.from(randomBytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .substring(0, 24);

  // Use rate-limited RPC for secure invitation creation
  const { data, error } = await supabase
    .rpc('create_invitation_with_rate_limit', {
      p_target_person_id: input.targetPersonId,
      p_token: token,
    })
    .single();

  if (error) {
    console.error('[Invitations API] RPC error:', error);
    const { code, userMessage } = parseClaimErrorMessage(error.message);
    throw new InvitationError(code, error.message, userMessage);
  }

  // Handle RPC response
  if (!data || !data.success) {
    const errorMsg = data?.error_message || data?.error_code || 'Unknown error';
    const { code, userMessage } = parseClaimErrorMessage(errorMsg);
    throw new InvitationError(code, errorMsg, userMessage);
  }

  return {
    id: data.invitation_id,
    targetPersonId: input.targetPersonId,
    token: data.token,
    expiresAt: data.expires_at,
    createdAt: new Date().toISOString(),
    createdBy: input.userId,
  };
}

/**
 * Validates an invitation token without claiming it.
 * Used for pre-auth validation in the UI.
 * 
 * @param token - The invitation token
 * @returns Validation result with invitation details if valid
 */
export async function validateInvitationToken(
  token: string
): Promise<ValidateInvitationTokenResult> {
  const supabase = getSupabaseClient();

  try {
    const { data, error } = await supabase
      .rpc('validate_invitation_token', {
        p_token: token,
      })
      .single();

    if (error) {
      console.error('[Invitations API] Error validating token:', error);
      return {
        isValid: false,
        isAlreadyClaimed: false,
        errorCode: 'INVALID_TOKEN',
      };
    }

    if (!data || !data.is_valid) {
      // Token is invalid, expired, or already claimed
      const errorCode = data?.error_code || 'INVALID_TOKEN';
      return {
        isValid: false,
        isAlreadyClaimed: errorCode === 'ALREADY_CLAIMED',
        errorCode: errorCode as 'INVALID_TOKEN' | 'EXPIRED' | 'ALREADY_CLAIMED',
      };
    }

    // Token is valid
    return {
      isValid: true,
      isAlreadyClaimed: false,
      invitation: {
        targetPersonId: data.target_person_id,
        personName: data.person_name || 'this profile',
        expiresAt: data.expires_at,
      },
    };
  } catch (error: any) {
    console.error('[Invitations API] Error validating token:', error);
    return {
      isValid: false,
      isAlreadyClaimed: false,
      errorCode: 'INVALID_TOKEN',
    };
  }
}

/**
 * Claims an invitation link (sets linked_auth_user_id and deletes the link).
 * 
 * SECURITY: Uses atomic RPC call to prevent race conditions and double-claiming.
 * The RPC function:
 * - Verifies claiming user matches auth.uid()
 * - Verifies claiming user doesn't already have a profile
 * - Uses SELECT ... FOR UPDATE to lock the invitation row
 * - Atomically updates profile and deletes invitation
 * 
 * @param input - Token and user ID claiming the profile
 * @returns The claim result with target person ID and name
 * @throws InvitationError with specific error codes
 */
export async function claimInvitationLink(
  input: ClaimInvitationLinkInput
): Promise<ClaimResult> {
  const supabase = getSupabaseClient();

  try {
    // Single atomic operation - no race condition possible
    const { data, error } = await supabase
      .rpc('claim_invitation', {
        p_token: input.token,
        p_claiming_user_id: input.userId,
      })
      .single();

    if (error) {
      console.error('[Invitations API] RPC error:', error);
      const { code, userMessage } = parseClaimErrorMessage(error.message);
      throw new InvitationError(code, error.message, userMessage);
    }

    // Check if claim was successful
    if (!data || !data.success) {
      const errorMsg = data?.error_message || 'Unknown error';
      const { code, userMessage } = parseClaimErrorMessage(errorMsg);
      throw new InvitationError(code, errorMsg, userMessage);
    }

    // Success!
    return {
      targetPersonId: data.target_person_id,
      personName: data.person_name || 'this profile',
    };
  } catch (error: any) {
    // Re-throw InvitationError as-is
    if (error instanceof InvitationError) {
      throw error;
    }
    
    // Wrap other errors
    console.error('[Invitations API] Unexpected error claiming invitation:', error);
    throw new InvitationError(
      'UNKNOWN',
      error.message || 'Unknown error occurred',
      'An unexpected error occurred. Please try again.'
    );
  }
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

  if (error) {
    console.error('[Invitations API] Error fetching invitation links:', error);
    // Don't throw - return empty array for graceful degradation
    return [];
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
