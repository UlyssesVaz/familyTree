import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { Person, Update } from '@/types/family-tree';
import { createUpdate, deleteUpdate as deleteUpdateAPI, getAllUpdates } from '@/services/supabase/updates-api';
import { createRelative, getAllPeople } from '@/services/supabase/people-api';
import { createRelationship } from '@/services/supabase/relationships-api';

/**
 * Minimal Family Tree Store
 * 
 * Just enough to hold one person (ego) for display.
 * Will expand later as features are added incrementally.
 */

// Track if syncFamilyTree is currently running to prevent concurrent calls
let isSyncing = false;
interface FamilyTreeStore {
  /** Map of person ID to Person object */
  people: Map<string, Person>;
  
  /** Map of update ID to Update object */
  updates: Map<string, Update>;
  
  /** ID of the ego (focal person) - null if not initialized */
  egoId: string | null;
  
  /** Initialize the ego (focal person) */
  initializeEgo: (name: string, birthDate?: string, gender?: Person['gender'], userId?: string) => void;
  
  /** Load a complete Person object as the ego (used when loading from database) */
  loadEgo: (person: Person) => void;
  
  /** Update ego's profile information */
  updateEgo: (updates: Partial<Pick<Person, 'name' | 'bio' | 'birthDate' | 'gender' | 'photoUrl'>>) => void;
  
  /** Get a person by ID */
  getPerson: (id: string) => Person | undefined;
  
  /** Get the ego person */
  getEgo: () => Person | null;
  
  /** Clear ego and reset store (for sign out) */
  clearEgo: () => void;
  
  /** Count all ancestors (recursive parent traversal) */
  countAncestors: (personId: string) => number;
  
  /** Count all descendants (recursive child traversal) */
  countDescendants: (personId: string) => number;
  
  /** Add an update (photo) to a person's profile */
  addUpdate: (personId: string, title: string, photoUrl: string, caption?: string, isPublic?: boolean, taggedPersonIds?: string[], userId?: string) => Promise<string>;
  
  /** Update an existing update */
  updateUpdate: (updateId: string, title: string, photoUrl: string, caption?: string, isPublic?: boolean, taggedPersonIds?: string[]) => void;
  
  /** Get all updates for a person (sorted by time, newest first) */
  getUpdatesForPerson: (personId: string) => Update[];
  
  /** Get update count for a person */
  getUpdateCount: (personId: string) => number;
  
  /** Toggle update privacy (public/private) */
  toggleUpdatePrivacy: (updateId: string) => void;
  
  /** Delete an update (soft delete in frontend, then permanent delete from database/Storage) */
  deleteUpdate: (updateId: string) => Promise<void>;

  /** Toggle visibility of a tagged update on a person's profile */
  toggleTaggedUpdateVisibility: (personId: string, updateId: string) => void;

  /** Create a new person and add to store (syncs with backend) */
  addPerson: (data: {
    name: string;
    photoUrl?: string;
    birthDate?: string;
    gender?: Person['gender'];
    phoneNumber?: string;
  }, userId?: string) => Promise<string>;
  
  /** Sync family tree from backend (loads all people and relationships) */
  syncFamilyTree: (userId: string) => Promise<void>;

  /** Add a parent relationship (bidirectional, syncs with backend) */
  addParent: (childId: string, parentId: string, userId?: string) => Promise<void>;

  /** Add a spouse relationship (bidirectional, syncs with backend) */
  addSpouse: (personId1: string, personId2: string, userId?: string) => Promise<void>;

  /** Add a child relationship (bidirectional, syncs with backend) */
  addChild: (parentId: string, childId: string, userId?: string) => Promise<void>;

  /** Add a sibling relationship (people who share at least one parent, syncs with backend) */
  addSibling: (personId1: string, personId2: string, userId?: string) => Promise<void>;

  /** Get siblings of a person (people who share at least one parent) */
  getSiblings: (personId: string) => Person[];
  
