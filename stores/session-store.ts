/**
 * Session Store
 * 
 * Manages ego (current user's profile) and family tree synchronization.
 * Depends on PeopleStore, UpdatesStore, and RelationshipsStore.
 */

import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { Person } from '@/types/family-tree';
import { getAllPeople } from '@/services/supabase/people-api';
import { getAllUpdates } from '@/services/supabase/updates-api';
import { usePeopleStore } from './people-store';
import { useUpdatesStore } from './updates-store';
import type { AccountDeletionStatus } from '@/services/supabase/account-api';

interface SessionStore {
  /** ID of the ego (focal person) - null if not initialized */
  egoId: string | null;
  
  /** Whether family tree sync is currently in progress */
  isSyncing: boolean;
  
  /** Error message from last sync attempt, if any */
  syncError: string | null;
  
  /** Account deletion status - set when user has pending deletion */
  deletionStatus: AccountDeletionStatus | null;
  
  /** Initialize the ego (focal person) */
  initializeEgo: (name: string, birthDate?: string, gender?: Person['gender'], userId?: string) => void;
  
  /** Load a complete Person object as the ego (used when loading from database) */
  loadEgo: (person: Person) => void;
  
  /** Update ego's profile information */
  updateEgo: (updates: Partial<Pick<Person, 'name' | 'bio' | 'birthDate' | 'gender' | 'photoUrl'>>) => void;
  
  /** Get the ego person */
  getEgo: () => Person | null;
  
  /** Clear ego and reset all stores (for sign out) */
  clearEgo: () => void;
  
  /** Set account deletion status */
  setDeletionStatus: (status: AccountDeletionStatus | null) => void;
  
  /** Sync family tree from backend (loads all people and relationships) */
  syncFamilyTree: (userId: string) => Promise<void>;
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  egoId: null,
  isSyncing: false,
  syncError: null,
  deletionStatus: null,

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

    const people = usePeopleStore.getState().people;
    const newPeople = new Map(people);
    newPeople.set(id, ego);
    usePeopleStore.setState({ people: newPeople });

    set({ egoId: id });
  },

  loadEgo: (person) => {
    const people = usePeopleStore.getState().people;
    const newPeople = new Map(people);
    newPeople.set(person.id, person);
    usePeopleStore.setState({ people: newPeople });

    set({ egoId: person.id });
  },

  updateEgo: (updates) => {
    const { egoId } = get();
    if (!egoId) return;

    const people = usePeopleStore.getState().people;
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
    usePeopleStore.setState({ people: new Map(newPeople) });
  },

  getEgo: () => {
    const { egoId } = get();
    if (!egoId) return null;
    
    const people = usePeopleStore.getState().people;
    return people.get(egoId) || null;
  },

  clearEgo: () => {
    // Clear all stores
    usePeopleStore.setState({ people: new Map() });
    useUpdatesStore.setState({ updates: new Map() });
    set({ egoId: null, isSyncing: false, syncError: null, deletionStatus: null });
  },

  setDeletionStatus: (status) => set({ deletionStatus: status }),

  syncFamilyTree: async (userId) => {
    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/f336e8f0-8f7a-40aa-8f54-32371722b5de',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'session-store.ts:132',message:'syncFamilyTree entry',data:{userId,isSyncing:get().isSyncing},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B,E'})}).catch(()=>{});
    // #endregion
    // Prevent concurrent sync calls using Zustand state
    if (get().isSyncing) {
      if (__DEV__) {
        console.log('[SessionStore] syncFamilyTree: Already syncing, skipping duplicate call');
      }
      return;
    }
    
    // Set syncing state and clear any previous errors
    set({ isSyncing: true, syncError: null });
    
    try {
      // Load all people and updates from backend in parallel
      // Pass userId to getAllPeople for blocked user detection
      // Pass userId to getAllUpdates to filter blocked users
      const [peopleFromBackend, updatesFromBackend] = await Promise.all([
        getAllPeople(userId), // ← ADD currentUserId parameter
        getAllUpdates(userId),
      ]);
      
      if (__DEV__) {
        console.log('[SessionStore] syncFamilyTree: Got people from backend', { 
          count: peopleFromBackend.length,
        });
        console.log('[SessionStore] syncFamilyTree: Got updates from backend', {
          count: updatesFromBackend.length,
        });
      }
      
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/f336e8f0-8f7a-40aa-8f54-32371722b5de',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'session-store.ts:163',message:'syncFamilyTree updating stores',data:{peopleCount:peopleFromBackend.length,placeholderCount:peopleFromBackend.filter(p=>p.isPlaceholder).length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      // Update stores with data from backend
      usePeopleStore.getState().setPeople(peopleFromBackend);
      useUpdatesStore.getState().setUpdates(updatesFromBackend);
      
      if (__DEV__) {
        console.log('[SessionStore] syncFamilyTree: Updated store', { 
          peopleCount: peopleFromBackend.length,
          updatesCount: updatesFromBackend.length 
        });
      }
      
      // Set ego if user has a profile
      const ego = peopleFromBackend.find(p => p.linkedAuthUserId === userId);
      if (ego) {
        set({ egoId: ego.id });
      }
      
      if (__DEV__) {
        console.log('[SessionStore] Successfully synced family tree from backend');
      }
    } catch (error: any) {
      const errorMessage = error?.message || 'Failed to sync family tree';
      console.error('[SessionStore] Error syncing family tree:', error);
      // Store error in state for components to access
      set({ syncError: errorMessage });
    } finally {
      // Always reset syncing state, even on error
      set({ isSyncing: false });
    }
  },
}));
