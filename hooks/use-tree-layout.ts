/**
 * useTreeLayout Hook
 * 
 * Extracts tree layout calculation logic from the HomeScreen component.
 * 
 * **What are Hooks?**
 * Hooks are reusable functions that encapsulate stateful logic and side effects.
 * They allow us to:
 * - Separate business logic from UI components
 * - Reuse the same logic across multiple components
 * - Test logic independently from UI
 * - Make components cleaner and easier to read
 * 
 * **Before:** All tree calculation logic was mixed into the HomeScreen component (700+ lines)
 * **After:** Logic is extracted here, HomeScreen just calls the hook and renders UI
 */

import { useMemo } from 'react';
import { usePeopleStore } from '@/stores/people-store';
import { useRelationshipsStore } from '@/stores/relationships-store';
import type { Person } from '@/types/family-tree';

export interface TreeLayout {
  /** All ancestor generations (oldest first) */
  ancestorGenerations: Person[][];
  /** All descendant generations (youngest first) */
  descendantGenerations: Person[][];
  /** Ego's immediate spouses */
  spouses: Person[];
  /** Ego's immediate siblings */
  siblings: Person[];
  /** The ego person */
  ego: Person | null;
}

/**
 * Custom hook that calculates tree layout for the ego-centric family tree.
 * 
 * This hook handles:
 * - Recursively traversing ancestors (parents, grandparents, etc.)
 * - Recursively traversing descendants (children, grandchildren, etc.)
 * - Including siblings in each generation
 * - Memoizing results to prevent unnecessary recalculations
 * 
 * @param egoId - The ID of the ego (focal person)
 * @returns TreeLayout object with all calculated relationships
 */
