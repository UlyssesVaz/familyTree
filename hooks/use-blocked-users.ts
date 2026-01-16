/**
 * Hook for managing blocked users
 * 
 * Wrapper around BlockedUsersStore for easy consumption in components.
 * Automatically loads blocked users on mount and provides reactive updates.
 */

import { useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useBlockedUsersStore } from '@/stores/blocked-users-store';

/**
 * Hook to get and manage blocked user IDs
 * 
 * Uses Zustand store for optimistic updates and reactive UI.
 * Automatically loads from backend on mount.
 * 
 * @returns Set of blocked auth user IDs (linkedAuthUserId values)
 */
export function useBlockedUsers(): Set<string> {
  const { session } = useAuth();
  const blockedUserIds = useBlockedUsersStore((state) => state.blockedUserIds);
  const loadBlockedUsers = useBlockedUsersStore((state) => state.loadBlockedUsers);
  const isLoading = useBlockedUsersStore((state) => state.isLoading);

  // Load blocked users from backend on mount (only once per session)
  useEffect(() => {
    if (!session?.user?.id || isLoading) {
      return;
    }

    loadBlockedUsers(session.user.id);
  }, [session?.user?.id]); // Only reload if user changes

  return blockedUserIds;
}
