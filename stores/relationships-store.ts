/**
 * Relationships Store
 * 
 * Manages relationships between people in the family tree.
 * Depends on PeopleStore to update people's relationship arrays.
 */

import { create } from 'zustand';
import type { Person } from '@/types/family-tree';
import { createRelationship } from '@/services/supabase/relationships-api';
import { usePeopleStore } from './people-store';

interface RelationshipsStore {
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

  /** Count all ancestors (recursive parent traversal) */
  countAncestors: (personId: string) => number;

  /** Count all descendants (recursive child traversal) */
  countDescendants: (personId: string) => number;
}

export const useRelationshipsStore = create<RelationshipsStore>(() => ({
  addParent: async (childId, parentId, userId) => {
    const people = usePeopleStore.getState().people;
    const child = people.get(childId);
    const parent = people.get(parentId);

    if (!child || !parent) {
      if (__DEV__) {
        console.warn(`Cannot add parent: child or parent not found. childId: ${childId}, parentId: ${parentId}`);
        console.log('[RelationshipsStore] Available person IDs:', Array.from(people.keys()));
      }
      return;
    }

    if (childId === parentId) {
      if (__DEV__) {
        console.warn(`[RelationshipsStore] Cannot add parent: person cannot be their own parent`);
      }
      return;
    }

    // Check if relationship already exists
    if (child.parentIds.includes(parentId)) {
      if (__DEV__) {
        console.warn(`[RelationshipsStore] Parent relationship already exists`);
      }
      return;
    }

    // STEP 1: Optimistic update - update store immediately for instant UI feedback
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

    const oldPeople = new Map(people);
    const newPeople = new Map(people);
    newPeople.set(childId, updatedChild);
    newPeople.set(parentId, updatedParent);
    usePeopleStore.setState({ people: new Map(newPeople) });
    
    if (__DEV__) {
      const childName = updatedChild.name;
      const parentName = updatedParent.name;
      console.log(`[RelationshipsStore] Added parent relationship: ${parentName} -> ${childName}`);
    }

    // STEP 2: If no userId provided, skip database save (fallback to local-only)
    if (!userId) {
      if (__DEV__) {
        console.warn('[RelationshipsStore] addParent called without userId - saving to local state only');
      }
      return;
    }

    try {
      // STEP 3: Save relationship to database via API
      const relationshipId = await createRelationship(userId, {
        personOneId: parentId,
        personTwoId: childId,
        relationshipType: 'parent',
      });
      
      if (__DEV__) {
        console.log('[RelationshipsStore] Relationship saved to DB', { relationshipId, parentId, childId });
      }
    } catch (error: any) {
      console.error('[RelationshipsStore] Error saving parent relationship to database:', error);
      
      // Rollback optimistic update on error
      usePeopleStore.setState({ people: oldPeople });
      
      // Throw error so components can catch and show user-friendly message
      throw new Error(`Failed to save parent relationship: ${error?.message || 'Unknown error'}`);
    }
  },

  addSpouse: async (personId1, personId2, userId) => {
    const people = usePeopleStore.getState().people;
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

    const oldPeople = new Map(people);
    const newPeople = new Map(people);
    newPeople.set(personId1, updatedPerson1);
    newPeople.set(personId2, updatedPerson2);
    usePeopleStore.setState({ people: new Map(newPeople) });
    
    if (__DEV__) {
      console.log(`[RelationshipsStore] Added spouse relationship: ${person1.name} <-> ${person2.name}`);
    }

    // STEP 2: If no userId provided, skip database save
    if (!userId) {
      console.warn('[RelationshipsStore] addSpouse called without userId - saving to local state only');
      return;
    }

    try {
      await createRelationship(userId, {
        personOneId: personId1,
        personTwoId: personId2,
        relationshipType: 'spouse',
      });
    } catch (error: any) {
      console.error('[RelationshipsStore] Error saving spouse relationship to database:', error);
      usePeopleStore.setState({ people: oldPeople });
      throw new Error(`Failed to save spouse relationship: ${error?.message || 'Unknown error'}`);
    }
  },

  addChild: async (parentId, childId, userId) => {
    const people = usePeopleStore.getState().people;
    const parent = people.get(parentId);
    const child = people.get(childId);

    if (!parent || !child) {
      console.warn(`Cannot add child: person not found`);
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

    const oldPeople = new Map(people);
    const newPeople = new Map(people);
    newPeople.set(parentId, updatedParent);
    newPeople.set(childId, updatedChild);
    usePeopleStore.setState({ people: new Map(newPeople) });
    
    if (__DEV__) {
      console.log(`[RelationshipsStore] Added child relationship: ${updatedParent.name} -> ${updatedChild.name}`);
    }

    // STEP 2: If no userId provided, skip database save
    if (!userId) {
      console.warn('[RelationshipsStore] addChild called without userId - saving to local state only');
      return;
    }

    try {
      await createRelationship(userId, {
        personOneId: parentId,
        personTwoId: childId,
        relationshipType: 'child',
      });
    } catch (error: any) {
      console.error('[RelationshipsStore] Error saving child relationship to database:', error);
      usePeopleStore.setState({ people: oldPeople });
      throw new Error(`Failed to save child relationship: ${error?.message || 'Unknown error'}`);
    }
  },

  addSibling: async (personId1, personId2, userId) => {
    const people = usePeopleStore.getState().people;
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

    const oldPeople = new Map(people);
    const newPeople = new Map(people);
    let hasChanges = false;

    // Create direct bidirectional sibling relationship
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
      // STEP 1: Optimistic update
      usePeopleStore.setState({ people: new Map(newPeople) });
      
      if (__DEV__) {
        console.log(`[RelationshipsStore] Added sibling relationship: ${person1.name} <-> ${person2.name}`);
      }

      // STEP 2: If no userId provided, skip database save
      if (!userId) {
        console.warn('[RelationshipsStore] addSibling called without userId - saving to local state only');
        return;
      }

      try {
        await createRelationship(userId, {
          personOneId: personId1,
          personTwoId: personId2,
          relationshipType: 'sibling',
        });
      } catch (error: any) {
        console.error('[RelationshipsStore] Error saving sibling relationship to database:', error);
        usePeopleStore.setState({ people: oldPeople });
        throw new Error(`Failed to save sibling relationship: ${error?.message || 'Unknown error'}`);
      }
    }
  },

  getSiblings: (personId) => {
    const people = usePeopleStore.getState().people;
    const person = people.get(personId);
    if (!person) return [];

    // Get all siblings: direct sibling relationships AND people who share at least one parent
    const siblingIds = new Set<string>();
    
    // 1. Add direct sibling relationships
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

  countAncestors: (personId) => {
    const people = usePeopleStore.getState().people;
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
    const people = usePeopleStore.getState().people;
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
}));
