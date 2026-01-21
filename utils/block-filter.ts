/**
 * Block Filter Utilities
 * 
 * Utilities for filtering blocked users from displays.
 * Follows separation of concerns - stores handle data, filters handle display logic.
 */

import type { Person, Update } from '@/types/family-tree';

/**
 * Mark blocked people as placeholders instead of removing them
 * 
 * This preserves relationships in the family tree structure.
 * Blocked users are converted to placeholders with minimal data
 * (name and relationships kept, photo/bio cleared).
 * 
 * @param people - Array of Person objects to process
 * @param blockedUserIds - Set of blocked auth user IDs (linkedAuthUserId values)
 * @returns Array of Person objects with blocked users marked as placeholders
 */
export function filterBlockedPeople(
  people: Person[],
  blockedUserIds: Set<string>
): Person[] {
  if (blockedUserIds.size === 0) {
    return people;
  }

  // Use .map() instead of .filter() to preserve relationships
  // Mark blocked users as placeholders instead of removing them
  return people.map((person) => {
    // If person has no linked auth user (shadow profile), keep as-is
    if (!person.linkedAuthUserId) {
      return person;
    }

    // If person is blocked, convert to placeholder
    if (blockedUserIds.has(person.linkedAuthUserId)) {
      return {
        ...person,
        // Mark as placeholder so UI can show minimal info
        isPlaceholder: true,
        placeholderReason: 'blocked' as const,
        // Clear sensitive data
        photoUrl: undefined,
        bio: undefined,
        phoneNumber: undefined,
        // Keep name and relationships for tree structure
      };
    }

    // Person is not blocked, return as-is
    return person;
  });
}

/**
 * Filter out updates from blocked users
 * 
 * @param updates - Array of Update objects to filter
 * @param blockedUserIds - Set of blocked auth user IDs (createdBy values)
 * @param people - Map of people (to look up personId -> linkedAuthUserId)
 * @returns Filtered array of Update objects
 */
export function filterBlockedUpdates(
  updates: Update[],
  blockedUserIds: Set<string>,
  people: Map<string, Person>
): Update[] {
  if (blockedUserIds.size === 0) {
    return updates;
  }

  return updates.filter((update) => {
    // Direct check: if update.createdBy is in blockedUserIds, filter it
    if (update.createdBy && blockedUserIds.has(update.createdBy)) {
      return false;
    }

    // Also check by personId -> linkedAuthUserId
    const person = people.get(update.personId);
    if (person?.linkedAuthUserId && blockedUserIds.has(person.linkedAuthUserId)) {
      return false;
    }

    return true;
  });
}
