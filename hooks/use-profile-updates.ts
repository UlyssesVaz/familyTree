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
import { useFamilyTreeStore } from '@/stores/family-tree-store';
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
  // Subscribe to updates Map size - this is a primitive that Zustand can reliably detect changes on
  // When updates are added/removed, the size changes, triggering re-renders
  const updatesMapSize = useFamilyTreeStore((state) => state.updates.size);
  
  // Subscribe to a stable serialized version of update IDs
  // Use a selector that returns a primitive string - Zustand will detect string changes
  const updatesKey = useFamilyTreeStore((state) => {
    const keys = Array.from(state.updates.keys()).sort();
    return keys.join(',');
  });
  
  // Memoize updates to prevent recalculation on every render
  // updatesMapSize and updatesKey change when updates are added/removed, triggering recalculation
  // Use getState() inside useMemo to ensure we always get the latest store state
  const updates = useMemo(() => {
    if (!personId) {
      return [];
    }
    // Call getUpdatesForPerson directly from store state to ensure we get fresh data
    // Using getState() ensures we always read the latest state, not a stale closure
    const state = useFamilyTreeStore.getState();
    return state.getUpdatesForPerson(personId);
  }, [personId, updatesMapSize, updatesKey]); // Both trigger when Map changes

  // Memoize update count
  const updateCount = useMemo(() => {
    if (!personId) {
      return 0;
    }
    const state = useFamilyTreeStore.getState();
    return state.getUpdateCount(personId);
  }, [personId, updatesMapSize, updatesKey]); // Both trigger when Map changes

  // Subscribe to people Map size to detect when people are added/removed
  const peopleMapSize = useFamilyTreeStore((state) => state.people.size);

  // Check if person exists
  const hasPerson = useMemo(() => {
    if (!personId) {
      return false;
    }
    const state = useFamilyTreeStore.getState();
    return !!state.getPerson(personId);
  }, [personId, peopleMapSize]); // Depend on peopleMapSize to detect when people change

  return {
    updates,
    updateCount,
    hasPerson,
  };
}

