/**
 * Update Menu Permissions Utility
 * 
 * Determines what menu options should be available for an update based on:
 * - Whether the current user owns the update (created it)
 * - Whether the current user is tagged in the update
 * - The context (own profile vs other's profile)
 * 
 * This centralizes the logic for update menu permissions across all screens.
 */

import type { Update, Person } from '@/types/family-tree';

export interface UpdateMenuPermissions {
  /** Whether to show the menu button at all */
  showMenuButton: boolean;
  
  /** Whether user can edit this update */
  canEdit: boolean;
  
  /** Whether user can change visibility (public/private) */
  canChangeVisibility: boolean;
  
  /** Whether user can delete this update */
  canDelete: boolean;
  
  /** Whether user can reject this update (for consensus-based moderation) */
  canReject: boolean;
  
  /** Whether user can report this update */
  canReport: boolean;
  
  /** Whether user can hide/show tagged update on their profile */
  canToggleTaggedVisibility: boolean;
}

/**
 * Determine menu permissions for an update
 * 
 * @param update - The update to check permissions for
 * @param currentUserId - The current authenticated user's ID (from session)
 * @param viewingPersonId - The person whose profile is being viewed (could be ego or someone else)
 * @param egoId - The ego's person ID (the current user's profile ID)
 * @param viewingPerson - Optional: The person object being viewed (for tagged visibility check)
 * @returns UpdateMenuPermissions object with all permission flags
 */
export function getUpdateMenuPermissions(
  update: Update,
  currentUserId: string | null | undefined,
  viewingPersonId: string | null | undefined,
  egoId: string | null | undefined,
  viewingPerson?: Person | null
): UpdateMenuPermissions {
  // If no current user, can only report (but menu button should still show)
  if (!currentUserId) {
    return {
      showMenuButton: true,
      canEdit: false,
      canChangeVisibility: false,
      canDelete: false,
      canReject: false,
      canReport: true,
      canToggleTaggedVisibility: false,
    };
  }

  // Check if current user owns this update (created it)
  // IMPORTANT: Check createdBy, not personId (personId is whose wall it's on)
  const isOwnUpdate = update.createdBy === currentUserId;
  
  // Check if current user is tagged in this update
  const isTaggedUpdate = update.taggedPersonIds?.includes(egoId || '') && update.personId !== egoId;
  
  // Check if viewing own profile
  const isViewingOwnProfile = viewingPersonId === egoId;

  // Permissions for own updates (user created it)
  if (isOwnUpdate) {
    return {
      showMenuButton: true,
      canEdit: true,
      canChangeVisibility: true,
      canDelete: true,
      canReject: false, // Can't reject your own update
      canReport: true, // Can still report (for abuse, etc.)
      canToggleTaggedVisibility: false, // Not applicable for own updates
    };
  }

  // Permissions for tagged updates (user is tagged but didn't create)
  // Only show hide/show option when viewing own profile
  if (isTaggedUpdate && isViewingOwnProfile) {
    return {
      showMenuButton: true,
      canEdit: false,
      canChangeVisibility: false,
      canDelete: false,
      canReject: false, // Tagged updates use hide/show instead
      canReport: true,
      canToggleTaggedVisibility: true, // Can hide/show on own profile
    };
  }

  // Permissions for other people's updates (not owned, not tagged)
  // On any profile (own or other's), can only report
  return {
    showMenuButton: true,
    canEdit: false,
    canChangeVisibility: false,
    canDelete: false,
    canReject: false, // Reject will be handled separately via consensus system
    canReport: true, // Always can report
    canToggleTaggedVisibility: false,
  };
}

/**
 * Check if an update is owned by the current user
 * 
 * @param update - The update to check
 * @param currentUserId - The current authenticated user's ID
 * @returns true if the user created this update
 */
export function isUpdateOwnedByUser(
  update: Update,
  currentUserId: string | null | undefined
): boolean {
  if (!currentUserId || !update.createdBy) {
    return false;
  }
  return update.createdBy === currentUserId;
}

/**
 * Check if the current user is tagged in an update
 * 
 * @param update - The update to check
 * @param egoId - The ego's person ID
 * @returns true if the user is tagged in this update
 */
export function isUserTaggedInUpdate(
  update: Update,
  egoId: string | null | undefined
): boolean {
  if (!egoId || !update.taggedPersonIds) {
    return false;
  }
  return update.taggedPersonIds.includes(egoId) && update.personId !== egoId;
}
