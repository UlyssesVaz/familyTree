/**
 * React Query hooks for managing updates/posts
 * 
 * Replaces Zustand store with React Query for automatic:
 * - Optimistic updates
 * - Error rollback
 * - Cache invalidation
 * - Loading states
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/auth-context';
import {
  getAllUpdates,
  createUpdate,
  updateUpdate as updateUpdateApi,
  deleteUpdate as deleteUpdateApi,
  toggleUpdatePrivacy as toggleUpdatePrivacyApi,
  type CreateUpdateInput,
  type UpdateUpdateInput,
} from '@/services/supabase/updates-api';
import type { Update } from '@/types/family-tree';

/**
 * Query hook - fetches all updates for the current user's family tree
 */
export function useUpdates() {
  const { session } = useAuth();
  const userId = session?.user?.id;

  return useQuery({
    queryKey: ['updates', userId],
    queryFn: async () => {
      if (!userId) return [];
      return await getAllUpdates(userId);
    },
    enabled: !!userId,
    staleTime: 60000, // 1 minute
  });
}

/**
 * Mutation hook - creates a new update with optimistic updates
 */
export function useAddUpdate() {
  const queryClient = useQueryClient();
  const { session } = useAuth();

  return useMutation({
    mutationFn: async ({ userId, input }: { userId: string; input: CreateUpdateInput }) => {
      return await createUpdate(userId, input);
    },
    
    // Optimistic update
    onMutate: async ({ userId, input }) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: ['updates', userId] });

      // Snapshot previous value
      const previousUpdates = queryClient.getQueryData<Update[]>(['updates', userId]);

      // Generate temp ID for optimistic update
      const tempId = `temp-${Date.now()}`;
      const optimisticUpdate: Update = {
        id: tempId,
        personId: input.personId,
        title: input.title,
        photoUrl: input.photoUrl,
        caption: input.caption,
        isPublic: input.isPublic ?? true,
        taggedPersonIds: input.taggedPersonIds,
        createdAt: Date.now(),
        createdBy: userId,
      };

      // Optimistically add to cache
      queryClient.setQueryData<Update[]>(['updates', userId], (old = []) => [
        optimisticUpdate,
        ...old,
      ]);

      return { previousUpdates, tempId };
    },
    
    // On success, replace temp update with real one
    onSuccess: (data, { userId }, context) => {
      if (!context) return;
      
      queryClient.setQueryData<Update[]>(['updates', userId], (old = []) => {
        // Remove temp update and add real one
        const filtered = old.filter(u => u.id !== context.tempId);
        return [data, ...filtered];
      });
    },
    
    // Rollback on error
    onError: (error, { userId }, context) => {
      if (!context) return;
      
      // Restore previous value
      if (context.previousUpdates) {
        queryClient.setQueryData(['updates', userId], context.previousUpdates);
      }
    },
  });
}

/**
 * Mutation hook - updates an existing update
 */
export function useUpdateUpdate() {
  const queryClient = useQueryClient();
  const { session } = useAuth();

  return useMutation({
    mutationFn: async ({
      userId,
      updateId,
      input,
    }: {
      userId: string;
      updateId: string;
      input: UpdateUpdateInput;
    }) => {
      return await updateUpdateApi(userId, updateId, input);
    },
    
    // Optimistic update
    onMutate: async ({ userId, updateId, input }) => {
      await queryClient.cancelQueries({ queryKey: ['updates', userId] });

      const previousUpdates = queryClient.getQueryData<Update[]>(['updates', userId]);
      const update = previousUpdates?.find(u => u.id === updateId);

      if (update) {
        const optimisticUpdate: Update = {
          ...update,
          title: input.title,
          photoUrl: input.photoUrl,
          caption: input.caption,
          isPublic: input.isPublic ?? update.isPublic,
          taggedPersonIds: input.taggedPersonIds,
        };

        queryClient.setQueryData<Update[]>(['updates', userId], (old = []) =>
          old.map(u => (u.id === updateId ? optimisticUpdate : u))
        );
      }

      return { previousUpdates };
    },
    
    // On success, replace with real update from server
    onSuccess: (data, { userId, updateId }) => {
      queryClient.setQueryData<Update[]>(['updates', userId], (old = []) =>
        old.map(u => (u.id === updateId ? data : u))
      );
    },
    
    // Rollback on error
    onError: (error, { userId }, context) => {
      if (context?.previousUpdates) {
        queryClient.setQueryData(['updates', userId], context.previousUpdates);
      }
    },
  });
}

/**
 * Mutation hook - deletes an update
 */
export function useDeleteUpdate() {
  const queryClient = useQueryClient();
  const { session } = useAuth();

  return useMutation({
    mutationFn: async ({ updateId }: { updateId: string }) => {
      await deleteUpdateApi(updateId);
    },
    
    // Optimistic update - soft delete immediately
    onMutate: async ({ updateId }) => {
      const userId = session?.user?.id;
      if (!userId) return;

      await queryClient.cancelQueries({ queryKey: ['updates', userId] });

      const previousUpdates = queryClient.getQueryData<Update[]>(['updates', userId]);
      const update = previousUpdates?.find(u => u.id === updateId);

      if (update) {
        // Soft delete - mark as deleted
        const deletedUpdate: Update = {
          ...update,
          deletedAt: Date.now(),
        };

        queryClient.setQueryData<Update[]>(['updates', userId], (old = []) =>
          old.map(u => (u.id === updateId ? deletedUpdate : u))
        );
      }

      return { previousUpdates, update };
    },
    
    // On success, remove from cache completely
    onSuccess: (data, { updateId }) => {
      const userId = session?.user?.id;
      if (!userId) return;

      queryClient.setQueryData<Update[]>(['updates', userId], (old = []) =>
        old.filter(u => u.id !== updateId)
      );
    },
    
    // Rollback on error - restore update
    onError: (error, { updateId }, context) => {
      const userId = session?.user?.id;
      if (!userId || !context) return;

      if (context.previousUpdates) {
        queryClient.setQueryData(['updates', userId], context.previousUpdates);
      }
    },
  });
}

/**
 * Mutation hook - toggles update privacy (public/private)
 */
export function useToggleUpdatePrivacy() {
  const queryClient = useQueryClient();
  const { session } = useAuth();

  return useMutation({
    mutationFn: async ({ userId, updateId }: { userId: string; updateId: string }) => {
      return await toggleUpdatePrivacyApi(userId, updateId);
    },
    
    // Optimistic update
    onMutate: async ({ userId, updateId }) => {
      await queryClient.cancelQueries({ queryKey: ['updates', userId] });

      const previousUpdates = queryClient.getQueryData<Update[]>(['updates', userId]);
      const update = previousUpdates?.find(u => u.id === updateId);

      if (update) {
        const toggledUpdate: Update = {
          ...update,
          isPublic: !update.isPublic,
        };

        queryClient.setQueryData<Update[]>(['updates', userId], (old = []) =>
          old.map(u => (u.id === updateId ? toggledUpdate : u))
        );
      }

      return { previousUpdates };
    },
    
    // On success, replace with real update
    onSuccess: (data, { userId, updateId }) => {
      queryClient.setQueryData<Update[]>(['updates', userId], (old = []) =>
        old.map(u => (u.id === updateId ? data : u))
      );
    },
    
    // Rollback on error
    onError: (error, { userId }, context) => {
      if (context?.previousUpdates) {
        queryClient.setQueryData(['updates', userId], context.previousUpdates);
      }
    },
  });
}