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
    // Resolve temp IDs to real IDs before creating relationship
    const resolveTempId = usePeopleStore.getState().resolveTempId;
    const realChildId = resolveTempId(childId);
    const realParentId = resolveTempId(parentId);
    
    const people = usePeopleStore.getState().people;
    const child = people.get(realChildId);
    const parent = people.get(realParentId);

    if (!child || !parent) {
      if (__DEV__) {
        console.warn(`Cannot add parent: child or parent not found. childId: ${childId}, parentId: ${parentId}`);
        console.log('[RelationshipsStore] Available person IDs:', Array.from(people.keys()));
      }
      return;
    }

    if (realChildId === realParentId) {
      if (__DEV__) {
        console.warn(`[RelationshipsStore] Cannot add parent: person cannot be their own parent`);
      }
      return;
    }

    // Check if relationship already exists (use real IDs)
    if (child.parentIds.includes(realParentId)) {
      if (__DEV__) {
        console.warn(`[RelationshipsStore] Parent relationship already exists`);
      }
      return;
    }

    // STEP 1: Optimistic update - update store immediately for instant UI feedback
    // Use real IDs for the relationship arrays
    const updatedChild: Person = {
      ...child,
      parentIds: [...child.parentIds, realParentId],
      updatedAt: Date.now(),
      version: child.version + 1,
    };

    const updatedParent: Person = {
      ...parent,
      childIds: [...parent.childIds, realChildId],
      updatedAt: Date.now(),
      version: parent.version + 1,
    };

    const oldPeople = new Map(people);
    const newPeople = new Map(people);
    newPeople.set(realChildId, updatedChild);
    newPeople.set(realParentId, updatedParent);
    usePeopleStore.setState({ people: new Map(newPeople) });
    
    if (__DEV__) {
      const childName = updatedChild.name;
      const parentName = updatedParent.name;
      console.log(`[RelationshipsStore] Added parent relationship: ${parentName} -> ${childName}`);
      if (childId !== realChildId || parentId !== realParentId) {
        console.log(`[RelationshipsStore] Resolved temp IDs: childId ${childId} -> ${realChildId}, parentId ${parentId} -> ${realParentId}`);
      }
    }

    // STEP 2: If no userId provided, skip database save (fallback to local-only)
    if (!userId) {
      if (__DEV__) {
        console.warn('[RelationshipsStore] addParent called without userId - saving to local state only');
      }
      return;
    }

    try {
      // STEP 3: Save relationship to database via API (use real IDs)
      const relationshipId = await createRelationship(userId, {
        personOneId: realParentId,
        personTwoId: realChildId,
        relationshipType: 'parent',
      });
      
      if (__DEV__) {
        console.log('[RelationshipsStore] Relationship saved to DB', { relationshipId, parentId: realParentId, childId: realChildId });
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
    // Resolve temp IDs to real IDs before creating relationship
    const resolveTempId = usePeopleStore.getState().resolveTempId;
    const realPersonId1 = resolveTempId(personId1);
    const realPersonId2 = resolveTempId(personId2);
    
    const people = usePeopleStore.getState().people;
    const person1 = people.get(realPersonId1);
    const person2 = people.get(realPersonId2);

    if (!person1 || !person2) {
      console.warn(`Cannot add spouse: person not found`);
      return;
    }

    if (realPersonId1 === realPersonId2) {
      console.warn(`Cannot add spouse: person cannot be their own spouse`);
      return;
    }

    // Check if relationship already exists (use real IDs)
    if (person1.spouseIds.includes(realPersonId2)) {
      console.warn(`Spouse relationship already exists`);
      return;
    }

    // STEP 1: Optimistic update (use real IDs)
    const updatedPerson1: Person = {
      ...person1,
      spouseIds: [...person1.spouseIds, realPersonId2],
      updatedAt: Date.now(),
      version: person1.version + 1,
    };

    const updatedPerson2: Person = {
      ...person2,
      spouseIds: [...person2.spouseIds, realPersonId1],
      updatedAt: Date.now(),
      version: person2.version + 1,
    };

    const oldPeople = new Map(people);
    const newPeople = new Map(people);
    newPeople.set(realPersonId1, updatedPerson1);
    newPeople.set(realPersonId2, updatedPerson2);
    usePeopleStore.setState({ people: new Map(newPeople) });
    
    if (__DEV__) {
      console.log(`[RelationshipsStore] Added spouse relationship: ${person1.name} <-> ${person2.name}`);
      if (personId1 !== realPersonId1 || personId2 !== realPersonId2) {
        console.log(`[RelationshipsStore] Resolved temp IDs: personId1 ${personId1} -> ${realPersonId1}, personId2 ${personId2} -> ${realPersonId2}`);
      }
    }

    // STEP 2: If no userId provided, skip database save
    if (!userId) {
      console.warn('[RelationshipsStore] addSpouse called without userId - saving to local state only');
      return;
    }

    try {
      await createRelationship(userId, {
        personOneId: realPersonId1,
        personTwoId: realPersonId2,
        relationshipType: 'spouse',
      });
    } catch (error: any) {
      console.error('[RelationshipsStore] Error saving spouse relationship to database:', error);
      usePeopleStore.setState({ people: oldPeople });
      throw new Error(`Failed to save spouse relationship: ${error?.message || 'Unknown error'}`);
    }
  },

  addChild: async (parentId, childId, userId) => {
    // Resolve temp IDs to real IDs before creating relationship
    const resolveTempId = usePeopleStore.getState().resolveTempId;
    const realParentId = resolveTempId(parentId);
    const realChildId = resolveTempId(childId);
    
    const people = usePeopleStore.getState().people;
    const parent = people.get(realParentId);
    const child = people.get(realChildId);

    if (!parent || !child) {
      console.warn(`Cannot add child: person not found`);
      return;
    }

    if (realParentId === realChildId) {
      console.warn(`Cannot add child: person cannot be their own child`);
      return;
    }

    // Check if relationship already exists (use real IDs)
    if (parent.childIds.includes(realChildId)) {
      console.warn(`Child relationship already exists`);
      return;
    }

    // STEP 1: Optimistic update (use real IDs)
    const updatedParent: Person = {
      ...parent,
      childIds: [...parent.childIds, realChildId],
      updatedAt: Date.now(),
      version: parent.version + 1,
    };

    const updatedChild: Person = {
      ...child,
      parentIds: [...child.parentIds, realParentId],
      updatedAt: Date.now(),
      version: child.version + 1,
    };

    const oldPeople = new Map(people);
    const newPeople = new Map(people);
    newPeople.set(realParentId, updatedParent);
    newPeople.set(realChildId, updatedChild);
    usePeopleStore.setState({ people: new Map(newPeople) });
    
    if (__DEV__) {
      console.log(`[RelationshipsStore] Added child relationship: ${updatedParent.name} -> ${updatedChild.name}`);
      if (parentId !== realParentId || childId !== realChildId) {
        console.log(`[RelationshipsStore] Resolved temp IDs: parentId ${parentId} -> ${realParentId}, childId ${childId} -> ${realChildId}`);
      }
    }

    // STEP 2: If no userId provided, skip database save
    if (!userId) {
      console.warn('[RelationshipsStore] addChild called without userId - saving to local state only');
      return;
    }

    try {
      await createRelationship(userId, {
        personOneId: realParentId,
        personTwoId: realChildId,
        relationshipType: 'child',
      });
    } catch (error: any) {
      console.error('[RelationshipsStore] Error saving child relationship to database:', error);
      usePeopleStore.setState({ people: oldPeople });
      throw new Error(`Failed to save child relationship: ${error?.message || 'Unknown error'}`);
    }
  },

  addSibling: async (personId1, personId2, userId) => {
    // Resolve temp IDs to real IDs before creating relationship
    const resolveTempId = usePeopleStore.getState().resolveTempId;
    const realPersonId1 = resolveTempId(personId1);
    const realPersonId2 = resolveTempId(personId2);
    
    const people = usePeopleStore.getState().people;
    const person1 = people.get(realPersonId1);
    const person2 = people.get(realPersonId2);

    if (!person1 || !person2) {
      console.warn(`Cannot add sibling: person not found`);
      return;
    }

    if (realPersonId1 === realPersonId2) {
      console.warn(`Cannot add sibling: person cannot be their own sibling`);
      return;
    }

    // Check if relationship already exists (use real IDs)
    if (person1.siblingIds.includes(realPersonId2)) {
      console.warn(`Sibling relationship already exists`);
      return;
    }

    const oldPeople = new Map(people);
    const newPeople = new Map(people);
    let hasChanges = false;

    // Create direct bidirectional sibling relationship (use real IDs)
    const updatedPerson1: Person = {
      ...person1,
      siblingIds: [...person1.siblingIds, realPersonId2],
      updatedAt: Date.now(),
      version: person1.version + 1,
    };

    const updatedPerson2: Person = {
      ...person2,
      siblingIds: [...person2.siblingIds, realPersonId1],
      updatedAt: Date.now(),
      version: person2.version + 1,
    };

    newPeople.set(realPersonId1, updatedPerson1);
    newPeople.set(realPersonId2, updatedPerson2);
    hasChanges = true;

    // Also link through shared parents if they exist (for consistency)
    // Note: parentIds are already real IDs, so no need to resolve
    for (const parentId of person1.parentIds) {
      const parent = newPeople.get(parentId);
      if (parent && !parent.childIds.includes(realPersonId2)) {
        const updatedParent: Person = {
          ...parent,
          childIds: [...parent.childIds, realPersonId2],
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
          newPeople.set(realPersonId2, updatedPerson2WithParent);
        }
      }
    }

    for (const parentId of person2.parentIds) {
      const parent = newPeople.get(parentId);
      if (parent && !parent.childIds.includes(realPersonId1)) {
        const updatedParent: Person = {
          ...parent,
          childIds: [...parent.childIds, realPersonId1],
          updatedAt: Date.now(),
          version: parent.version + 1,
        };
        newPeople.set(parentId, updatedParent);

        const currentPerson1 = newPeople.get(realPersonId1)!;
        if (!currentPerson1.parentIds.includes(parentId)) {
          const updatedPerson1WithParent: Person = {
            ...currentPerson1,
            parentIds: [...currentPerson1.parentIds, parentId],
            updatedAt: Date.now(),
            version: currentPerson1.version + 1,
          };
          newPeople.set(realPersonId1, updatedPerson1WithParent);
        }
      }
    }

    if (hasChanges) {
      // STEP 1: Optimistic update
      usePeopleStore.setState({ people: new Map(newPeople) });
      
      if (__DEV__) {
        console.log(`[RelationshipsStore] Added sibling relationship: ${person1.name} <-> ${person2.name}`);
        if (personId1 !== realPersonId1 || personId2 !== realPersonId2) {
          console.log(`[RelationshipsStore] Resolved temp IDs: personId1 ${personId1} -> ${realPersonId1}, personId2 ${personId2} -> ${realPersonId2}`);
        }
      }

      // STEP 2: If no userId provided, skip database save
      if (!userId) {
        console.warn('[RelationshipsStore] addSibling called without userId - saving to local state only');
        return;
      }

      try {
        await createRelationship(userId, {
          personOneId: realPersonId1,
          personTwoId: realPersonId2,
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
