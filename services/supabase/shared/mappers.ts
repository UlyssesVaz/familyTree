/**
 * Shared Mapper Utilities
 * 
 * Centralized row-to-model mapping functions.
 * Used by people-api.ts and updates-api.ts to avoid duplication.
 */

import type { Person, Update, Gender } from '@/types/family-tree';

/**
 * Database row type for people table
 * Maps directly to PostgreSQL schema
 */
export interface PeopleRow {
  user_id: string; // Primary key - NOT NULL
  name: string;
  birth_date: string | null;
  death_date: string | null;
  gender: 'male' | 'female' | 'other' | null;
  photo_url: string | null;
  bio: string | null;
  phone_number: string | null;
  created_at: string; // ISO 8601 timestamp
  updated_at: string; // ISO 8601 timestamp
  created_by: string | null;
  updated_by?: string | null; // Optional - may not exist in schema
  version?: number; // Optional - may not exist in schema
  linked_auth_user_id?: string | null;
}

/**
 * Database row type for updates table
 */
export interface UpdatesRow {
  updates_id: string; // PRIMARY KEY (UUID)
  user_id: string; // FOREIGN KEY to people.user_id
  created_by: string; // FOREIGN KEY to auth.users.id
  title: string;
  photo_url: string | null;
  caption: string | null;
  is_public: boolean;
  created_at: string; // ISO 8601 timestamp
  updated_at: string; // ISO 8601 timestamp
  deleted_at?: string | null;
}

/**
 * Map a database PeopleRow to a Person object
 * 
 * @param row - Database row from people table
 * @param relationships - Optional relationship arrays (if not provided, uses empty arrays)
 * @param existingProfile - Optional existing profile to preserve relationships and metadata
 * @returns Person object
 */
export function mapPersonRow(
  row: PeopleRow,
  relationships?: {
    parentIds?: string[];
    spouseIds?: string[];
    childIds?: string[];
    siblingIds?: string[];
  },
  existingProfile?: Person
): Person {
  // Validate required field
  if (!row.user_id) {
    throw new Error('Database response missing user_id');
  }

  // Use relationships from parameter, or existing profile, or empty arrays
  const parentIds = relationships?.parentIds ?? existingProfile?.parentIds ?? [];
  const spouseIds = relationships?.spouseIds ?? existingProfile?.spouseIds ?? [];
  const childIds = relationships?.childIds ?? existingProfile?.childIds ?? [];
  const siblingIds = relationships?.siblingIds ?? existingProfile?.siblingIds ?? [];

  // Use existing profile metadata if provided, otherwise use row data
  const createdAt = existingProfile?.createdAt ?? new Date(row.created_at).getTime();
  const updatedAt = existingProfile?.updatedAt ?? new Date(row.updated_at).getTime();
  const version = existingProfile?.version 
    ? ((row.version ?? existingProfile.version) + 1) // Increment if updating
    : ((row.version ?? 1)); // Default to 1 if new

  return {
    id: row.user_id, // Use user_id as Person.id (frontend uses 'id' for consistency)
    name: row.name,
    birthDate: row.birth_date || undefined,
    deathDate: row.death_date || undefined,
    gender: (row.gender as Gender) || undefined,
    photoUrl: row.photo_url || undefined,
    bio: row.bio || undefined,
    phoneNumber: row.phone_number || undefined,
    parentIds,
    spouseIds,
    childIds,
    siblingIds,
    createdAt,
    updatedAt,
    createdBy: row.created_by || undefined,
    updatedBy: (row as any).updated_by || undefined, // Optional column
    version,
    hiddenTaggedUpdateIds: existingProfile?.hiddenTaggedUpdateIds ?? undefined,
    linkedAuthUserId: row.linked_auth_user_id || undefined,
  };
}

/**
 * Map a database UpdatesRow to an Update object
 * 
 * @param row - Database row from updates table
 * @param taggedPersonIds - Optional tagged person IDs (if not provided, uses undefined)
 * @returns Update object
 */
export function mapUpdateRow(
  row: UpdatesRow,
  taggedPersonIds?: string[]
): Update {
  return {
    id: row.updates_id, // UUID primary key
    personId: row.user_id, // The person this update belongs to
    title: row.title,
    photoUrl: row.photo_url || '', // Required field, use empty string if null
    caption: row.caption || undefined,
    isPublic: row.is_public,
    taggedPersonIds: taggedPersonIds && taggedPersonIds.length > 0 
      ? taggedPersonIds 
      : undefined,
    createdAt: new Date(row.created_at).getTime(),
    createdBy: row.created_by, // The user who created this update
    deletedAt: row.deleted_at ? new Date(row.deleted_at).getTime() : undefined,
  };
}
