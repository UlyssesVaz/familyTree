/**
 * FamilyTreeService
 * 
 * Service layer abstraction for family tree operations.
 * 
 * **What is a Service Layer?**
 * A service layer sits between your UI components and your data store/API.
 * It provides:
 * - **Abstraction**: Components don't need to know if data comes from local store or API
 * - **Future-proofing**: Easy to swap mock data for real API calls
 * - **Centralized logic**: All data operations in one place
 * - **Error handling**: Consistent error handling across the app
 * 
 * **Before:** Components directly called store methods (hard to add API calls later)
 * **After:** Components call service methods, service decides store vs API
 * 
 * **Current:** Uses Zustand store directly
 * **Future:** Will call Firebase/backend APIs and sync with store
 */

import { usePeopleStore } from '@/stores/people-store';
import { useRelationshipsStore } from '@/stores/relationships-store';
import { useUpdatesStore } from '@/stores/updates-store';
import { useSessionStore } from '@/stores/session-store';
import type { Person, Update, Gender } from '@/types/family-tree';

/**
 * Service class for family tree operations.
 * 
 * Currently wraps Zustand store calls.
 * When backend is ready, methods will:
 * 1. Call API endpoints
 * 2. Update local store optimistically
 * 3. Sync with server response
 * 4. Handle errors and retries
 */
export class FamilyTreeService {
  /**
   * Add a new person to the family tree.
   * 
   * @param data - Person data (name, photo, birthDate, gender, etc.)
   * @returns The ID of the newly created person
   * 
   * **Future:** Will POST to `/api/people` and sync response
   */
  addPerson(data: {
    name: string;
    photoUrl?: string;
    birthDate?: string;
    gender?: Gender;
    phoneNumber?: string;
  }): string {
    // Currently: Direct store call
    // Future: API call + store update
    return usePeopleStore.getState().addPerson(data);
  }

  /**
   * Add a relationship between two people.
   * 
   * @param personId - The person to add the relationship to
   * @param relatedPersonId - The related person's ID
   * @param relationshipType - Type of relationship ('parent', 'spouse', 'child', 'sibling')
   * 
   * **Future:** Will POST to `/api/relationships` and sync response
   */
  addRelationship(
    personId: string,
    relatedPersonId: string,
    relationshipType: 'parent' | 'spouse' | 'child' | 'sibling'
  ): void {
    // Currently: Direct store calls
    // Future: API call + store update
    const relationshipsStore = useRelationshipsStore.getState();
    
    switch (relationshipType) {
      case 'parent':
        relationshipsStore.addParent(personId, relatedPersonId);
        break;
      case 'spouse':
        relationshipsStore.addSpouse(personId, relatedPersonId);
        break;
      case 'child':
        relationshipsStore.addChild(personId, relatedPersonId);
        break;
      case 'sibling':
        relationshipsStore.addSibling(personId, relatedPersonId);
        break;
    }
  }

  /**
   * Add an update (photo/memory) to a person's profile.
   * 
   * @param personId - The person who created the update
   * @param title - Update title
   * @param photoUrl - Photo URL
   * @param caption - Optional caption with @mentions
   * @param isPublic - Whether update is public
   * @param taggedPersonIds - Optional array of tagged person IDs
   * @returns The ID of the newly created update
   * 
   * **Future:** Will POST to `/api/updates` with photo upload and sync response
   */
  addUpdate(
    personId: string,
    title: string,
    photoUrl: string,
    caption?: string,
    isPublic?: boolean,
    taggedPersonIds?: string[]
  ): string {
    // Currently: Direct store call
    // Future: Upload photo to storage, POST to API, sync response
    return useUpdatesStore.getState().addUpdate(
      personId,
      title,
      photoUrl,
      caption,
      isPublic,
      taggedPersonIds
    );
  }

  /**
   * Update an existing update.
   * 
   * @param updateId - The update ID
   * @param data - Updated data (title, photoUrl, caption, etc.)
   * 
   * **Future:** Will PUT to `/api/updates/:id` and sync response
   */
  updateUpdate(
    updateId: string,
    title: string,
    photoUrl: string,
    caption?: string,
    isPublic?: boolean,
    taggedPersonIds?: string[]
  ): void {
    // Currently: Direct store call
    // Future: PUT to API + store update
    useUpdatesStore.getState().updateUpdate(
      updateId,
      title,
      photoUrl,
      caption,
      isPublic,
      taggedPersonIds
    );
  }

  /**
   * Delete an update.
   * 
   * @param updateId - The update ID to delete
   * 
   * **Future:** Will DELETE `/api/updates/:id` and sync response
   */
  deleteUpdate(updateId: string): void {
    // Currently: Direct store call
    // Future: DELETE from API + store update
    useUpdatesStore.getState().deleteUpdate(updateId);
  }

  /**
   * Update a person's profile information.
   * 
   * @param personId - The person's ID
   * @param data - Updated profile data
   * 
   * **Future:** Will PUT to `/api/people/:id` and sync response
   */
  updatePerson(
    personId: string,
    data: Partial<Pick<Person, 'name' | 'photoUrl' | 'birthDate' | 'gender' | 'bio' | 'phoneNumber'>>
  ): void {
    // Currently: Direct store call
    // Future: PUT to API + store update
    const sessionStore = useSessionStore.getState();
    if (personId === sessionStore.egoId) {
      sessionStore.updateEgo(data);
    } else {
      // For non-ego people, we'd need an updatePerson method in the store
      // This is a placeholder for future implementation
      console.warn('updatePerson for non-ego not yet implemented');
    }
  }

  /**
   * Sync family tree data from the server.
   * 
   * **Future:** Will GET `/api/family-tree` and update store
   */
  async syncTree(): Promise<void> {
    // Future: Fetch from API and update store
    // const response = await fetch('/api/family-tree');
    // const data = await response.json();
    // useFamilyTreeStore.getState().syncTree(data);
    console.log('syncTree: Not yet implemented - will fetch from API');
  }

  /**
   * Initialize the ego (current user's profile).
   * 
   * @param name - Ego's name
   * @param birthDate - Birth date
   * @param gender - Gender
   * @param userId - User ID from auth
   * 
   * **Future:** Will POST to `/api/people` and sync response
   */
  initializeEgo(
    name: string,
    birthDate?: string,
    gender?: Gender,
    userId?: string
  ): void {
    // Currently: Direct store call
    // Future: POST to API + store update
    useSessionStore.getState().initializeEgo(name, birthDate, gender, userId);
  }
}

// Export a singleton instance
export const familyTreeService = new FamilyTreeService();

