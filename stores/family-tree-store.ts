import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { Person, Update } from '@/types/family-tree';
import { createUpdate } from '@/services/supabase/updates-api';

/**
 * Minimal Family Tree Store
 * 
 * Just enough to hold one person (ego) for display.
 * Will expand later as features are added incrementally.
 */
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
  
  /** Delete an update */
  deleteUpdate: (updateId: string) => void;

  /** Toggle visibility of a tagged update on a person's profile */
  toggleTaggedUpdateVisibility: (personId: string, updateId: string) => void;

  /** Create a new person and add to store */
  addPerson: (data: {
    name: string;
    photoUrl?: string;
    birthDate?: string;
    gender?: Person['gender'];
    phoneNumber?: string;
  }) => string;

  /** Add a parent relationship (bidirectional) */
  addParent: (childId: string, parentId: string) => void;

  /** Add a spouse relationship (bidirectional) */
  addSpouse: (personId1: string, personId2: string) => void;

  /** Add a child relationship (bidirectional) */
  addChild: (parentId: string, childId: string) => void;

  /** Add a sibling relationship (people who share at least one parent) */
  addSibling: (personId1: string, personId2: string) => void;

  /** Get siblings of a person (people who share at least one parent) */
  getSiblings: (personId: string) => Person[];
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
    const allUpdates = Array.from(updates.values());
    
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

  deleteUpdate: (updateId) => {
    const { updates } = get();
    if (!updates.has(updateId)) {
      console.warn(`Update ${updateId} not found for deletion`);
      return;
    }
    
    // Create new Map without the deleted update
    const newUpdates = new Map(updates);
    newUpdates.delete(updateId);
    
    // Force Zustand to recognize the change by creating a completely new Map
    set({ updates: new Map(newUpdates) });
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

  addPerson: (data) => {
    const id = uuidv4();
    const now = Date.now();

    const person: Person = {
      id,
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
    };

    const newPeople = new Map(get().people);
    newPeople.set(id, person);

    set({ people: newPeople });
    return id;
  },

  addParent: (childId, parentId) => {
    const { people } = get();
    const child = people.get(childId);
    const parent = people.get(parentId);

    if (!child || !parent) {
      console.warn(`Cannot add parent: child or parent not found`);
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

    // Update child: add parent to parentIds
    const updatedChild: Person = {
      ...child,
      parentIds: [...child.parentIds, parentId],
      updatedAt: Date.now(),
      version: child.version + 1,
    };

    // Update parent: add child to childIds
    const updatedParent: Person = {
      ...parent,
      childIds: [...parent.childIds, childId],
      updatedAt: Date.now(),
      version: parent.version + 1,
    };

    const newPeople = new Map(people);
    newPeople.set(childId, updatedChild);
    newPeople.set(parentId, updatedParent);

    // Force a new Map reference to ensure Zustand detects the change
    set({ people: new Map(newPeople) });
    
    if (__DEV__) {
      const childName = updatedChild.name;
      const parentName = updatedParent.name;
      console.log(`[Store] Added parent relationship: ${parentName} -> ${childName}`);
    }
  },

  addSpouse: (personId1, personId2) => {
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

    // Update person1: add person2 to spouseIds
    const updatedPerson1: Person = {
      ...person1,
      spouseIds: [...person1.spouseIds, personId2],
      updatedAt: Date.now(),
      version: person1.version + 1,
    };

    // Update person2: add person1 to spouseIds
    const updatedPerson2: Person = {
      ...person2,
      spouseIds: [...person2.spouseIds, personId1],
      updatedAt: Date.now(),
      version: person2.version + 1,
    };

    const newPeople = new Map(people);
    newPeople.set(personId1, updatedPerson1);
    newPeople.set(personId2, updatedPerson2);

    // Force a new Map reference to ensure Zustand detects the change
    set({ people: new Map(newPeople) });
    
    if (__DEV__) {
      console.log(`[Store] Added spouse relationship: ${updatedPerson1.name} <-> ${updatedPerson2.name}`);
    }
  },

  addChild: (parentId, childId) => {
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

    // Update parent: add child to childIds
    const updatedParent: Person = {
      ...parent,
      childIds: [...parent.childIds, childId],
      updatedAt: Date.now(),
      version: parent.version + 1,
    };

    // Update child: add parent to parentIds
    const updatedChild: Person = {
      ...child,
      parentIds: [...child.parentIds, parentId],
      updatedAt: Date.now(),
      version: child.version + 1,
    };

    const newPeople = new Map(people);
    newPeople.set(parentId, updatedParent);
    newPeople.set(childId, updatedChild);

    // Force a new Map reference to ensure Zustand detects the change
    set({ people: new Map(newPeople) });
    
    if (__DEV__) {
      console.log(`[Store] Added child relationship: ${updatedParent.name} -> ${updatedChild.name}`);
    }
  },

  addSibling: (personId1, personId2) => {
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

    const newPeople = new Map(people);
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
      // Force a new Map reference to ensure Zustand detects the change
      set({ people: new Map(newPeople) });
      
      if (__DEV__) {
        console.log(`[Store] Added sibling relationship: ${person1.name} <-> ${person2.name}`);
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
}));

