/**
 * React Query hooks for managing relationships
 * 
 * Relationships are stored as arrays on Person objects (parentIds, childIds, etc.)
 * These hooks update the people cache when relationships are added.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/auth-context';
import { createRelationship } from '@/services/supabase/relationships-api';
import type { Person } from '@/types/family-tree';

/**
 * Helper: Resolve temp ID to real ID
 * 
 * During React Query migration, mutations return real IDs immediately,
 * so temp IDs should not be used. This function is kept for backward compatibility
 * and simply returns the ID as-is (React Query mutations use real IDs).
 */
function resolveTempId(id: string): string {
  // React Query mutations return real IDs, so we can return the ID as-is
  // If needed in the future, we could add queryClient lookup here
  return id;
}

/**
 * Mutation hook - adds a parent relationship
 */
export function useAddParent() {
  const queryClient = useQueryClient();
  const { session } = useAuth();

  return useMutation({
    mutationFn: async ({
      childId,
      parentId,
    }: {
      childId: string;
      parentId: string;
    }) => {
      const userId = session?.user?.id;
      if (!userId) throw new Error('User must be signed in');

      const realChildId = resolveTempId(childId);
      const realParentId = resolveTempId(parentId);

      return await createRelationship(userId, {
        personOneId: realParentId,
        personTwoId: realChildId,
        relationshipType: 'parent',
      });
    },

    // Optimistic update - update people cache
    onMutate: async ({ childId, parentId }) => {
      const userId = session?.user?.id;
      if (!userId) return;

      await queryClient.cancelQueries({ queryKey: ['people', userId] });

      const previousPeople = queryClient.getQueryData<Person[]>(['people', userId]);

      const realChildId = resolveTempId(childId);
      const realParentId = resolveTempId(parentId);

      // Update both child and parent in cache
      queryClient.setQueryData<Person[]>(['people', userId], (old = []) =>
        old.map((person) => {
          if (person.id === realChildId) {
            if (person.parentIds.includes(realParentId)) return person; // Already exists
            return {
              ...person,
              parentIds: [...person.parentIds, realParentId],
              updatedAt: Date.now(),
              version: person.version + 1,
            };
          }
          if (person.id === realParentId) {
            if (person.childIds.includes(realChildId)) return person; // Already exists
            return {
              ...person,
              childIds: [...person.childIds, realChildId],
              updatedAt: Date.now(),
              version: person.version + 1,
            };
          }
          return person;
        })
      );

      return { previousPeople };
    },

    onSuccess: () => {
      const userId = session?.user?.id;
      if (!userId) return;
      // Invalidate to refetch fresh data with relationships
      queryClient.invalidateQueries({ queryKey: ['people', userId] });
    },

    onError: (error, variables, context) => {
      const userId = session?.user?.id;
      if (!userId || !context) return;

      if (context.previousPeople) {
        queryClient.setQueryData(['people', userId], context.previousPeople);
      }
    },
  });
}

/**
 * Mutation hook - adds a spouse relationship
 */
export function useAddSpouse() {
  const queryClient = useQueryClient();
  const { session } = useAuth();

  return useMutation({
    mutationFn: async ({ personId1, personId2 }: { personId1: string; personId2: string }) => {
      const userId = session?.user?.id;
      if (!userId) throw new Error('User must be signed in');

      const realPersonId1 = resolveTempId(personId1);
      const realPersonId2 = resolveTempId(personId2);

      return await createRelationship(userId, {
        personOneId: realPersonId1,
        personTwoId: realPersonId2,
        relationshipType: 'spouse',
      });
    },

    onMutate: async ({ personId1, personId2 }) => {
      const userId = session?.user?.id;
      if (!userId) return;

      await queryClient.cancelQueries({ queryKey: ['people', userId] });

      const previousPeople = queryClient.getQueryData<Person[]>(['people', userId]);

      const realPersonId1 = resolveTempId(personId1);
      const realPersonId2 = resolveTempId(personId2);

      queryClient.setQueryData<Person[]>(['people', userId], (old = []) =>
        old.map((person) => {
          if (person.id === realPersonId1) {
            if (person.spouseIds.includes(realPersonId2)) return person;
            return {
              ...person,
              spouseIds: [...person.spouseIds, realPersonId2],
              updatedAt: Date.now(),
              version: person.version + 1,
            };
          }
          if (person.id === realPersonId2) {
            if (person.spouseIds.includes(realPersonId1)) return person;
            return {
              ...person,
              spouseIds: [...person.spouseIds, realPersonId1],
              updatedAt: Date.now(),
              version: person.version + 1,
            };
          }
          return person;
        })
      );

      return { previousPeople };
    },

    onSuccess: () => {
      const userId = session?.user?.id;
      if (!userId) return;
      queryClient.invalidateQueries({ queryKey: ['people', userId] });
    },

    onError: (error, variables, context) => {
      const userId = session?.user?.id;
      if (!userId || !context) return;

      if (context.previousPeople) {
        queryClient.setQueryData(['people', userId], context.previousPeople);
      }
    },
  });
}

