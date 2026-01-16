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
 */

import { useMemo } from 'react';
import { usePeopleStore } from '@/stores/people-store';
import { useUpdatesStore } from '@/stores/updates-store';
import { useBlockedUsersStore } from '@/stores/blocked-users-store';
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
  // Subscribe to updates Map directly - Zustand will detect when Map reference changes
  // This includes when updates are added, removed, or modified (like soft-delete)
  const updatesMap = useUpdatesStore((state) => state.updates);
  
  // Subscribe to updates Map size as a fallback trigger
  const updatesMapSize = useUpdatesStore((state) => state.updates.size);
  
  // Subscribe to a serialized version that includes update metadata to detect value changes
  // This ensures we detect soft-deletes (where size doesn't change but values do)
  const updatesHash = useUpdatesStore((state) => {
    const updates = Array.from(state.updates.values());
    // Create a hash that includes update IDs and their deletedAt status
    // This will change when an update is soft-deleted (deletedAt changes)
    return updates.map(u => `${u.id}:${u.deletedAt || 'active'}`).sort().join(',');
  });
  
  // Subscribe to blocked users for reactive filtering
  const blockedUserIds = useBlockedUsersStore((state) => state.blockedUserIds);
  
  // Memoize updates to prevent recalculation on every render
  // updatesMap, updatesMapSize, updatesHash, and blockedUserIds change when updates/blocks change, triggering recalculation
  // Use getState() inside useMemo to ensure we always get the latest store state
  const updates = useMemo(() => {
    if (!personId) {
      return [];
    }
    // Call getUpdatesForPerson directly from store state to ensure we get fresh data
    // Using getState() ensures we always read the latest state, not a stale closure
    // Pass blockedUserIds for instant filtering
    const state = useUpdatesStore.getState();
    return state.getUpdatesForPerson(personId, true, blockedUserIds);
  }, [personId, updatesMap, updatesMapSize, updatesHash, blockedUserIds]); // All trigger when Map/Blocks change

  // Memoize update count
  const updateCount = useMemo(() => {
    if (!personId) {
      return 0;
    }
    const state = useUpdatesStore.getState();
    return state.getUpdateCount(personId);
  }, [personId, updatesMap, updatesMapSize, updatesHash]); // All trigger when Map changes

  // Subscribe to people Map size to detect when people are added/removed
  const peopleMapSize = usePeopleStore((state) => state.people.size);

  // Check if person exists
  const hasPerson = useMemo(() => {
    if (!personId) {
      return false;
    }
    const state = usePeopleStore.getState();
    return !!state.getPerson(personId);
  }, [personId, peopleMapSize]); // Depend on peopleMapSize to detect when people change

  return {
    updates,
    updateCount,
    hasPerson,
  };
}

