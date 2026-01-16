/**
 * Block Filter Utilities
 * 
 * Utilities for filtering blocked users from displays.
 * Follows separation of concerns - stores handle data, filters handle display logic.
 */

import type { Person, Update } from '@/types/family-tree';

/**
 * Filter out people who are blocked by the current user
 * 
 * @param people - Array of Person objects to filter
 * @param blockedUserIds - Set of blocked auth user IDs (linkedAuthUserId values)
 * @returns Filtered array of Person objects
 */
export function filterBlockedPeople(
  people: Person[],
  blockedUserIds: Set<string>
): Person[] {
  if (blockedUserIds.size === 0) {
    return people;
  }

  return people.filter((person) => {
    // If person has no linked auth user (shadow profile), keep them
    if (!person.linkedAuthUserId) {
      return true;
    }

    // Filter out people whose linkedAuthUserId is in blockedUserIds
    return !blockedUserIds.has(person.linkedAuthUserId);
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