  /** Sync family tree from backend (loads all people and relationships) */
  syncFamilyTree: (userId: string) => Promise<void>;
}

export const useFamilyTreeStore = create<FamilyTreeStore>((set, get) => ({
  people: new Map(),
  updates: new Map(),
  egoId: null,

  initializeEgo: (name, birthDate, gender, userId) => {
    const id = uuidv4();
    const now = Date.now();
    
    const ego: Person = {
      id,
      name,
      birthDate,
      gender,
      parentIds: [],
      spouseIds: [],
      childIds: [],
      siblingIds: [],
      createdAt: now,
      updatedAt: now,
      version: 1,
      createdBy: userId,
      updatedBy: userId,
    };

    const newPeople = new Map(get().people);
    newPeople.set(id, ego);

    set({
      people: newPeople,
      egoId: id,
    });
  },

  loadEgo: (person) => {
    const newPeople = new Map(get().people);
    newPeople.set(person.id, person);

    set({
      people: newPeople,
      egoId: person.id,
    });
  },

  updateEgo: (updates) => {
    const { egoId, people } = get();
    if (!egoId) return;

    const ego = people.get(egoId);
    if (!ego) return;

    const updatedEgo: Person = {
      ...ego,
      ...updates,
      updatedAt: Date.now(),
      version: ego.version + 1,
    };

    const newPeople = new Map(people);
    newPeople.set(egoId, updatedEgo);

    // Force a new Map reference to ensure Zustand detects the change
    set({ people: new Map(newPeople) });
  },

  getPerson: (id) => {
    return get().people.get(id);
  },

  getEgo: () => {
    const { egoId, people } = get();
    if (!egoId) return null;
    return people.get(egoId) || null;
  },

  clearEgo: () => {
    set({
      egoId: null,
      people: new Map(),
      updates: new Map(),
    });
  },

  countAncestors: (personId) => {
    const { people } = get();
    const person = people.get(personId);
    if (!person) return 0;

    const visited = new Set<string>();
    const queue: string[] = [...person.parentIds];
    let count = 0;

    while (queue.length > 0) {
      const parentId = queue.shift()!;
      if (visited.has(parentId)) continue;
      visited.add(parentId);
      count++;

      const parent = people.get(parentId);
      if (parent) {
        queue.push(...parent.parentIds);
      }
    }

    return count;
  },

  countDescendants: (personId) => {
    const { people } = get();
    const person = people.get(personId);
    if (!person) return 0;

    const visited = new Set<string>();
    const queue: string[] = [...person.childIds];
    let count = 0;

    while (queue.length > 0) {
      const childId = queue.shift()!;
      if (visited.has(childId)) continue;
      visited.add(childId);
      count++;

      const child = people.get(childId);
      if (child) {
        queue.push(...child.childIds);
      }
    }

    return count;
  },

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
      console.warn('[FamilyTreeStore] addUpdate called without userId - saving to local state only');
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
      console.error('[FamilyTreeStore] Error saving update to database:', error);
      
      // Keep optimistic update on error (user sees it, but it's not persisted)
      // In future, could show error toast and remove optimistic update
      return tempId;
    }
  },

  updateUpdate: (updateId, title, photoUrl, caption, isPublic, taggedPersonIds = []) => {
    const { updates } = get();
    const update = updates.get(updateId);
    if (!update) return;

    const updatedUpdate: Update = {
      ...update,
      title,
      photoUrl,
      caption: caption || undefined,
      isPublic: isPublic ?? update.isPublic,
      taggedPersonIds: taggedPersonIds.length > 0 ? taggedPersonIds : undefined,
    };

    const newUpdates = new Map(updates);
    newUpdates.set(updateId, updatedUpdate);

    set({ updates: newUpdates });
  },

  getUpdatesForPerson: (personId, includeTagged = true) => {
    const { updates, people } = get();
    const person = people.get(personId);
    const allUpdates = Array.from(updates.values())
      .filter(update => !update.deletedAt); // Exclude soft-deleted updates
    
    // Get updates created by this person
    // BUT exclude updates where person created it but only tagged others (not themselves)
    // This handles the "Add Story" case where ego creates a memory about someone else
    const ownUpdates = allUpdates.filter(update => {
      if (update.personId !== personId) return false;
      
      // If update has tags, check if person is tagged in their own update
      if (update.taggedPersonIds && update.taggedPersonIds.length > 0) {
        // If person is tagged in their own update, include it
        if (update.taggedPersonIds.includes(personId)) {
          return true;
        }
        // If person created it but only tagged others (not themselves), exclude it
        // This is a memory about someone else, not about themselves
        return false;
      }
      
      // No tags, so it's their own update - include it
      return true;
    });
    
    // Get updates where this person is tagged (if includeTagged is true)
    // Exclude updates that person has hidden
    const hiddenIds = person?.hiddenTaggedUpdateIds || [];
    const taggedUpdates = includeTagged
      ? allUpdates.filter(update => 
          update.taggedPersonIds?.includes(personId) &&
          !hiddenIds.includes(update.id)
        )
      : [];
    
    // Combine and sort by date (newest first)
    const combined = [...ownUpdates, ...taggedUpdates];
    // Remove duplicates (in case person created update and tagged themselves)
    const unique = Array.from(
      new Map(combined.map(update => [update.id, update])).values()
    );
    
    return unique.sort((a, b) => b.createdAt - a.createdAt);
  },

  getUpdateCount: (personId) => {
    // Use getUpdatesForPerson to get accurate count (includes own updates + tagged updates)
    return get().getUpdatesForPerson(personId).length;
  },

  toggleUpdatePrivacy: (updateId) => {
    const { updates } = get();
    const update = updates.get(updateId);
    if (!update) return;

    const updatedUpdate: Update = {
      ...update,
      isPublic: !update.isPublic,
    };

    const newUpdates = new Map(updates);
    newUpdates.set(updateId, updatedUpdate);

    set({ updates: newUpdates });
  },

  deleteUpdate: async (updateId) => {
    const { updates } = get();
    const update = updates.get(updateId);
    if (!update) {
      console.warn(`Update ${updateId} not found for deletion`);
      return;
    }
    
    // STEP 1: Soft delete in frontend (hide immediately for instant UI feedback)
    // Set deletedAt timestamp instead of removing from Map
    const deletedUpdate: Update = {
      ...update,
      deletedAt: Date.now(),
    };
    
    const newUpdates = new Map(updates);
    newUpdates.set(updateId, deletedUpdate);
    
    // Force Zustand to recognize the change by creating a completely new Map
    set({ updates: new Map(newUpdates) });
    
    // STEP 2: Permanently delete from database and Storage (async, non-blocking)
    // This happens after the UI update so the user sees immediate feedback
    // If this fails, the update is still hidden (soft delete) but remains in database
    try {
      await deleteUpdateAPI(updateId);
      console.log('[FamilyTreeStore] Successfully deleted update from database and Storage');
      
      // After successful deletion, remove from local store completely
      // (optional - could keep it with deletedAt for recovery, but removing for cleanliness)
      const finalUpdates = new Map(newUpdates);
      finalUpdates.delete(updateId);
      set({ updates: new Map(finalUpdates) });
    } catch (error: any) {
      console.error('[FamilyTreeStore] Error deleting update from database/Storage:', error);
      // Update remains soft-deleted (hidden) in the UI
      // User can try again later or it will be cleaned up on next sync
    }
  },

  toggleTaggedUpdateVisibility: (personId, updateId) => {
    const { people } = get();
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
    
    // Force a new Map reference to ensure Zustand detects the change
    set({ people: new Map(newPeople) });
  },

  addPerson: async (data, userId) => {
    // STEP 1: Optimistic update - add to store immediately for instant UI feedback
    const tempId = uuidv4();
    const now = Date.now();

    const optimisticPerson: Person = {
      id: tempId,
      name: data.name,
      photoUrl: data.photoUrl,
      birthDate: data.birthDate,
      gender: data.gender,
      phoneNumber: data.phoneNumber,
      parentIds: [],
      spouseIds: [],
      childIds: [],
      siblingIds: [],
      createdAt: now,
      updatedAt: now,
      version: 1,
      linkedAuthUserId: undefined, // Ancestor profile (no linked auth user)
    };

    const oldPeople = get().people;
    const newPeople = new Map(oldPeople);
    newPeople.set(tempId, optimisticPerson);
    set({ people: newPeople });

    // STEP 2: If no userId provided, skip database save (fallback to local-only)
    if (!userId) {
      console.warn('[FamilyTreeStore] addPerson called without userId - saving to local state only');
      return tempId;
    }

    try {
      // STEP 3: Save to database via API (handles photo upload)
      const createdPerson = await createRelative(userId, {
        name: data.name,
        birthDate: data.birthDate,
        gender: data.gender,
        photoUrl: data.photoUrl,
        bio: undefined,
        phoneNumber: data.phoneNumber,
      });

      // STEP 4: Replace optimistic person with real one from database
      // CRITICAL: This ensures relationships use the DB-generated user_id, not temp ID
      const finalPeople = new Map(oldPeople);
      finalPeople.delete(tempId); // Remove temporary person
      finalPeople.set(createdPerson.id, createdPerson); // Add real person with DB-generated user_id
      set({ people: finalPeople });

      // STEP 5: Return the real DB-generated user_id for relationship creation
      // This ensures createRelationship uses the correct ID (not temp ID)
      return createdPerson.id;
    } catch (error: any) {
      console.error('[FamilyTreeStore] Error saving person to database:', error);
      
      // Keep optimistic person on error (user sees it, but it's not persisted)
      // In future, could show error toast and remove optimistic person
      return tempId;
    }
  },

  addParent: async (childId, parentId, userId) => {
    // NOTE: childId and parentId should be DB-generated user_ids (not temp IDs)
    // This is ensured because addPerson replaces temp ID with real ID before returning
    console.log('[DEBUG] addParent: Entry', { childId, parentId, userId, availablePersonIds: Array.from(get().people.keys()) });
    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/f336e8f0-8f7a-40aa-8f54-32371722b5de',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'family-tree-store.ts:502',message:'addParent entry',data:{childId,parentId,userId,availablePersonIds:Array.from(get().people.keys())},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
    // #endregion
    const { people } = get();
    const child = people.get(childId);
    const parent = people.get(parentId);

    if (!child || !parent) {
      console.warn(`Cannot add parent: child or parent not found. childId: ${childId}, parentId: ${parentId}`);
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/f336e8f0-8f7a-40aa-8f54-323722b5de',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'family-tree-store.ts:509',message:'addParent person not found',data:{childId,parentId,availablePersonIds:Array.from(people.keys()),childFound:!!child,parentFound:!!parent},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      // Log available person IDs for debugging
      if (__DEV__) {
        console.log('[Store] Available person IDs:', Array.from(people.keys()));
      }
      return;
    }

    if (childId === parentId) {
      console.warn(`Cannot add parent: person cannot be their own parent`);
      return;
    }

    // Check if relationship already exists
    if (child.parentIds.includes(parentId)) {
      console.warn(`Parent relationship already exists`);
      return;
    }

    // STEP 1: Optimistic update - update store immediately for instant UI feedback
    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/f336e8f0-8f7a-40aa-8f54-323722b5de',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'family-tree-store.ts:529',message:'addParent before optimistic update',data:{childId,parentId,childParentIds:child.parentIds,parentChildIds:parent.childIds},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    const updatedChild: Person = {
      ...child,
      parentIds: [...child.parentIds, parentId],
      updatedAt: Date.now(),
      version: child.version + 1,
    };

    const updatedParent: Person = {
      ...parent,
      childIds: [...parent.childIds, childId],
      updatedAt: Date.now(),
      version: parent.version + 1,
    };

    const oldPeople = get().people;
    const newPeople = new Map(oldPeople);
    newPeople.set(childId, updatedChild);
    newPeople.set(parentId, updatedParent);
    set({ people: new Map(newPeople) });
    console.log('[DEBUG] addParent: Optimistic update applied', { 
      childId, 
      parentId, 
      childParentIds: updatedChild.parentIds, 
      parentChildIds: updatedParent.childIds,
      storePeopleSize: newPeople.size 
    });
    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/f336e8f0-8f7a-40aa-8f54-323722b5de',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'family-tree-store.ts:548',message:'addParent after optimistic update',data:{childId,parentId,updatedChildParentIds:updatedChild.parentIds,updatedParentChildIds:updatedParent.childIds,storePeopleSize:newPeople.size},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    
    if (__DEV__) {
      const childName = updatedChild.name;
      const parentName = updatedParent.name;
      console.log(`[Store] Added parent relationship: ${parentName} -> ${childName}`);
    }

    // STEP 2: If no userId provided, skip database save (fallback to local-only)
    if (!userId) {
      console.warn('[FamilyTreeStore] addParent called without userId - saving to local state only');
      return;
    }

    try {
      // STEP 3: Save relationship to database via API
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/f336e8f0-8f7a-40aa-8f54-323722b5de',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'family-tree-store.ts:563',message:'addParent calling createRelationship',data:{userId,personOneId:parentId,personTwoId:childId,relationshipType:'parent'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      // Silent background save: Save to database without refetching
      // Follows the same pattern as addUpdate: optimistic update → save to DB → no refetch
      // This prevents UI flicker and saves bandwidth
      // WebSockets will handle real-time updates from other users later
      const relationshipId = await createRelationship(userId, {
        personOneId: parentId,
        personTwoId: childId,
        relationshipType: 'parent',
      });
      console.log('[DEBUG] addParent: Relationship saved to DB', { relationshipId, parentId, childId });
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/f336e8f0-8f7a-40aa-8f54-323722b5de',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'family-tree-store.ts:569',message:'addParent createRelationship success',data:{relationshipId,personOneId:parentId,personTwoId:childId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      
      // NOTE: No refetch after save - optimistic update is sufficient
      // Backend sync happens once on app startup (in auth-context.tsx)
      // Future: WebSockets will handle real-time updates from other users
    } catch (error: any) {
      console.error('[FamilyTreeStore] Error saving parent relationship to database:', error);
      
      // Rollback optimistic update on error
      const rollbackPeople = new Map(oldPeople);
      rollbackPeople.set(childId, child);
      rollbackPeople.set(parentId, parent);
      set({ people: rollbackPeople });
      
      // In future, could show error toast
    }
  },

  addSpouse: async (personId1, personId2, userId) => {
    const { people } = get();
    const person1 = people.get(personId1);
    const person2 = people.get(personId2);

    if (!person1 || !person2) {
      console.warn(`Cannot add spouse: person not found`);
      return;
    }

    if (personId1 === personId2) {
      console.warn(`Cannot add spouse: person cannot be their own spouse`);
      return;
    }

    // Check if relationship already exists
    if (person1.spouseIds.includes(personId2)) {
      console.warn(`Spouse relationship already exists`);
      return;
    }

    // STEP 1: Optimistic update
    const updatedPerson1: Person = {
      ...person1,
      spouseIds: [...person1.spouseIds, personId2],
      updatedAt: Date.now(),
      version: person1.version + 1,
    };

    const updatedPerson2: Person = {
      ...person2,
      spouseIds: [...person2.spouseIds, personId1],
      updatedAt: Date.now(),
      version: person2.version + 1,
    };

    const oldPeople = get().people;
    const newPeople = new Map(oldPeople);
    newPeople.set(personId1, updatedPerson1);
    newPeople.set(personId2, updatedPerson2);
    set({ people: new Map(newPeople) });
    
    if (__DEV__) {
      console.log(`[Store] Added spouse relationship: ${updatedPerson1.name} <-> ${updatedPerson2.name}`);
    }

    // STEP 2: If no userId provided, skip database save
    if (!userId) {
      console.warn('[FamilyTreeStore] addSpouse called without userId - saving to local state only');
      return;
    }

    try {
      // Silent background save: Save to database without refetching
      // Follows the same pattern as addUpdate: optimistic update → save to DB → no refetch
      await createRelationship(userId, {
        personOneId: personId1,
        personTwoId: personId2,
        relationshipType: 'spouse',
      });
    } catch (error: any) {
      console.error('[FamilyTreeStore] Error saving spouse relationship to database:', error);
      
      // Rollback optimistic update on error
      const rollbackPeople = new Map(oldPeople);
      rollbackPeople.set(personId1, person1);
      rollbackPeople.set(personId2, person2);
      set({ people: rollbackPeople });
    }
  },

  addChild: async (parentId, childId, userId) => {
    const { people } = get();
    const parent = people.get(parentId);
    const child = people.get(childId);

    if (!parent || !child) {
      console.warn(`Cannot add child: parent or child not found`);
      return;
    }

    if (parentId === childId) {
      console.warn(`Cannot add child: person cannot be their own child`);
      return;
    }

    // Check if relationship already exists
    if (parent.childIds.includes(childId)) {
      console.warn(`Child relationship already exists`);
      return;
    }

    // STEP 1: Optimistic update
    const updatedParent: Person = {
      ...parent,
      childIds: [...parent.childIds, childId],
      updatedAt: Date.now(),
      version: parent.version + 1,
    };

    const updatedChild: Person = {
      ...child,
      parentIds: [...child.parentIds, parentId],
      updatedAt: Date.now(),
      version: child.version + 1,
    };

    const oldPeople = get().people;
    const newPeople = new Map(oldPeople);
    newPeople.set(parentId, updatedParent);
    newPeople.set(childId, updatedChild);
    set({ people: new Map(newPeople) });
    
    if (__DEV__) {
      console.log(`[Store] Added child relationship: ${updatedParent.name} -> ${updatedChild.name}`);
    }

    // STEP 2: If no userId provided, skip database save
    if (!userId) {
      console.warn('[FamilyTreeStore] addChild called without userId - saving to local state only');
      return;
    }

    try {
      // Silent background save: Save to database without refetching
      // Follows the same pattern as addUpdate: optimistic update → save to DB → no refetch
      await createRelationship(userId, {
        personOneId: parentId,
        personTwoId: childId,
        relationshipType: 'child',
      });
    } catch (error: any) {
      console.error('[FamilyTreeStore] Error saving child relationship to database:', error);
      
      // Rollback optimistic update on error
      const rollbackPeople = new Map(oldPeople);
      rollbackPeople.set(parentId, parent);
      rollbackPeople.set(childId, child);
      set({ people: rollbackPeople });
    }
  },

  addSibling: async (personId1, personId2, userId) => {
    const { people } = get();
    const person1 = people.get(personId1);
    const person2 = people.get(personId2);

    if (!person1 || !person2) {
      console.warn(`Cannot add sibling: person not found`);
      return;
    }

    if (personId1 === personId2) {
      console.warn(`Cannot add sibling: person cannot be their own sibling`);
      return;
    }

    // Check if relationship already exists
    if (person1.siblingIds.includes(personId2)) {
      console.warn(`Sibling relationship already exists`);
      return;
    }

    const oldPeople = get().people;
    const newPeople = new Map(oldPeople);
    let hasChanges = false;

    // Create direct bidirectional sibling relationship
    // This works even if neither person has parents (for half-siblings, unknown parents, etc.)
    const updatedPerson1: Person = {
      ...person1,
      siblingIds: [...person1.siblingIds, personId2],
      updatedAt: Date.now(),
      version: person1.version + 1,
    };

    const updatedPerson2: Person = {
      ...person2,
      siblingIds: [...person2.siblingIds, personId1],
      updatedAt: Date.now(),
      version: person2.version + 1,
    };

    newPeople.set(personId1, updatedPerson1);
    newPeople.set(personId2, updatedPerson2);
    hasChanges = true;

    // Also link through shared parents if they exist (for consistency)
    // If person1 has parents, ensure person2 is a child of those parents
    for (const parentId of person1.parentIds) {
      const parent = newPeople.get(parentId);
      if (parent && !parent.childIds.includes(personId2)) {
        const updatedParent: Person = {
          ...parent,
          childIds: [...parent.childIds, personId2],
          updatedAt: Date.now(),
          version: parent.version + 1,
        };
        newPeople.set(parentId, updatedParent);

        // Also update person2 to have this parent
        if (!updatedPerson2.parentIds.includes(parentId)) {
          const updatedPerson2WithParent: Person = {
            ...updatedPerson2,
            parentIds: [...updatedPerson2.parentIds, parentId],
            updatedAt: Date.now(),
            version: updatedPerson2.version + 1,
          };
          newPeople.set(personId2, updatedPerson2WithParent);
        }
      }
    }

    // If person2 has parents, ensure person1 is a child of those parents
    for (const parentId of person2.parentIds) {
      const parent = newPeople.get(parentId);
      if (parent && !parent.childIds.includes(personId1)) {
        const updatedParent: Person = {
          ...parent,
          childIds: [...parent.childIds, personId1],
          updatedAt: Date.now(),
          version: parent.version + 1,
        };
        newPeople.set(parentId, updatedParent);

        // Also update person1 to have this parent
        const currentPerson1 = newPeople.get(personId1)!;
        if (!currentPerson1.parentIds.includes(parentId)) {
          const updatedPerson1WithParent: Person = {
            ...currentPerson1,
            parentIds: [...currentPerson1.parentIds, parentId],
            updatedAt: Date.now(),
            version: currentPerson1.version + 1,
          };
          newPeople.set(personId1, updatedPerson1WithParent);
        }
      }
    }

    if (hasChanges) {
      // STEP 1: Optimistic update - update store immediately
      set({ people: new Map(newPeople) });
      
      if (__DEV__) {
        console.log(`[Store] Added sibling relationship: ${person1.name} <-> ${person2.name}`);
      }

      // STEP 2: If no userId provided, skip database save
      if (!userId) {
        console.warn('[FamilyTreeStore] addSibling called without userId - saving to local state only');
        return;
      }

      try {
        // Silent background save: Save to database without refetching
        // Follows the same pattern as addUpdate: optimistic update → save to DB → no refetch
        // Note: Parent linking logic above is frontend-only for now
        // Can be enhanced later to create parent relationships via API if needed
        await createRelationship(userId, {
          personOneId: personId1,
          personTwoId: personId2,
          relationshipType: 'sibling',
        });
      } catch (error: any) {
        console.error('[FamilyTreeStore] Error saving sibling relationship to database:', error);
        
        // Rollback optimistic update on error
        set({ people: new Map(oldPeople) });
      }
    }
  },

  getSiblings: (personId) => {
    const { people } = get();
    const person = people.get(personId);
    if (!person) return [];

    // Get all siblings: direct sibling relationships AND people who share at least one parent
    const siblingIds = new Set<string>();
    
    // 1. Add direct sibling relationships (for half-siblings, unknown parents, etc.)
    person.siblingIds.forEach(siblingId => {
      siblingIds.add(siblingId);
    });
    
    // 2. For each parent, get all their children (siblings through shared parents)
    for (const parentId of person.parentIds) {
      const parent = people.get(parentId);
      if (parent) {
        parent.childIds.forEach(childId => {
          if (childId !== personId) {
            siblingIds.add(childId);
          }
        });
      }
    }

    return Array.from(siblingIds)
      .map(id => people.get(id))
      .filter((p): p is Person => p !== undefined);
  },

  syncFamilyTree: async (userId) => {
    // Prevent concurrent sync calls - if already syncing, skip
    if (isSyncing) {
      console.log('[DEBUG] syncFamilyTree: Already syncing, skipping duplicate call');
      return;
    }
    
    isSyncing = true;
    console.log('[DEBUG] syncFamilyTree: Entry', { userId });
    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/f336e8f0-8f7a-40aa-8f54-323722b5de',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'family-tree-store.ts:875',message:'syncFamilyTree entry',data:{userId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    try {
      // Load all people, relationships, and updates from backend in parallel
      const [peopleFromBackend, updatesFromBackend] = await Promise.all([
        getAllPeople(),
        getAllUpdates(),
      ]);
      
      console.log('[DEBUG] syncFamilyTree: Got people from backend', { 
        peopleCount: peopleFromBackend.length,
        peopleIds: peopleFromBackend.map(p => p.id),
        peopleWithRelationships: peopleFromBackend.map(p => ({
          id: p.id,
          name: p.name,
          parentIds: p.parentIds.length,
          childIds: p.childIds.length,
          spouseIds: p.spouseIds.length,
          siblingIds: p.siblingIds.length
        }))
      });
      console.log('[DEBUG] syncFamilyTree: Got updates from backend', {
        updatesCount: updatesFromBackend.length,
        updatesByPerson: updatesFromBackend.reduce((acc, u) => {
          acc[u.personId] = (acc[u.personId] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      });
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/f336e8f0-8f7a-40aa-8f54-323722b5de',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'family-tree-store.ts:878',message:'syncFamilyTree got people from backend',data:{peopleCount:peopleFromBackend.length,peopleIds:peopleFromBackend.map(p=>p.id),peopleWithRelationships:peopleFromBackend.map(p=>({id:p.id,name:p.name,parentIds:p.parentIds.length,childIds:p.childIds.length,spouseIds:p.spouseIds.length}))},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      fetch('http://127.0.0.1:7244/ingest/f336e8f0-8f7a-40aa-8f54-323722b5de',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'family-tree-store.ts:940',message:'syncFamilyTree got updates from backend',data:{updatesCount:updatesFromBackend.length,updatesByPerson:updatesFromBackend.reduce((acc,u)=>{acc[u.personId]=(acc[u.personId]||0)+1;return acc;},{})},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      
      // Convert arrays to Maps for store
      const peopleMap = new Map<string, Person>();
      for (const person of peopleFromBackend) {
        peopleMap.set(person.id, person);
      }
      
      const updatesMap = new Map<string, Update>();
      for (const update of updatesFromBackend) {
        updatesMap.set(update.id, update);
      }
      
      // Update store with data from backend
      set({ people: peopleMap, updates: updatesMap });
      console.log('[DEBUG] syncFamilyTree: Updated store', { 
        storePeopleSize: peopleMap.size,
        storeUpdatesSize: updatesMap.size 
      });
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/f336e8f0-8f7a-40aa-8f54-323722b5de',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'family-tree-store.ts:887',message:'syncFamilyTree updated store',data:{storePeopleSize:peopleMap.size,storeUpdatesSize:updatesMap.size},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      
      // Set ego if user has a profile
      const ego = peopleFromBackend.find(p => p.linkedAuthUserId === userId);
      if (ego) {
        set({ egoId: ego.id });
      }
      
      console.log('[FamilyTreeStore] Successfully synced family tree from backend');
    } catch (error: any) {
      console.error('[FamilyTreeStore] Error syncing family tree:', error);
      // Don't throw - allow app to continue with local state
    } finally {
      isSyncing = false; // Always reset sync flag, even on error
    }
  },
}));

