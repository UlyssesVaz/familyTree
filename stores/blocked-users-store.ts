/**
 * Blocked Users Store
 * 
 * Manages blocked user IDs with optimistic updates for instant UI feedback.
 * Follows Instagram/Facebook pattern: update local state immediately, sync with backend in background.
 * 
 * Separation of Concerns:
 * - This store handles UI state (which users are blocked)
 * - blocks-api.ts handles backend sync
 * - Components consume this store for instant feedback
 */

import { create } from 'zustand';
import { getBlockedUsers } from '@/services/supabase/blocks-api';

interface BlockedUsersStore {
  /** Set of blocked auth user IDs (linkedAuthUserId values) */
  blockedUserIds: Set<string>;
  
  /** Whether blocked users are currently loading from backend */
  isLoading: boolean;
  
  /** Load blocked users from backend */
  loadBlockedUsers: (userId: string) => Promise<void>;
  
  /** Optimistically add a blocked user (instant UI update) */
  addBlockedUser: (userId: string) => void;
  
  /** Optimistically remove a blocked user (instant UI update) */
  removeBlockedUser: (userId: string) => void;
  
  /** Check if a user is blocked */
  isBlocked: (userId: string) => boolean;
  
  /** Get all blocked user IDs as an array */
  getBlockedUserIds: () => string[];
}

export const useBlockedUsersStore = create<BlockedUsersStore>((set, get) => ({
  blockedUserIds: new Set<string>(),
  isLoading: false,

  loadBlockedUsers: async (userId: string) => {
    set({ isLoading: true });
    try {
      const blockedIds = await getBlockedUsers(userId);
      set({ 
        blockedUserIds: new Set(blockedIds),
        isLoading: false,
      });
    } catch (error) {
      console.error('[BlockedUsersStore] Error loading blocked users:', error);
      set({ isLoading: false });
      // Keep existing blocked users on error (fail gracefully)
    }
  },

  addBlockedUser: (userId: string) => {
    const { blockedUserIds } = get();
    const newBlocked = new Set(blockedUserIds);
    newBlocked.add(userId);
    set({ blockedUserIds: newBlocked });
  },

  removeBlockedUser: (userId: string) => {
    const { blockedUserIds } = get();
    const newBlocked = new Set(blockedUserIds);
    newBlocked.delete(userId);
    set({ blockedUserIds: newBlocked });
  },

  isBlocked: (userId: string) => {
    return get().blockedUserIds.has(userId);
  },

  getBlockedUserIds: () => {
    return Array.from(get().blockedUserIds);
  },
}));
