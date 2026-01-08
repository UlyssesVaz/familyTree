/**
 * Family Tree Type Definitions
 * 
 * Core data structures for the ego-centric family tree.
 * These types are designed to support:
 * - Multi-user collaboration (version, timestamps)
 * - DAG validation (bidirectional relationships)
 * - Future persistence and sync
 */

/**
 * Gender options for a person
 */
export type Gender = 'male' | 'female' | 'other';

/**
 * Represents a single person in the family tree
 * 
 * Relationships are stored as arrays of UUIDs to support:
 * - Multiple parents (adoption, step-parents)
 * - Multiple spouses (multiple marriages)
 * - Multiple children
 */
export interface Person {
  /** Unique identifier (UUID v4) */
  id: string;
  
  /** Full name */
  name: string;
  
  /** Birth date (ISO 8601 format: YYYY-MM-DD) */
  birthDate?: string;
  
  /** Death date (ISO 8601 format: YYYY-MM-DD) */
  deathDate?: string;
  
  /** Gender for visual representation (blue/orange silhouettes) */
  gender?: Gender;
  
  /** Photo URL (for future implementation) */
  photoUrl?: string;
  
  /** Bio/description text */
  bio?: string;
  
  /** Phone number (for invitations and contact) */
  phoneNumber?: string;
  
  /** Parent IDs (array supports multiple parents) */
  parentIds: string[];
  
  /** Spouse IDs (array supports multiple marriages) */
  spouseIds: string[];
  
  /** Child IDs */
  childIds: string[];
  
  /** Sibling IDs (direct sibling relationships - for half-siblings, unknown parents, etc.) */
  siblingIds: string[];
  
  /** Timestamp when person was created (for conflict resolution) */
  createdAt: number;
  
  /** Timestamp when person was last updated (for conflict resolution) */
  updatedAt: number;
  
  /** User ID who created this person (for multi-user, optional for now) */
  createdBy?: string;
  
  /** User ID who last updated this person (for multi-user, optional for now) */
  updatedBy?: string;
  
  /** Version number for optimistic locking and conflict resolution */
  version: number;
  
  /** IDs of updates where this person is tagged but has hidden from their profile */
  hiddenTaggedUpdateIds?: string[];
}

/**
 * Represents an update (photo/story) posted to a person's profile
 */
export interface Update {
  /** Unique identifier (UUID v4) */
  id: string;
  
  /** ID of the person this update belongs to */
  personId: string;
  
  /** Title of the update */
  title: string;
  
  /** Photo URL (local URI for now, will be backend URL later) */
  photoUrl: string;
  
  /** Optional caption/text */
  caption?: string;
  
  /** Whether this update is public (false = private/greyed out) */
  isPublic: boolean;
  
  /** IDs of people tagged in this photo/update */
  taggedPersonIds?: string[];
  
  /** Timestamp when update was created */
  createdAt: number;
  
  /** User ID who created this update (for multi-user, optional for now) */
  createdBy?: string;
}

/**
 * State structure for the family tree store
 * 
 * Uses Map for O(1) lookups by UUID.
 * egoId points to the focal person (the user viewing the tree).
 */
export interface FamilyTreeState {
  /** Map of person ID to Person object */
  people: Map<string, Person>;
  
  /** Map of update ID to Update object */
  updates: Map<string, Update>;
  
  /** ID of the ego (focal person) - null if not initialized */
  egoId: string | null;
  
  /** Actions will be defined in the store implementation */
}

