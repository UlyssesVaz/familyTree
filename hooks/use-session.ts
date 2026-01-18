/**
 * React Query hooks for managing session and ego
 * 
 * Session Store manages:
 * - Ego (current user's profile)
 * - Family tree sync
 * - Account deletion status
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { usePeople } from './use-people';
import { getAllPeople } from '@/services/supabase/people-api';
import { getAllUpdates } from '@/services/supabase/updates-api';
import type { Person } from '@/types/family-tree';
import type { AccountDeletionStatus } from '@/services/supabase/account-api';

/**
 * Get the ego (current user's profile) from people data
 * 
 * Ego is the person whose linkedAuthUserId matches the current user's ID
 */
export function useEgo(): Person | null {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const { data: people = [] } = usePeople();

  return useMemo(() => {
    if (!userId) return null;
    return people.find(p => p.linkedAuthUserId === userId) || null;
  }, [userId, people]);
}

/**
 * Get ego ID (for backward compatibility during migration)
 */
export function useEgoId(): string | null {
  const ego = useEgo();
  return ego?.id || null;
}

/**
 * Mutation hook - syncs the entire family tree
 * 
 * Loads all people and updates from the backend and updates React Query cache.
 * This replaces the Zustand syncFamilyTree function.
 */
export function useSyncFamilyTree() {
  const queryClient = useQueryClient();
  const { session } = useAuth();

  return useMutation({
    mutationFn: async (userId: string) => {
      // Load all data in parallel
      const [people, updates] = await Promise.all([
        getAllPeople(userId),
        getAllUpdates(userId),
      ]);

      return { people, updates };
    },

    onSuccess: (data, userId) => {
      // Update React Query cache
      queryClient.setQueryData(['people', userId], data.people);
      queryClient.setQueryData(['updates', userId], data.updates);

      // Invalidate to ensure fresh data
      queryClient.invalidateQueries({ queryKey: ['people', userId] });
      queryClient.invalidateQueries({ queryKey: ['updates', userId] });
      queryClient.invalidateQueries({ queryKey: ['blockedUsers', userId] });
      queryClient.invalidateQueries({ queryKey: ['blockedUserIds', userId] });
    },
  });
}

/**
 * Simple query/mutation wrapper for account deletion status
 * 
 * This is lightweight UI state - could stay in Zustand or be moved to React Query
 * For now, we'll create a simple hook that can be expanded later
 */
export function useDeletionStatus() {
  // During migration, this can still use Zustand or be stored in React Query cache
  // For simplicity, we can use a simple useState or Zustand for now
  // This is less critical than the data stores
  
  // Placeholder - actual implementation would depend on where deletion status is stored
  return {
    deletionStatus: null as AccountDeletionStatus | null,
    setDeletionStatus: (status: AccountDeletionStatus | null) => {
      // TODO: Implement when migrating deletion status management
    },
  };
}