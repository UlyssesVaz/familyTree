/**
 * Utility function to filter updates for a specific person
 * 
 * Ported from updates-store.getUpdatesForPerson for use with React Query.
 * This logic will eventually move here permanently once PeopleStore is migrated too.
 */

import type { Update, Person } from '@/types/family-tree';

/**
 * Get all updates for a specific person
 * 
 * Filters updates to include:
 * - Updates created by this person
 * - Updates where this person is tagged (if includeTagged is true)
 * - Excludes updates from blocked users
 * - Excludes soft-deleted updates
 * - Excludes tagged updates that the person has hidden
 */
export function getUpdatesForPerson(
  allUpdates: Update[],
  personId: string,
  people: Map<string, Person>,
  includeTagged: boolean = true,
  blockedUserIds: Set<string> = new Set()
): Update[] {
  const person = people.get(personId);
  
  // Filter out soft-deleted updates and blocked users
  let filteredUpdates = allUpdates.filter(update => {
    // Exclude soft-deleted
    if (update.deletedAt) {
      return false;
    }
    
    // Exclude updates from blocked users
    if (blockedUserIds.size > 0) {
      // Check if update creator is blocked
      if (update.createdBy && blockedUserIds.has(update.createdBy)) {
        return false;
      }
      
      // Also check by personId -> linkedAuthUserId
      const updatePerson = people.get(update.personId);
      if (updatePerson?.linkedAuthUserId && blockedUserIds.has(updatePerson.linkedAuthUserId)) {
        return false;
      }
    }
    
    return true;
  });
  
  // Get updates created by this person
  const ownUpdates = filteredUpdates.filter(update => {
    if (update.personId !== personId) return false;
    
    // If update has tags, check if person is tagged in their own update
    if (update.taggedPersonIds && update.taggedPersonIds.length > 0) {
      // If person is tagged in their own update, include it
      if (update.taggedPersonIds.includes(personId)) {
        return true;
      }
      // If person created it but only tagged others (not themselves), exclude it
      return false;
    }
    
    // No tags, so it's their own update - include it
    return true;
  });
  
  // Get updates where this person is tagged (if includeTagged is true)
  const hiddenIds = person?.hiddenTaggedUpdateIds || [];
  const taggedUpdates = includeTagged
    ? filteredUpdates.filter(update => 
        update.taggedPersonIds?.includes(personId) &&
        !hiddenIds.includes(update.id)
      )
    : [];
  
  // Combine and sort by date (newest first)
  const combined = [...ownUpdates, ...taggedUpdates];
  // Remove duplicates
  const unique = Array.from(
    new Map(combined.map(update => [update.id, update])).values()
  );
  
  return unique.sort((a, b) => b.createdAt - a.createdAt);
}