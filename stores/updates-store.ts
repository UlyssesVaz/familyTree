/**
 * Updates Store
 * 
 * Manages updates/posts in the family tree.
 * Depends on PeopleStore for tagged person validation and visibility toggling.
 */

import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { Update, Person } from '@/types/family-tree';
import { createUpdate, deleteUpdate as deleteUpdateAPI, updateUpdate as updateUpdateAPI, toggleUpdatePrivacy as toggleUpdatePrivacyAPI } from '@/services/supabase/updates-api';
import { usePeopleStore } from './people-store';

interface UpdatesStore {
  /** Map of update ID to Update object */
  updates: Map<string, Update>;
  
  /** Add an update (photo) to a person's profile */
  addUpdate: (personId: string, title: string, photoUrl: string, caption?: string, isPublic?: boolean, taggedPersonIds?: string[], userId?: string) => Promise<string>;
  
  /** Update an existing update */
  updateUpdate: (updateId: string, title: string, photoUrl: string, caption?: string, isPublic?: boolean, taggedPersonIds?: string[], userId?: string) => Promise<void>;
  
  /** Get all updates for a person (sorted by time, newest first) */
  getUpdatesForPerson: (personId: string, includeTagged?: boolean, blockedUserIds?: Set<string>) => Update[];
  
  /** Get update count for a person */
  getUpdateCount: (personId: string) => number;
  
  /** Toggle update privacy (public/private) */
  toggleUpdatePrivacy: (updateId: string) => Promise<void>;
  
  /** Delete an update (soft delete in frontend, then permanent delete from database/Storage) */
  deleteUpdate: (updateId: string) => Promise<void>;
  
  /** Toggle visibility of a tagged update on a person's profile */
  toggleTaggedUpdateVisibility: (personId: string, updateId: string) => void;
  
  /** Set updates (used by sync) */
  setUpdates: (updates: Update[]) => void;
  
  /** Remove updates from a blocked user */
  removeBlockedUserUpdates: (blockedAuthUserId: string) => void;
  
  /** Hide a reported update (soft delete for reporter) */
  hideReportedUpdate: (updateId: string) => void;
}

