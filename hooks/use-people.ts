/**
 * React Query hooks for managing people/person data
 * 
 * Replaces Zustand store with React Query for automatic:
 * - Optimistic updates
 * - Error rollback
 * - Cache invalidation
 * - Loading states
 * 
 * NOTE: During migration, this works alongside Zustand PeopleStore.
 * Temp ID resolution is still handled via Zustand until fully migrated.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/auth-context';
import { getAllPeople, createRelative, createEgoProfile } from '@/services/supabase/people-api';
import type { Person } from '@/types/family-tree';
import { useSessionStore } from '@/stores/session-store';

export interface CreatePersonInput {
  name: string;
  photoUrl?: string;
  birthDate?: string;
  gender?: Person['gender'];
  phoneNumber?: string;
}

/**
 * Query hook - fetches all people for the current user's family tree
 */
export function usePeople() {
  const { session } = useAuth();
  const userId = session?.user?.id;

  return useQuery({
    queryKey: ['people', userId],
    queryFn: async () => {
      if (!userId) return [];
      return await getAllPeople(userId);
    },
    enabled: !!userId,
    staleTime: 60000, // 1 minute
  });
}

/**
 * Get people as a Map for easy lookup (for backward compatibility during migration)
 */
export function usePeopleMap(): Map<string, Person> {
  const { data: peopleArray = [] } = usePeople();
  
  const peopleMap = new Map<string, Person>();
  for (const person of peopleArray) {
    peopleMap.set(person.id, person);
  }
  
  return peopleMap;
}

/**
 * Get a single person by ID
 */
export function usePerson(personId: string | null | undefined): Person | undefined {
  const { data: peopleArray = [] } = usePeople();
  
  if (!personId) return undefined;
  return peopleArray.find(p => p.id === personId);
}

/**
 * Mutation hook - creates a new person with optimistic updates
 * 
 * NOTE: Temp ID resolution is still handled by Zustand during migration.
 * This mutation works alongside Zustand for now.
 */
export function useAddPerson() {
  const queryClient = useQueryClient();
  const { session } = useAuth();

  return useMutation({
    mutationFn: async ({ userId, input }: { userId: string; input: CreatePersonInput }) => {
      return await createRelative(userId, {
        name: input.name,
        birthDate: input.birthDate,
        gender: input.gender,
        photoUrl: input.photoUrl,
        bio: undefined,
        phoneNumber: input.phoneNumber,
      });
    },
    
    // Optimistic update
    onMutate: async ({ userId, input }) => {
      await queryClient.cancelQueries({ queryKey: ['people', userId] });

      const previousPeople = queryClient.getQueryData<Person[]>(['people', userId]);

      // Generate temp ID for optimistic update
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const now = Date.now();
      
      const optimisticPerson: Person = {
        id: tempId,
        name: input.name,
        photoUrl: input.photoUrl,
        birthDate: input.birthDate,
        gender: input.gender,
        phoneNumber: input.phoneNumber,
        parentIds: [],
        spouseIds: [],
        childIds: [],
        siblingIds: [],
        createdAt: now,
        updatedAt: now,
        version: 1,
        linkedAuthUserId: undefined,
      };

      // Optimistically add to cache
      queryClient.setQueryData<Person[]>(['people', userId], (old = []) => [
        ...old,
        optimisticPerson,
      ]);

      return { previousPeople, tempId };
    },
    
    // On success, replace temp person with real one
    onSuccess: (data, { userId }, context) => {
      if (!context) return;
      
      queryClient.setQueryData<Person[]>(['people', userId], (old = []) => {
        // Remove temp person and add real one
        const filtered = old.filter(p => p.id !== context.tempId);
        return [...filtered, data];
      });
      
      // Also invalidate relationships cache since a new person was added
      queryClient.invalidateQueries({ queryKey: ['relationships', userId] });
    },
    
    // Rollback on error
    onError: (error, { userId }, context) => {
      if (!context) return;
      
      if (context.previousPeople) {
        queryClient.setQueryData(['people', userId], context.previousPeople);
      }
    },
  });
}

/**
 * Mutation hook - creates an ego profile (user's own profile)
 * 
 * Used during onboarding when a user creates their first profile.
 * Automatically updates React Query cache and Zustand store.
 */
export function useCreateEgoProfile() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: {
      userId: string;
      name: string;
      birthDate: string;
      gender?: Person['gender'];
      photoUrl?: string;
      bio?: string;
      privacyPolicyAcceptedAt?: string;
    }) => {
      return await createEgoProfile(data.userId, {
        name: data.name,
        birthDate: data.birthDate,
        gender: data.gender,
        photoUrl: data.photoUrl,
        bio: data.bio,
        privacyPolicyAcceptedAt: data.privacyPolicyAcceptedAt,
      });
    },
    
    onSuccess: (createdPerson, variables) => {
      // Automatically update React Query cache
      queryClient.setQueryData<Person[]>(['people', variables.userId], (old = []) => {
        // Check if ego already exists
        const egoExists = old.some(p => p.id === createdPerson.id);
        if (egoExists) {
          return old.map(p => p.id === createdPerson.id ? createdPerson : p);
        }
        return [...old, createdPerson];
      });
      
      // Update Zustand store for backward compatibility
      useSessionStore.getState().loadEgo(createdPerson);
    },
  });
}

/**
 * Mutation hook - updates a person
 */
export function useUpdatePerson() {
  const queryClient = useQueryClient();
  const { session } = useAuth();

  return useMutation({
    mutationFn: async ({
      userId,
      personId,
      updates,
    }: {
      userId: string;
      personId: string;
      updates: Partial<Person>;
    }) => {
      // For now, we'll update locally and let sync handle the server update
      // This will be improved when we migrate updateEgoProfile and other update APIs
      const currentPeople = queryClient.getQueryData<Person[]>(['people', userId]) || [];
      const person = currentPeople.find(p => p.id === personId);
      
      if (!person) {
        throw new Error('Person not found');
      }
      
      // Return updated person (real API call will be added when migrating update APIs)
      return {
        ...person,
        ...updates,
        updatedAt: Date.now(),
        version: person.version + 1,
      };
    },
    
    // Optimistic update
    onMutate: async ({ userId, personId, updates }) => {
      await queryClient.cancelQueries({ queryKey: ['people', userId] });

      const previousPeople = queryClient.getQueryData<Person[]>(['people', userId]);

      queryClient.setQueryData<Person[]>(['people', userId], (old = []) =>
        old.map(p => p.id === personId ? { ...p, ...updates, updatedAt: Date.now() } : p)
      );

      return { previousPeople };
    },
    
    // On success, ensure cache is updated
    onSuccess: (data, { userId, personId }) => {
      queryClient.setQueryData<Person[]>(['people', userId], (old = []) =>
        old.map(p => p.id === personId ? data : p)
      );
    },
    
    // Rollback on error
    onError: (error, { userId }, context) => {
      if (context?.previousPeople) {
        queryClient.setQueryData(['people', userId], context.previousPeople);
      }
    },
  });
}