export function useTreeLayout(egoId: string | null): TreeLayout {
  // Only subscribe to peopleSize, not the people Map itself (prevents constant re-renders)
  // The people Map reference changes on every update, but size only changes when people are added/removed
  const peopleSize = usePeopleStore((state) => state.people.size);
  
  // CRITICAL FIX: Track relationship changes AND placeholder changes
  // When relationships are added, peopleSize doesn't change, but relationship arrays do
  // When isPlaceholder changes (block/unblock), peopleSize doesn't change either
  // We need to recalculate when relationships OR placeholder flags change
  // Use a stable hash that detects both relationship and placeholder changes
  const relationshipsHash = usePeopleStore((state) => {
    // Create a stable hash string of all relationship IDs AND placeholder flags
    // Sorting ensures stable hash even if order changes
    const allRelationshipIds: string[] = [];
    for (const person of state.people.values()) {
      // Include counts and IDs for each relationship type
      allRelationshipIds.push(`${person.id}:parents:${person.parentIds.length}:${person.parentIds.sort().join(',')}`);
      allRelationshipIds.push(`${person.id}:children:${person.childIds.length}:${person.childIds.sort().join(',')}`);
      allRelationshipIds.push(`${person.id}:spouses:${person.spouseIds.length}:${person.spouseIds.sort().join(',')}`);
      allRelationshipIds.push(`${person.id}:siblings:${person.siblingIds.length}:${person.siblingIds.sort().join(',')}`);
      // CRITICAL: Include isPlaceholder flag so tree recalculates when blocking/unblocking
      allRelationshipIds.push(`${person.id}:placeholder:${person.isPlaceholder ? 'true' : 'false'}`);
    }
    // Sort to ensure stable hash
    const hashString = allRelationshipIds.sort().join('|');
    // Simple hash from string
    let hash = 0;
    for (let i = 0; i < hashString.length; i++) {
      const char = hashString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash;
  });

  // Get ego person - recalculate when egoId, peopleSize, or relationships change
  // Access people from store state inside memo (getState() doesn't cause re-renders)
  const ego = useMemo(() => {
    if (!egoId) return null;
    const people = usePeopleStore.getState().people;
    const egoPerson = people.get(egoId) || null;
    return egoPerson;
  }, [egoId, peopleSize, relationshipsHash]);

  // Recursively get all ancestor generations (parents, grandparents, etc.)
  // Includes siblings of each person in each generation
  const ancestorGenerations = useMemo(() => {
    if (!ego) {
      return [];
    }
    
    const generations: Person[][] = [];
    const visited = new Set<string>();
    
    // Helper function to expand a generation to include all siblings
    const expandGenerationWithSiblings = (baseGeneration: Person[]): Person[] => {
      const expanded = new Map<string, Person>();
      
      // Add all base people
      for (const person of baseGeneration) {
        expanded.set(person.id, person);
        visited.add(person.id);
      }
      
      // For each person, add their siblings
      for (const person of baseGeneration) {
        const siblings = getSiblings(person.id);
        for (const sibling of siblings) {
          if (!visited.has(sibling.id) && !expanded.has(sibling.id)) {
            expanded.set(sibling.id, sibling);
            visited.add(sibling.id);
          }
        }
      }
      
      return Array.from(expanded.values());
    };
    
    // Get store methods inside memo (getState() doesn't cause re-renders)
    const getPerson = usePeopleStore.getState().getPerson;
    const getSiblings = useRelationshipsStore.getState().getSiblings;
      
      // Start with ego's parents (generation 0) and expand with siblings
      let currentGeneration = expandGenerationWithSiblings(
        ego.parentIds
          .map((id) => getPerson(id))
          .filter((p): p is NonNullable<typeof p> => p !== undefined)
      );
    
    // Keep going up generations until no more parents
    while (currentGeneration.length > 0) {
      // Add current generation (with siblings)
      generations.push(currentGeneration);
      
      // Get next generation (parents of current generation, including siblings)
      const nextGenerationBase: Person[] = [];
      const nextGenIds = new Set<string>();
      
      for (const person of currentGeneration) {
        for (const parentId of person.parentIds) {
          if (!visited.has(parentId) && !nextGenIds.has(parentId)) {
            const parent = getPerson(parentId);
            if (parent) {
              nextGenerationBase.push(parent);
              nextGenIds.add(parentId);
            }
          }
        }
      }
      
      // Expand next generation with siblings
      currentGeneration = expandGenerationWithSiblings(nextGenerationBase);
    }
    
    const result = generations.reverse(); // Reverse so oldest generation is first
    
    // Debug logs removed to reduce noise - uncomment if needed for debugging
    // if (__DEV__) {
    //   console.log(`[Tree] getAllAncestorGenerations: Calculated ${result.length} generations`);
    // }
    
    return result;
    // Recalculate when ego, peopleSize, or relationships change
    // relationshipsHash ensures we recalculate when relationships are added/removed
  }, [egoId, peopleSize, relationshipsHash, ego?.id]);

  // Recursively get all descendant generations (children, grandchildren, etc.)
  // Includes siblings of each person in each generation
  const descendantGenerations = useMemo(() => {
    if (!ego) return [];
    
    // Get store methods inside memo (getState() doesn't cause re-renders)
    const getPerson = usePeopleStore.getState().getPerson;
    const getSiblings = useRelationshipsStore.getState().getSiblings;
    
    const generations: Person[][] = [];
    const visited = new Set<string>();
    
    // Helper function to expand a generation to include all siblings
    const expandGenerationWithSiblings = (baseGeneration: Person[]): Person[] => {
      const expanded = new Map<string, Person>();
      
      // Add all base people
      for (const person of baseGeneration) {
        expanded.set(person.id, person);
        visited.add(person.id);
      }
      
      // For each person, add their siblings
      for (const person of baseGeneration) {
        const siblings = getSiblings(person.id);
        for (const sibling of siblings) {
          if (!visited.has(sibling.id) && !expanded.has(sibling.id)) {
            expanded.set(sibling.id, sibling);
            visited.add(sibling.id);
          }
        }
      }
      
      return Array.from(expanded.values());
    };
    
      // Start with ego's children (generation 0) and expand with siblings
      let currentGeneration = expandGenerationWithSiblings(
        ego.childIds
          .map((id) => getPerson(id))
          .filter((p): p is NonNullable<typeof p> => p !== undefined)
      );
    
    // Keep going down generations until no more children
    while (currentGeneration.length > 0) {
      // Add current generation (with siblings)
      generations.push(currentGeneration);
      
      // Get next generation (children of current generation, including siblings)
      const nextGenerationBase: Person[] = [];
      const nextGenIds = new Set<string>();
      
      for (const person of currentGeneration) {
        for (const childId of person.childIds) {
          if (!visited.has(childId) && !nextGenIds.has(childId)) {
            const child = getPerson(childId);
            if (child) {
              nextGenerationBase.push(child);
              nextGenIds.add(childId);
            }
          }
        }
      }
      
      // Expand next generation with siblings
      currentGeneration = expandGenerationWithSiblings(nextGenerationBase);
    }
    
    // Debug logs removed to reduce noise - uncomment if needed for debugging
    // if (__DEV__) {
    //   console.log(`[Tree] getAllDescendantGenerations: Calculated ${generations.length} generations`);
    // }
    
    return generations;
    // Recalculate when ego, peopleSize, or relationships change
    // relationshipsHash ensures we recalculate when relationships are added/removed
  }, [egoId, peopleSize, relationshipsHash, ego?.id]);

  // Get ego's immediate relationships (for ego row)
  const { spouses, siblings } = useMemo(() => {
    if (!ego) {
      return { spouses: [], siblings: [] };
    }

    // Get store methods inside memo (getState() doesn't cause re-renders)
    const getPerson = usePeopleStore.getState().getPerson;
    const getSiblings = useRelationshipsStore.getState().getSiblings;

    const spouses = ego.spouseIds
      .map((id) => getPerson(id))
      .filter((p): p is NonNullable<typeof p> => p !== undefined);

    const siblings = getSiblings(ego.id);

    return { spouses, siblings };
  }, [ego, peopleSize, relationshipsHash]); // Recalculate when relationships change

  return {
    ancestorGenerations,
    descendantGenerations,
    spouses,
    siblings,
    ego,
  };
}

