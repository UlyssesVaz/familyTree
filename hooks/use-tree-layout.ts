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
import { useFamilyTreeStore } from '@/stores/family-tree-store';
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
  const people = useFamilyTreeStore((state) => state.people);
  const peopleSize = useFamilyTreeStore((state) => state.people.size);
  const getPerson = useFamilyTreeStore((state) => state.getPerson);
  const getSiblings = useFamilyTreeStore((state) => state.getSiblings);

  // Get ego person
  const ego = useMemo(() => {
    if (!egoId) return null;
    return people.get(egoId) || null;
  }, [egoId, people, peopleSize]);

  // Convert people Map to array for dependency tracking
  const peopleArray = useMemo(() => {
    return Array.from(people.values());
  }, [people, peopleSize]);

  // Recursively get all ancestor generations (parents, grandparents, etc.)
  // Includes siblings of each person in each generation
  const ancestorGenerations = useMemo(() => {
    if (!ego) {
      if (__DEV__) {
        console.log(`[Tree] getAllAncestorGenerations: No ego`);
      }
      return [];
    }
    
    if (__DEV__) {
      console.log(`[Tree] getAllAncestorGenerations: Starting calculation, ego: ${ego.name}, people.size: ${peopleSize}`);
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
    
    if (__DEV__) {
      console.log(`[Tree] getAllAncestorGenerations: Calculated ${result.length} generations`);
      result.forEach((gen, idx) => {
        console.log(`[Tree]   Generation ${idx}: ${gen.length} people - ${gen.map(p => p.name).join(', ')}`);
      });
    }
    
    return result;
  }, [ego, ego?.id, people, peopleSize, peopleArray, getPerson, getSiblings]);

  // Recursively get all descendant generations (children, grandchildren, etc.)
  // Includes siblings of each person in each generation
  const descendantGenerations = useMemo(() => {
    if (!ego) return [];
    
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
    
    if (__DEV__) {
      console.log(`[Tree] getAllDescendantGenerations: Calculated ${generations.length} generations`);
      generations.forEach((gen, idx) => {
        console.log(`[Tree]   Generation ${idx}: ${gen.length} people - ${gen.map(p => p.name).join(', ')}`);
      });
    }
    
    return generations;
  }, [ego, ego?.id, people, peopleSize, peopleArray, getPerson, getSiblings]);

  // Get ego's immediate relationships (for ego row)
  const { spouses, siblings } = useMemo(() => {
    if (!ego) {
      return { spouses: [], siblings: [] };
    }

    const spouses = ego.spouseIds
      .map((id) => getPerson(id))
      .filter((p): p is NonNullable<typeof p> => p !== undefined);

    const siblings = getSiblings(ego.id);

    return { spouses, siblings };
  }, [ego, people, getPerson, getSiblings]);

  return {
    ancestorGenerations,
    descendantGenerations,
    spouses,
    siblings,
    ego,
  };
}

