/**
 * People Store
 * 
 * Manages person/people data in the family tree.
 * Base store with no dependencies.
 */

import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { Person } from '@/types/family-tree';
import { createRelative } from '@/services/supabase/people-api';

interface PeopleStore {
  /** Map of person ID to Person object */
  people: Map<string, Person>;
  
  /** Map of tempId -> realId for optimistic updates */
  tempIdMapping: Map<string, string>;
  
  /** Get a person by ID */
  getPerson: (id: string) => Person | undefined;
  
  /** Resolve temp ID to real ID (returns original if not a temp ID) */
  resolveTempId: (id: string) => string;
  
  /** Create a new person and add to store (syncs with backend) */
  addPerson: (data: {
    name: string;
    photoUrl?: string;
    birthDate?: string;
    gender?: Person['gender'];
    phoneNumber?: string;
  }, userId?: string) => Promise<string>;
  
  /** Set people (used by sync) */
  setPeople: (people: Person[]) => void;
  
  /** Remove a person from the store (e.g., when blocking a user) */
  removePerson: (personId: string) => void;
  
  /** Remove all people associated with a blocked auth user */
  removeBlockedUser: (blockedAuthUserId: string) => void;
  
  /** Update a person in the store (e.g., replace placeholder with real data when unblocking) */
  updatePerson: (person: Person) => void;
}

export const usePeopleStore = create<PeopleStore>((set, get) => ({
  people: new Map(),
  tempIdMapping: new Map(),

  getPerson: (id) => {
    // Resolve temp ID to real ID if needed
    const realId = get().resolveTempId(id);
    return get().people.get(realId);
  },

  resolveTempId: (id) => {
    const mapping = get().tempIdMapping;
    return mapping.get(id) || id;
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
      if (__DEV__) {
        console.warn('[PeopleStore] addPerson called without userId - saving to local state only');
      }
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

      // STEP 4: Map tempId to realId
      const newMapping = new Map(get().tempIdMapping);
      newMapping.set(tempId, createdPerson.id);

      // STEP 5: Replace optimistic person with real one from database
      // CRITICAL: This ensures relationships use the DB-generated user_id, not temp ID
      const finalPeople = new Map(oldPeople);
      finalPeople.delete(tempId); // Remove temporary person
      finalPeople.set(createdPerson.id, createdPerson); // Add real person with DB-generated user_id

      // STEP 6: Update any relationships that used tempId
      // This handles cases where relationships were created optimistically before real ID was available
      for (const [personId, person] of finalPeople.entries()) {
        let needsUpdate = false;
        const updated: Person = { ...person };

        // Check and update all relationship arrays
        if (person.parentIds.includes(tempId)) {
          updated.parentIds = person.parentIds.map(id => id === tempId ? createdPerson.id : id);
          needsUpdate = true;
        }
        if (person.childIds.includes(tempId)) {
          updated.childIds = person.childIds.map(id => id === tempId ? createdPerson.id : id);
          needsUpdate = true;
        }
        if (person.spouseIds.includes(tempId)) {
          updated.spouseIds = person.spouseIds.map(id => id === tempId ? createdPerson.id : id);
          needsUpdate = true;
        }
        if (person.siblingIds.includes(tempId)) {
          updated.siblingIds = person.siblingIds.map(id => id === tempId ? createdPerson.id : id);
          needsUpdate = true;
        }

        if (needsUpdate) {
          finalPeople.set(personId, updated);
          if (__DEV__) {
            console.log(`[PeopleStore] Updated relationships for ${person.name}: replaced tempId ${tempId} with realId ${createdPerson.id}`);
          }
        }
      }

      // Update store with both people and mapping
      set({ 
        people: finalPeople,
        tempIdMapping: newMapping
      });

      // STEP 7: Return the real DB-generated user_id for relationship creation
      // This ensures createRelationship uses the correct ID (not temp ID)
      return createdPerson.id;
    } catch (error: any) {
      console.error('[PeopleStore] Error saving person to database:', error);
      
      // Rollback: Remove tempId from mapping on error
      const newMapping = new Map(get().tempIdMapping);
      newMapping.delete(tempId);
      set({ tempIdMapping: newMapping });
      
      // Keep optimistic person on error (user sees it, but it's not persisted)
      // In future, could show error toast and remove optimistic person
      return tempId;
    }
  },

  setPeople: (peopleArray) => {
    const peopleMap = new Map<string, Person>();
    for (const person of peopleArray) {
      peopleMap.set(person.id, person);
    }
    set({ people: peopleMap }); // ✅ New Map instance
  },

  removePerson: (personId) => {
    set((state) => {
      const newPeople = new Map(state.people);
      newPeople.delete(personId);
      return { people: newPeople }; // ✅ Always new Map reference
    });
  },

  removeBlockedUser: (blockedAuthUserId) => {
    set((state) => {
      const newPeople = new Map(state.people);
      
      // Remove all people whose linkedAuthUserId matches the blocked user
      for (const [personId, person] of state.people.entries()) {
        if (person.linkedAuthUserId === blockedAuthUserId) {
          newPeople.delete(personId);
        }
      }
      
      return { people: newPeople }; // ✅ Always new Map reference
    });
  },
  
  updatePerson: (person: Person) => {
    set((state) => {
      const newPeople = new Map(state.people);
      newPeople.set(person.id, person);
      return { people: newPeople }; // ✅ Always new Map reference
    });
  },
}));