/**
 * Mutation hook - adds a child relationship
 */
export function useAddChild() {
  const queryClient = useQueryClient();
  const { session } = useAuth();

  return useMutation({
    mutationFn: async ({ parentId, childId }: { parentId: string; childId: string }) => {
      const userId = session?.user?.id;
      if (!userId) throw new Error('User must be signed in');

      const realParentId = resolveTempId(parentId);
      const realChildId = resolveTempId(childId);

      return await createRelationship(userId, {
        personOneId: realParentId,
        personTwoId: realChildId,
        relationshipType: 'child',
      });
    },

    onMutate: async ({ parentId, childId }) => {
      const userId = session?.user?.id;
      if (!userId) return;

      await queryClient.cancelQueries({ queryKey: ['people', userId] });

      const previousPeople = queryClient.getQueryData<Person[]>(['people', userId]);

      const realParentId = resolveTempId(parentId);
      const realChildId = resolveTempId(childId);

      queryClient.setQueryData<Person[]>(['people', userId], (old = []) =>
        old.map((person) => {
          if (person.id === realParentId) {
            if (person.childIds.includes(realChildId)) return person;
            return {
              ...person,
              childIds: [...person.childIds, realChildId],
              updatedAt: Date.now(),
              version: person.version + 1,
            };
          }
          if (person.id === realChildId) {
            if (person.parentIds.includes(realParentId)) return person;
            return {
              ...person,
              parentIds: [...person.parentIds, realParentId],
              updatedAt: Date.now(),
              version: person.version + 1,
            };
          }
          return person;
        })
      );

      return { previousPeople };
    },

    onSuccess: () => {
      const userId = session?.user?.id;
      if (!userId) return;
      queryClient.invalidateQueries({ queryKey: ['people', userId] });
    },

    onError: (error, variables, context) => {
      const userId = session?.user?.id;
      if (!userId || !context) return;

      if (context.previousPeople) {
        queryClient.setQueryData(['people', userId], context.previousPeople);
      }
    },
  });
}

/**
 * Mutation hook - adds a sibling relationship (with transitive logic)
 * 
 * This implements the transitive sibling logic: if A is sibling to B, and B is sibling to C,
 * then A and C are siblings. All people in the sibling group are updated.
 */
export function useAddSibling() {
  const queryClient = useQueryClient();
  const { session } = useAuth();

  return useMutation({
    mutationFn: async ({ personId1, personId2 }: { personId1: string; personId2: string }) => {
      const userId = session?.user?.id;
      if (!userId) throw new Error('User must be signed in');

      const realPersonId1 = resolveTempId(personId1);
      const realPersonId2 = resolveTempId(personId2);

      return await createRelationship(userId, {
        personOneId: realPersonId1,
        personTwoId: realPersonId2,
        relationshipType: 'sibling',
      });
    },

    onMutate: async ({ personId1, personId2 }) => {
      const userId = session?.user?.id;
      if (!userId) return;

      await queryClient.cancelQueries({ queryKey: ['people', userId] });

      const previousPeople = queryClient.getQueryData<Person[]>(['people', userId]);

      const realPersonId1 = resolveTempId(personId1);
      const realPersonId2 = resolveTempId(personId2);

      const currentPeople = previousPeople || [];
      const peopleMap = new Map(currentPeople.map(p => [p.id, p]));

      const person1 = peopleMap.get(realPersonId1);
      const person2 = peopleMap.get(realPersonId2);

      if (!person1 || !person2) {
        return { previousPeople };
      }

      // Collect ALL people who should be siblings (sibling group)
      const siblingGroup = new Set<string>();
      siblingGroup.add(realPersonId1);
      siblingGroup.add(realPersonId2);
      person1.siblingIds.forEach(id => siblingGroup.add(id));
      person2.siblingIds.forEach(id => siblingGroup.add(id));

      // Add siblings through shared parents
      for (const parentId of person1.parentIds) {
        const parent = peopleMap.get(parentId);
        if (parent) {
          parent.childIds.forEach(childId => {
            if (childId !== realPersonId1) {
              siblingGroup.add(childId);
            }
          });
        }
      }
      for (const parentId of person2.parentIds) {
        const parent = peopleMap.get(parentId);
        if (parent) {
          parent.childIds.forEach(childId => {
            if (childId !== realPersonId2) {
              siblingGroup.add(childId);
            }
          });
        }
      }

      // Update EVERY person in the sibling group
      const siblingGroupArray = Array.from(siblingGroup);
      const updatedPeople = currentPeople.map((person) => {
        if (siblingGroup.has(person.id)) {
          const allSiblings = siblingGroupArray.filter(id => id !== person.id);
          return {
            ...person,
            siblingIds: allSiblings,
            updatedAt: Date.now(),
            version: person.version + 1,
          };
        }
        return person;
      });

      // Also update parent-child relationships if needed
      const finalPeople = updatedPeople.map((person) => {
        // Update person2's parents if person1 has parents
        if (person.id === realPersonId2) {
          let updated = person;
          for (const parentId of person1.parentIds) {
            if (!updated.parentIds.includes(parentId)) {
              updated = {
                ...updated,
                parentIds: [...updated.parentIds, parentId],
                updatedAt: Date.now(),
                version: updated.version + 1,
              };
            }
          }
          return updated;
        }
        // Update person1's parents if person2 has parents
        if (person.id === realPersonId1) {
          let updated = person;
          for (const parentId of person2.parentIds) {
            if (!updated.parentIds.includes(parentId)) {
              updated = {
                ...updated,
                parentIds: [...updated.parentIds, parentId],
                updatedAt: Date.now(),
                version: updated.version + 1,
              };
            }
          }
          return updated;
        }
        // Update parents' childIds
        if (person1.parentIds.includes(person.id) && !person.childIds.includes(realPersonId2)) {
          return {
            ...person,
            childIds: [...person.childIds, realPersonId2],
            updatedAt: Date.now(),
            version: person.version + 1,
          };
        }
        if (person2.parentIds.includes(person.id) && !person.childIds.includes(realPersonId1)) {
          return {
            ...person,
            childIds: [...person.childIds, realPersonId1],
            updatedAt: Date.now(),
            version: person.version + 1,
          };
        }
        return person;
      });

      queryClient.setQueryData<Person[]>(['people', userId], finalPeople);

      return { previousPeople };
    },

    onSuccess: () => {
      const userId = session?.user?.id;
      if (!userId) return;
      queryClient.invalidateQueries({ queryKey: ['people', userId] });
    },

    onError: (error, variables, context) => {
      const userId = session?.user?.id;
      if (!userId || !context) return;

      if (context.previousPeople) {
        queryClient.setQueryData(['people', userId], context.previousPeople);
      }
    },
  });
}