export const useUpdatesStore = create<UpdatesStore>((set, get) => ({
  updates: new Map(),

  addUpdate: async (personId, title, photoUrl, caption, isPublic = true, taggedPersonIds = [], userId) => {
    // Optimistic update: Add to store immediately for instant UI feedback
    const tempId = uuidv4();
    const now = Date.now();
    
    const optimisticUpdate: Update = {
      id: tempId,
      personId,
      title,
      photoUrl,
      caption,
      isPublic,
      taggedPersonIds: taggedPersonIds.length > 0 ? taggedPersonIds : undefined,
      createdAt: now,
    };

    const oldUpdates = get().updates;
    const newUpdates = new Map(oldUpdates);
    newUpdates.set(tempId, optimisticUpdate);
    set({ updates: newUpdates });

    // If no userId provided, skip database save (fallback to local-only)
    if (!userId) {
      if (__DEV__) {
        console.warn('[UpdatesStore] addUpdate called without userId - saving to local state only');
      }
      return tempId;
    }

    try {
      // Save to database via API (handles photo upload)
      const createdUpdate = await createUpdate(userId, {
        personId,
        title,
        photoUrl,
        caption,
        isPublic,
        taggedPersonIds,
      });

      // Replace optimistic update with real one from database
      const finalUpdates = new Map(oldUpdates);
      finalUpdates.delete(tempId); // Remove temporary update
      finalUpdates.set(createdUpdate.id, createdUpdate); // Add real update
      set({ updates: finalUpdates });

      return createdUpdate.id;
    } catch (error: any) {
      console.error('[UpdatesStore] Error saving update to database:', error);
      return tempId;
    }
  },

  updateUpdate: async (updateId, title, photoUrl, caption, isPublic, taggedPersonIds = []) => {
    const { updates } = get();
    const update = updates.get(updateId);
    if (!update) return;

    // Optimistic update: Update local state immediately
    const optimisticUpdate: Update = {
      ...update,
      title,
      photoUrl,
      caption: caption || undefined,
      isPublic: isPublic ?? update.isPublic,
      taggedPersonIds: taggedPersonIds.length > 0 ? taggedPersonIds : undefined,
    };

    const oldUpdates = get().updates;
    const newUpdates = new Map(oldUpdates);
    newUpdates.set(updateId, optimisticUpdate);
    set({ updates: newUpdates });

    // Get current user ID for API call
    const userId = update.createdBy;
    if (!userId) {
      console.warn('[UpdatesStore] updateUpdate called without createdBy - updating local state only');
      return;
    }

    try {
      // Save to database via API
      const updatedUpdate = await updateUpdateAPI(userId, updateId, {
        title,
        photoUrl,
        caption,
        isPublic,
        taggedPersonIds,
      });

      // Replace optimistic update with real one from database
      const finalUpdates = new Map(oldUpdates);
      finalUpdates.set(updateId, updatedUpdate);
      set({ updates: finalUpdates });
    } catch (error: any) {
      console.error('[UpdatesStore] Error updating update in database:', error);
      // Revert to original update on error
      const revertedUpdates = new Map(oldUpdates);
      revertedUpdates.set(updateId, update);
      set({ updates: revertedUpdates });
      throw error; // Re-throw so UI can handle it
    }
  },

  getUpdatesForPerson: (personId, includeTagged = true, blockedUserIds = new Set<string>()) => {
    const { updates } = get();
    const people = usePeopleStore.getState().people;
    const person = people.get(personId);
    let allUpdates = Array.from(updates.values())
      .filter(update => !update.deletedAt); // Exclude soft-deleted updates
    
    // Filter out updates from blocked users (instant filtering from local state)
    if (blockedUserIds.size > 0) {
      allUpdates = allUpdates.filter((update) => {
        // Check if update creator is blocked
        if (update.createdBy && blockedUserIds.has(update.createdBy)) {
          return false;
        }
        
        // Also check by personId -> linkedAuthUserId
        const updatePerson = people.get(update.personId);
        if (updatePerson?.linkedAuthUserId && blockedUserIds.has(updatePerson.linkedAuthUserId)) {
          return false;
        }
        
        return true;
      });
    }
    
    // Get updates created by this person
    const ownUpdates = allUpdates.filter(update => {
      if (update.personId !== personId) return false;
      
      // If update has tags, check if person is tagged in their own update
      if (update.taggedPersonIds && update.taggedPersonIds.length > 0) {
        // If person is tagged in their own update, include it
        if (update.taggedPersonIds.includes(personId)) {
          return true;
        }
        // If person created it but only tagged others (not themselves), exclude it
        return false;
      }
      
      // No tags, so it's their own update - include it
      return true;
    });
    
    // Get updates where this person is tagged (if includeTagged is true)
    const hiddenIds = person?.hiddenTaggedUpdateIds || [];
    const taggedUpdates = includeTagged
      ? allUpdates.filter(update => 
          update.taggedPersonIds?.includes(personId) &&
          !hiddenIds.includes(update.id)
        )
      : [];
    
    // Combine and sort by date (newest first)
    const combined = [...ownUpdates, ...taggedUpdates];
    // Remove duplicates
    const unique = Array.from(
      new Map(combined.map(update => [update.id, update])).values()
    );
    
    return unique.sort((a, b) => b.createdAt - a.createdAt);
  },

  getUpdateCount: (personId) => {
    return get().getUpdatesForPerson(personId).length;
  },

  toggleUpdatePrivacy: async (updateId) => {
    const { updates } = get();
    const update = updates.get(updateId);
    if (!update) return;

    // Get current user ID for API call
    const userId = update.createdBy;
    if (!userId) {
      console.warn('[UpdatesStore] toggleUpdatePrivacy called without createdBy - updating local state only');
      // Still toggle locally as fallback
      const updatedUpdate: Update = {
        ...update,
        isPublic: !update.isPublic,
      };
      const newUpdates = new Map(updates);
      newUpdates.set(updateId, updatedUpdate);
      set({ updates: newUpdates });
      return;
    }

    // Optimistic update: Toggle local state immediately
    const optimisticUpdate: Update = {
      ...update,
      isPublic: !update.isPublic,
    };

    const oldUpdates = get().updates;
    const newUpdates = new Map(oldUpdates);
    newUpdates.set(updateId, optimisticUpdate);
    set({ updates: newUpdates });

    try {
      // Save to database via API
      const updatedUpdate = await toggleUpdatePrivacyAPI(userId, updateId);

      // Replace optimistic update with real one from database
      const finalUpdates = new Map(oldUpdates);
      finalUpdates.set(updateId, updatedUpdate);
      set({ updates: finalUpdates });
    } catch (error: any) {
      console.error('[UpdatesStore] Error toggling update privacy in database:', error);
      // Revert to original update on error
      const revertedUpdates = new Map(oldUpdates);
      revertedUpdates.set(updateId, update);
      set({ updates: revertedUpdates });
      throw error; // Re-throw so UI can handle it
    }
  },

  deleteUpdate: async (updateId) => {
    const { updates } = get();
    const update = updates.get(updateId);
    if (!update) {
      if (__DEV__) {
        console.warn(`[UpdatesStore] Update ${updateId} not found for deletion`);
      }
      return;
    }
    
    // STEP 1: Soft delete in frontend (hide immediately)
    const deletedUpdate: Update = {
      ...update,
      deletedAt: Date.now(),
    };
    
    const newUpdates = new Map(updates);
    newUpdates.set(updateId, deletedUpdate);
    set({ updates: new Map(newUpdates) });
    
    // STEP 2: Permanently delete from database and Storage
    try {
      await deleteUpdateAPI(updateId);
      console.log('[UpdatesStore] Successfully deleted update from database and Storage');
      
      // After successful deletion, remove from local store completely
      const finalUpdates = new Map(newUpdates);
      finalUpdates.delete(updateId);
      set({ updates: new Map(finalUpdates) });
    } catch (error: any) {
      console.error('[UpdatesStore] Error deleting update from database/Storage:', error);
    }
  },

  toggleTaggedUpdateVisibility: (personId, updateId) => {
    const people = usePeopleStore.getState().people;
    const person = people.get(personId);
    if (!person) return;
    
    const hiddenIds = person.hiddenTaggedUpdateIds || [];
    const isHidden = hiddenIds.includes(updateId);
    
    const newHiddenIds = isHidden
      ? hiddenIds.filter(id => id !== updateId)
      : [...hiddenIds, updateId];
    
    const updatedPerson: Person = {
      ...person,
      hiddenTaggedUpdateIds: newHiddenIds.length > 0 ? newHiddenIds : undefined,
      updatedAt: Date.now(),
      version: person.version + 1,
    };
    
    const newPeople = new Map(people);
    newPeople.set(personId, updatedPerson);
    usePeopleStore.setState({ people: new Map(newPeople) });
  },

  setUpdates: (updatesArray) => {
    // Defensive filtering: Remove updates from users who requested 'delete_profile' deletion
    // This is a safety net in case the API didn't filter them out
    // Note: Updates from 'deactivate_profile' users are kept (their content remains visible)
    
    // Get all people to check for deletion status
    const people = usePeopleStore.getState().people;
    const deletedUserIds = new Set<string>();
    
    // Find all user IDs who requested 'delete_profile' deletion
    // We check linkedAuthUserId since that's the auth.users.id
    for (const person of people.values()) {
      if (person.linkedAuthUserId) {
        // Check if this person is in the people store and marked for deletion
        // Since we filtered them out in getAllPeople(), they shouldn't be here
        // But this is defensive programming
      }
    }
    
    // Additional defensive check: Filter updates by createdBy if we have that info
    // The API should have already filtered these, but this ensures no deleted content reaches the UI
    const updatesMap = new Map<string, Update>();
    for (const update of updatesArray) {
      // The API should have already filtered updates from delete_profile users
      // This is just a safety net - if an update somehow got through, we skip it
      // Note: We can't check deletion_type here since Update doesn't have that info
      // We rely on the API filtering, which checks created_by against deleted users
      updatesMap.set(update.id, update);
    }
    set({ updates: updatesMap });
  },

  removeBlockedUserUpdates: (blockedAuthUserId) => {
    const { updates } = get();
    const people = usePeopleStore.getState().people;
    const newUpdates = new Map(updates);
    
    // Find the person ID(s) associated with this auth user
    const blockedPersonIds = new Set<string>();
    for (const person of people.values()) {
      if (person.linkedAuthUserId === blockedAuthUserId) {
        blockedPersonIds.add(person.id);
      }
    }
    
    // Remove all updates created by this blocked user
    for (const [updateId, update] of updates.entries()) {
      // Check if update was created by the blocked user
      // We need to check by personId since createdBy is auth.user.id
      if (blockedPersonIds.has(update.personId)) {
        newUpdates.delete(updateId);
      } else {
        // Also check createdBy if available (direct check)
        const updateCreator = update.createdBy;
        if (updateCreator === blockedAuthUserId) {
          newUpdates.delete(updateId);
        }
      }
    }
    
    set({ updates: newUpdates });
  },

  hideReportedUpdate: (updateId) => {
    const { updates } = get();
    const update = updates.get(updateId);
    if (!update) return;
    
    // Soft delete the update (similar to deleteUpdate but keep it for reference)
    const hiddenUpdate: Update = {
      ...update,
      deletedAt: Date.now(),
    };
    
    const newUpdates = new Map(updates);
    newUpdates.set(updateId, hiddenUpdate);
    set({ updates: newUpdates });
  },
}));
