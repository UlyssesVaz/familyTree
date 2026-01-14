/**
 * Invitations API
 * 
 * Handles invitation link creation and claiming for family tree profiles.
 * Allows curators to invite relatives to claim their "Ancestor Profiles" (shadow profiles).
 * 
 * SECURITY: Uses atomic RPC calls to prevent race conditions and profile hijacking.
 */

import { getSupabaseClient } from './supabase-init';
import * as Crypto from 'expo-crypto';
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
  // Map database error messages to user-friendly messages
  if (errorMessage.includes('already claimed') || errorMessage.includes('already_claimed')) {
    return {
      code: 'ALREADY_CLAIMED',
      userMessage: 'This profile has already been claimed by another user.',
    };
  }
  if (errorMessage.includes('expired') || errorMessage.includes('EXPIRED')) {
    return {
      code: 'EXPIRED',
      userMessage: 'This invitation link has expired. Please request a new one.',
    };
  }
  if (errorMessage.includes('invalid') || errorMessage.includes('not found') || errorMessage.includes('INVALID')) {
    return {
      code: 'INVALID_TOKEN',
      userMessage: 'This invitation link is invalid or has been used.',
    };
  }
  if (errorMessage.includes('rate limit') || errorMessage.includes('too many')) {
    return {
      code: 'RATE_LIMIT',
      userMessage: 'Too many invitations created. Please wait before creating more.',
    };
  }
  if (errorMessage.includes('permission') || errorMessage.includes('unauthorized')) {
    return {
      code: 'PERMISSION_DENIED',
      userMessage: 'You do not have permission to create invitations for this profile.',
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
 * Uses cryptographically secure random token generation.
 * 
 * @param input - Target person ID and user ID of curator
 * @returns The invitation link with token
 */
export async function createInvitationLink(
  input: CreateInvitationLinkInput
): Promise<InvitationLink> {
  const supabase = getSupabaseClient();

  // Generate a cryptographically secure random token (32 bytes = 64 hex chars)
  // We'll use 24 characters for the token (48 hex chars truncated)
  const randomBytes = await Crypto.getRandomBytesAsync(32);
  const token = Array.from(randomBytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .substring(0, 24); // 24-char token

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
      // RPC function not found or other database error
      console.error('[Invitations API] Error validating token:', error);
      return {
        isValid: false,
        isAlreadyClaimed: false,
        errorCode: 'INVALID_TOKEN',
      };
    }

    if (!data.is_valid) {
      // Token is invalid, expired, or already claimed
      return {
        isValid: false,
        isAlreadyClaimed: data.is_already_claimed || false,
        errorCode: data.error_code || 'INVALID_TOKEN',
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
 * Gets an invitation link by token (for validation).
 * 
 * @deprecated Use validateInvitationToken instead for better security
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
 * SECURITY: Uses atomic RPC call to prevent race conditions and double-claiming.
 * The RPC function uses SELECT ... FOR UPDATE to lock the invitation row,
 * preventing concurrent claims.
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
      // Database error (RPC not found, connection error, etc.)
      console.error('[Invitations API] RPC error:', error);
      
      // Try to parse error message if it contains structured error info
      if (error.message) {
        const { code, userMessage } = parseClaimErrorMessage(error.message);
        throw new InvitationError(code, error.message, userMessage);
      }
      
      // Generic error
      throw new InvitationError(
        'NETWORK_ERROR',
        error.message || 'Failed to claim invitation',
        'Network error. Please check your connection and try again.'
      );
    }

    // Check if claim was successful
    if (!data.success) {
      const { code, userMessage } = parseClaimErrorMessage(data.error_message || 'Unknown error');
      throw new InvitationError(code, data.error_message || 'Unknown error', userMessage);
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
