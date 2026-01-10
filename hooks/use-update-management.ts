import { useState, useEffect, useRef } from 'react';
import { Alert, Platform } from 'react-native';
import { useFamilyTreeStore } from '@/stores/family-tree-store';
import type { Update } from '@/types/family-tree';

/**
 * Hook for managing update-related state and actions
 * 
 * Provides centralized state management for:
 * - Adding/editing updates
 * - Expanding/collapsing update captions
 * - Menu visibility
 * - Delete confirmation flow
 * 
 * This hook eliminates duplicate state management logic between
 * profile.tsx and family.tsx screens.
 */
export function useUpdateManagement() {
  const [isAddingUpdate, setIsAddingUpdate] = useState(false);
  const [updateToEdit, setUpdateToEdit] = useState<Update | null>(null);
  const [expandedUpdateId, setExpandedUpdateId] = useState<string | null>(null);
  const [menuUpdateId, setMenuUpdateId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  
  const deleteUpdate = useFamilyTreeStore((state) => state.deleteUpdate);
  const deleteUpdateRef = useRef(deleteUpdate);
  
  // Keep ref in sync with store action (handles store updates)
  useEffect(() => {
    deleteUpdateRef.current = deleteUpdate;
  }, [deleteUpdate]);

  // Handle delete confirmation after menu modal closes
  // Uses requestAnimationFrame + setTimeout to avoid timing issues with modal animations
  useEffect(() => {
    if (pendingDeleteId && !menuUpdateId) {
      const updateIdToDelete = pendingDeleteId;
      setPendingDeleteId(null);
      
      // Check Platform availability once, outside of async callbacks - needed for delay calculation
      const platformExists = typeof Platform !== 'undefined';
      const platformOS = platformExists ? Platform.OS : 'unknown';
      
      // Use requestAnimationFrame to ensure modal has fully closed
      requestAnimationFrame(() => {
        // Platform-specific delay for Alert to show smoothly after modal closes
        setTimeout(() => {
          // On web, Alert.alert callbacks may not fire reliably - use window.confirm as fallback
          if (platformExists && platformOS === 'web') {
            const confirmed = (window as any).confirm?.('Are you sure you want to delete this update?');
            if (confirmed) {
              deleteUpdateRef.current(updateIdToDelete);
            }
          } else {
            Alert.alert(
              'Delete Update',
              'Are you sure you want to delete this update?',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: () => {
                    deleteUpdateRef.current(updateIdToDelete);
                  },
                },
              ],
              { cancelable: true }
            );
          }
        }, (platformExists && platformOS === 'ios') ? 300 : 100);
      });
    }
  }, [pendingDeleteId, menuUpdateId]);

  return {
    // State
    isAddingUpdate,
    setIsAddingUpdate,
    updateToEdit,
    setUpdateToEdit,
    expandedUpdateId,
    setExpandedUpdateId,
    menuUpdateId,
    setMenuUpdateId,
    pendingDeleteId,
    setPendingDeleteId,
    
    // Helper functions
    openAddUpdate: () => setIsAddingUpdate(true),
    closeAddUpdate: () => setIsAddingUpdate(false),
    openEditUpdate: (update: Update) => setUpdateToEdit(update),
    closeEditUpdate: () => setUpdateToEdit(null),
    toggleExpandUpdate: (updateId: string) => {
      setExpandedUpdateId((prev) => prev === updateId ? null : updateId);
    },
    openMenu: (updateId: string) => setMenuUpdateId(updateId),
    closeMenu: () => setMenuUpdateId(null),
    requestDelete: (updateId: string) => {
      setPendingDeleteId(updateId);
      setMenuUpdateId(null); // Close menu first, then show delete confirmation
    },
  };
}

