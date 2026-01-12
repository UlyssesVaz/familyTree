/**
 * useFamilyFeed Hook
 * 
 * Extracts family feed filtering and sorting logic from the FamilyScreen component.
 * 
 * **What are Hooks?**
 * Hooks encapsulate reusable logic. This hook handles:
 * - Fetching all updates from all family members
 * - Sorting updates by date (newest first)
 * - Filtering updates (e.g., "group" filter for 4+ tagged people)
 * - Enriching updates with person and tagged people data
 * 
 * **Before:** Feed logic was mixed into FamilyScreen component (550+ lines)
 * **After:** Logic is extracted here, FamilyScreen just calls the hook and renders UI
 */

import { useMemo } from 'react';
import { useFamilyTreeStore } from '@/stores/family-tree-store';
import type { Update, Person } from '@/types/family-tree';

export type FeedFilter = 'all' | 'group';

export interface FeedUpdate {
  /** The update object */
  update: Update;
  /** The person who created the update */
  person: Person | undefined;
  /** People tagged in the update */
  taggedPeople: Person[];
}

export interface UseFamilyFeedResult {
  /** All family updates, sorted and filtered */
  updates: FeedUpdate[];
  /** Total count of updates (before filtering) */
  totalCount: number;
}

/**
 * Custom hook that fetches and filters all family updates for the feed.
 * 
 * This hook:
 * - Gets all updates from the store
 * - Enriches them with person and tagged people data
 * - Sorts by creation date (newest first)
 * - Applies filters (e.g., "group" for 4+ tagged people)
 * - Memoizes results to prevent unnecessary recalculations
 * 
 * @param filter - Filter type: 'all' (all updates) or 'group' (4+ tagged people)
 * @returns Object containing filtered updates array and total count
 */
export function useFamilyFeed(filter: FeedFilter = 'all'): UseFamilyFeedResult {
  const updatesMap = useFamilyTreeStore((state) => state.updates);
  const updatesMapSize = useFamilyTreeStore((state) => state.updates.size);
  const getPerson = useFamilyTreeStore((state) => state.getPerson);

  // Memoize all family updates with enrichment
  const allUpdates = useMemo(() => {
    return Array.from(updatesMap.values())
      .filter(update => !update.deletedAt) // Exclude soft-deleted updates
      .map(update => ({
        update,
        person: getPerson(update.personId),
        taggedPeople: (update.taggedPersonIds || [])
          .map(id => getPerson(id))
          .filter(Boolean) as Person[],
      }))
      .filter(({ person }) => person !== undefined)
      .sort((a, b) => b.update.createdAt - a.update.createdAt);
  }, [updatesMap, updatesMapSize, getPerson]);

  // Memoize filtered updates
  const filteredUpdates = useMemo(() => {
    if (filter === 'group') {
      // Filter: only show updates with 4+ tagged people
      return allUpdates.filter(
        ({ taggedPeople }) => taggedPeople.length >= 4
      );
    }
    // 'all' filter: return all updates
    return allUpdates;
  }, [allUpdates, filter]);

  return {
    updates: filteredUpdates,
    totalCount: allUpdates.length,
  };
}

