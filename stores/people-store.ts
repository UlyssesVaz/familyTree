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
  
  /** Get a person by ID */
  getPerson: (id: string) => Person | undefined;
  
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
}

export const usePeopleStore = create<PeopleStore>((set, get) => ({
  people: new Map(),

  getPerson: (id) => {
    return get().people.get(id);
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
      console.error('[PeopleStore] Error saving person to database:', error);
      
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
    set({ people: peopleMap });
  },

  removePerson: (personId) => {
    const { people } = get();
    const newPeople = new Map(people);
    newPeople.delete(personId);
    set({ people: newPeople });
  },

  removeBlockedUser: (blockedAuthUserId) => {
    const { people } = get();
    const newPeople = new Map(people);
    
    // Remove all people whose linkedAuthUserId matches the blocked user
    for (const [personId, person] of people.entries()) {
      if (person.linkedAuthUserId === blockedAuthUserId) {
        newPeople.delete(personId);
      }
    }
    
    set({ people: newPeople });
  },
}));
