/**
 * Export API Service
 * 
 * Handles data portability - allows users to export all their data in JSON format.
 * Implements GDPR Article 15 (Right of Access) and Apple App Store recommendation.
 * 
 * Exports:
 * - User profile data
 * - Relationships involving user
 * - Updates created by user
 * - Invitations sent by user
 * - Photo URLs (list only, not actual files)
 */

import { getSupabaseClient } from './supabase-init';
import { getUserProfile } from './people-api';
import { getRelationshipsForPerson } from './relationships-api';
import { getAllUpdates } from './updates-api';
import type { Person, Update } from '@/types/family-tree';

/**
 * Export data structure matching GDPR/Apple requirements
 */
export interface ExportData {
  /** User's profile information */
  profile: Person | null;
  
  /** Relationships involving user's profile */
  relationships: {
    id: string;
    personOneId: string;
    personTwoId: string;
    relationshipType: 'parent' | 'child' | 'spouse' | 'sibling';
    createdAt: string;
  }[];
  
  /** Updates/posts created by user */
  updates: Update[];
  
  /** Invitations created by user */
  invitations: {
    id: string;
    targetPersonId: string;
    token: string;
    expiresAt: string;
    createdAt: string;
    claimedAt: string | null;
  }[];
  
  /** Photo URLs (list only, not actual files) */
  photos: {
    url: string;
    path: string;
    type: 'profile' | 'update';
    createdAt: string;
  }[];
  
  /** Metadata about the export */
  metadata: {
    exportedAt: string; // ISO 8601 timestamp
    exportVersion: string; // For future compatibility
    userId: string; // User ID for verification
  };
}

/**
 * Fetch all user's data for export
 * 
 * @param userId - The authenticated user's ID from auth.users
 * @returns ExportData object containing all user's data
 * @throws Error if data fetch fails
 */
export async function exportUserData(userId: string): Promise<ExportData> {
  const supabase = getSupabaseClient();
  
  try {
    // STEP 1: Fetch user profile
    const profile = await getUserProfile(userId);
    
    if (!profile) {
      // User doesn't have a profile yet - return empty export
      return {
        profile: null,
        relationships: [],
        updates: [],
        invitations: [],
        photos: [],
        metadata: {
          exportedAt: new Date().toISOString(),
          exportVersion: '1.0.0',
          userId,
        },
      };
    }
    
    // STEP 2: Fetch relationships involving user's profile
    const relationshipsData = await getRelationshipsForPerson(profile.id);
    const relationships = relationshipsData.map((rel) => ({
      id: rel.id,
      personOneId: rel.person_one_id,
      personTwoId: rel.person_two_id,
      relationshipType: rel.relationship_type as 'parent' | 'child' | 'spouse' | 'sibling',
      createdAt: rel.created_at,
    }));
    
    // STEP 3: Fetch all updates, then filter to user's updates
    const allUpdates = await getAllUpdates(userId);
    const userUpdates = allUpdates.filter((update) => update.createdBy === userId);
    
    // STEP 4: Fetch invitations created by user
    const { data: invitationsData, error: invitationsError } = await supabase
      .from('invitation_links')
      .select('*')
      .eq('created_by', userId)
      .order('created_at', { ascending: false });
    
    if (invitationsError) {
      console.error('[Export API] Error fetching invitations:', invitationsError);
      // Continue without invitations - don't fail entire export
    }
    
    const invitations = (invitationsData || []).map((inv) => ({
      id: inv.id,
      targetPersonId: inv.target_person_id,
      token: inv.token,
      expiresAt: inv.expires_at,
      createdAt: inv.created_at,
      claimedAt: inv.claimed_at || null,
    }));
    
    // STEP 5: Collect photo URLs (list only, not download)
    const photos: ExportData['photos'] = [];
    
    // Add profile photo if exists
    if (profile.photoUrl) {
      photos.push({
        url: profile.photoUrl,
        path: `profiles/${userId}/${profile.id}`,
        type: 'profile',
        createdAt: profile.createdAt.toString(),
      });
    }
    
    // Add update photos
    for (const update of userUpdates) {
      if (update.photoUrl) {
        photos.push({
          url: update.photoUrl,
          path: `update-photos/${userId}/${update.id}`,
          type: 'update',
          createdAt: update.createdAt.toString(),
        });
      }
    }
    
    // STEP 6: Build export data object
    const exportData: ExportData = {
      profile,
      relationships,
      updates: userUpdates,
      invitations,
      photos,
      metadata: {
        exportedAt: new Date().toISOString(),
        exportVersion: '1.0.0',
        userId,
      },
    };
    
    return exportData;
  } catch (error: any) {
    console.error('[Export API] Error exporting user data:', error);
    throw new Error(`Failed to export user data: ${error?.message || 'Unknown error'}`);
  }
}
