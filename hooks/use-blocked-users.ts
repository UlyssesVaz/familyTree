/**
 * React Query hooks for managing blocked users
 * 
 * Replaces Zustand store with React Query for automatic:
 * - Optimistic updates
 * - Error rollback
 * - Cache invalidation
 * - Loading states
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/auth-context';
import { getBlockedUsersWithInfo, unblockUser as unblockUserApi } from '@/services/supabase/blocks-api';

/**
 * Query hook - fetches blocked users with profile info
 */
export function useBlockedUsers() {
  const { session } = useAuth();
  const userId = session?.user?.id;

  return useQuery({
    queryKey: ['blockedUsers', userId],
    queryFn: async () => {
      if (!userId) return [];
      return await getBlockedUsersWithInfo(userId);
    },
    enabled: !!userId,
    staleTime: 60000, // 1 minute
  });
}

/**
 * Hook for backward compatibility - returns Set<string> like old hook
 * Used by components that expect Set<string> format
 */
export function useBlockedUserIds(): Set<string> {
  const { session } = useAuth();
  const userId = session?.user?.id;
  
  const { data } = useQuery({
    queryKey: ['blockedUserIds', userId],
    queryFn: async () => {
      if (!userId) return new Set<string>();
      
      const { getBlockedUserIds } = await import('@/services/supabase/blocks-api');
      return await getBlockedUserIds(userId);
    },
    enabled: !!userId,
    staleTime: 60000,
  });
  
  return data ?? new Set<string>();
}

/**
 * Mutation hook - unblocks a user with optimistic updates
 */
export function useUnblockUser() {
  const queryClient = useQueryClient();
  const { session } = useAuth();

  return useMutation({
    mutationFn: async ({ blockedUserId }: { blockedUserId: string }) => {
      const currentUserId = session?.user?.id;
      if (!currentUserId) {
        throw new Error('User must be signed in');
      }
      await unblockUserApi(currentUserId, blockedUserId);
    },
    
    // Optimistic update - happens BEFORE API call
    onMutate: async ({ blockedUserId }) => {
      const currentUserId = session?.user?.id;
      if (!currentUserId) return;

      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: ['blockedUsers', currentUserId] });
      await queryClient.cancelQueries({ queryKey: ['blockedUserIds', currentUserId] });

      // Snapshot previous values for rollback
      const previousBlockedUsers = queryClient.getQueryData(['blockedUsers', currentUserId]);
      const previousBlockedUserIds = queryClient.getQueryData(['blockedUserIds', currentUserId]);

      // Optimistically update blockedUsers list
      queryClient.setQueryData(['blockedUsers', currentUserId], (old: any) => {
        if (!old) return old;
        return old.filter((user: any) => user.userId !== blockedUserId);
      });

      // Optimistically update blockedUserIds Set
      queryClient.setQueryData(['blockedUserIds', currentUserId], (old: Set<string>) => {
        if (!old) return old;
        const newSet = new Set(old);
        newSet.delete(blockedUserId);
        return newSet;
      });

      return { previousBlockedUsers, previousBlockedUserIds };
    },
    
    // Auto-rollback on error
    onError: (error, { blockedUserId }, context) => {
      const currentUserId = session?.user?.id;
      if (!currentUserId || !context) return;

      // Restore previous values
      if (context.previousBlockedUsers) {
        queryClient.setQueryData(['blockedUsers', currentUserId], context.previousBlockedUsers);
      }
      if (context.previousBlockedUserIds) {
        queryClient.setQueryData(['blockedUserIds', currentUserId], context.previousBlockedUserIds);
      }
    },
    
    // Invalidate to refetch fresh data on success
    onSuccess: (data, { blockedUserId }) => {
      const currentUserId = session?.user?.id;
      if (!currentUserId) return;

      // Invalidate related queries to trigger refetch
      queryClient.invalidateQueries({ queryKey: ['blockedUsers', currentUserId] });
      queryClient.invalidateQueries({ queryKey: ['blockedUserIds', currentUserId] });
      // Invalidate family tree to refresh tree view
      queryClient.invalidateQueries({ queryKey: ['familyTree', currentUserId] });
    },
  });
}