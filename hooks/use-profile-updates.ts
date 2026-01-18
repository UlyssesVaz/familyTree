/**
 * useProfileUpdates Hook
 * 
 * Extracts update fetching and management logic from profile components.
 * 
 * **What are Hooks?**
 * Hooks encapsulate stateful logic that can be reused across components.
 * This hook handles:
 * - Fetching updates for a specific person
 * - Calculating update counts
 * - Subscribing to store changes for reactivity
 * 
 * **Before:** Update logic was scattered in profile.tsx and person/[personId].tsx
 * **After:** Both components use this hook, reducing duplication and making updates easier
 * 
 * **Migration:** Now uses React Query instead of Zustand for server data
 */

import { useMemo } from 'react';
import { usePeopleMap } from './use-people';
import { useUpdates } from './use-updates';
import { useBlockedUserIds } from './use-blocked-users';
import { getUpdatesForPerson } from '@/utils/get-updates-for-person';
import type { Update } from '@/types/family-tree';

export interface UseProfileUpdatesResult {
  /** All updates for the person (sorted, newest first) */
  updates: Update[];
  /** Total count of updates */
  updateCount: number;
  /** Whether the person exists */
  hasPerson: boolean;
}

/**
 * Custom hook that fetches and manages updates for a specific person's profile.
 * 
 * This hook:
 * - Subscribes to the updates Map for reactivity
 * - Filters updates using the store's getUpdatesForPerson logic
 * - Calculates the update count
 * - Memoizes results to prevent unnecessary recalculations
 * 
 * @param personId - The ID of the person whose updates to fetch
 * @returns Object containing updates array, count, and person existence flag
 */
export function useProfileUpdates(personId: string | null | undefined): UseProfileUpdatesResult {
  // Use React Query to get all updates (automatically cached and refetched)
  const { data: allUpdates = [] } = useUpdates();
  
  // Subscribe to blocked users for reactive filtering
  const blockedUserIds = useBlockedUserIds();
  
  // Use React Query for people data
  const people = usePeopleMap();
  
  // Memoize updates to prevent recalculation on every render
  // Updates change when React Query cache updates (via mutations)
  const updates = useMemo(() => {
    if (!personId) {
      return [];
    }
    return getUpdatesForPerson(allUpdates, personId, people, true, blockedUserIds);
  }, [personId, allUpdates, people, blockedUserIds]);

  // Memoize update count
  const updateCount = useMemo(() => {
    return updates.length;
  }, [updates]);

  // Check if person exists
  const hasPerson = useMemo(() => {
    if (!personId) {
      return false;
    }
    return !!people.get(personId);
  }, [personId, people]);

  return {
    updates,
    updateCount,
    hasPerson,
  };
}