/**
 * Get siblings of a person from people data (transitive - includes siblings of siblings)
 * 
 * Utility function for getting siblings - works with React Query people data.
 * Calculates transitive siblings: if A is sibling to B, and B is sibling to C, then A and C are siblings.
 */
export function getSiblings(personId: string, people: Person[]): Person[] {
  const peopleMap = new Map(people.map(p => [p.id, p]));
  const person = peopleMap.get(personId);
  if (!person) return [];

  // Collect ALL people in the sibling group (transitive closure)
  const siblingGroup = new Set<string>();
  const visited = new Set<string>();
  const queue: string[] = [personId];
  
  // BFS to find all transitive siblings
  while (queue.length > 0) {
    const currentId = queue.shift()!;
    if (visited.has(currentId)) continue;
    visited.add(currentId);
    
    const currentPerson = peopleMap.get(currentId);
    if (!currentPerson) continue;
    
    // Add current person to sibling group (if not the original person)
    if (currentId !== personId) {
      siblingGroup.add(currentId);
    }
    
    // Add direct siblings
    currentPerson.siblingIds.forEach(siblingId => {
      if (siblingId !== personId && !visited.has(siblingId)) {
        queue.push(siblingId);
      }
    });
    
    // Add siblings through shared parents
    for (const parentId of currentPerson.parentIds) {
      const parent = peopleMap.get(parentId);
      if (parent) {
        parent.childIds.forEach(childId => {
          if (childId !== personId && !visited.has(childId)) {
            queue.push(childId);
          }
        });
      }
    }
  }

  return Array.from(siblingGroup)
    .map(id => peopleMap.get(id))
    .filter((p): p is Person => p !== undefined);
}

/**
 * Count all ancestors of a person (recursive)
 */
export function countAncestors(personId: string, people: Person[]): number {
  const peopleMap = new Map(people.map(p => [p.id, p]));
  const visited = new Set<string>();
  const queue: string[] = [personId];
  let count = 0;

  // BFS to count all ancestors
  while (queue.length > 0) {
    const currentId = queue.shift()!;
    if (visited.has(currentId)) continue;
    visited.add(currentId);

    const person = peopleMap.get(currentId);
    if (person && person.id !== personId) {
      count++;
    }

    if (person) {
      person.parentIds.forEach(parentId => {
        if (!visited.has(parentId)) {
          queue.push(parentId);
        }
      });
    }
  }

  return count;
}

/**
 * Count all descendants of a person (recursive)
 */
export function countDescendants(personId: string, people: Person[]): number {
  const peopleMap = new Map(people.map(p => [p.id, p]));
  const visited = new Set<string>();
  const queue: string[] = [personId];
  let count = 0;

  // BFS to count all descendants
  while (queue.length > 0) {
    const currentId = queue.shift()!;
    if (visited.has(currentId)) continue;
    visited.add(currentId);

    const person = peopleMap.get(currentId);
    if (person && person.id !== personId) {
      count++;
    }

    if (person) {
      person.childIds.forEach(childId => {
        if (!visited.has(childId)) {
          queue.push(childId);
        }
      });
    }
  }

  return count;
}