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
  deleted_at?: string | null;
  coppa_deleted?: boolean;
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
 * @param options - Optional configuration for placeholder detection
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
  existingProfile?: Person,
  options?: {
    blockedUserIds?: Set<string>;
    currentUserId?: string;
  }
): Person {
  // #region agent log
  fetch('http://127.0.0.1:7244/ingest/f336e8f0-8f7a-40aa-8f54-32371722b5de',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'mappers.ts:58',message:'mapPersonRow entry',data:{userId:row.user_id,linkedAuthUserId:row.linked_auth_user_id||'',hasBlockedSet:!!options?.blockedUserIds,blockedSetSize:options?.blockedUserIds?.size||0,hasCurrentUserId:!!options?.currentUserId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,B,C'})}).catch(()=>{});
  // #endregion
  // Validate required field
  if (!row.user_id) {
    throw new Error('Database response missing user_id');
  }

  // Check if this person should be rendered as a placeholder
  // CRITICAL: Only set placeholder if there's a REAL reason (blocked, deleted, or COPPA-deleted)
  const deletedAt = row.deleted_at;
  const isDeleted = deletedAt !== null && deletedAt !== undefined && deletedAt !== '';
  const coppaDeletedField = (row as any).coppa_deleted;
  const isCoppaDeleted = coppaDeletedField === true || coppaDeletedField === 1; // Explicit boolean/truthy check
  
  const linkedAuthUserId = row.linked_auth_user_id || null; // Use null instead of empty string for clarity
  const isBlocked = linkedAuthUserId && options?.blockedUserIds ? options.blockedUserIds.has(linkedAuthUserId) : false;
  
  const isPlaceholder = isDeleted || isCoppaDeleted || isBlocked;
  
  // #region agent log
  fetch('http://127.0.0.1:7244/ingest/f336e8f0-8f7a-40aa-8f54-32371722b5de',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'mappers.ts:84',message:'mapPersonRow placeholder check',data:{userId:row.user_id,linkedAuthUserId:linkedAuthUserId||'',deletedAt:deletedAt||'null',isDeleted,coppaDeletedField,isCoppaDeleted,isBlocked,isPlaceholder,hasBlockedSet:!!options?.blockedUserIds,blockedSetSize:options?.blockedUserIds?.size||0,blockedInSet:linkedAuthUserId?(options?.blockedUserIds?.has(linkedAuthUserId)||false):false},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,B,C'})}).catch(()=>{});
  // #endregion
  
  if (__DEV__ && isPlaceholder) {
    console.log('[Mapper] Creating placeholder person', {
      userId: row.user_id,
      linkedAuthUserId,
      reason: isCoppaDeleted ? 'coppa_deleted' : isBlocked ? 'blocked' : 'deleted',
      hasBlockedSet: !!options?.blockedUserIds,
      blockedCount: options?.blockedUserIds?.size || 0,
    });
  }
  
  // Get relationships (use parameter, existing profile, or empty arrays)
  const parentIds = relationships?.parentIds ?? existingProfile?.parentIds ?? [];
  const spouseIds = relationships?.spouseIds ?? existingProfile?.spouseIds ?? [];
  const childIds = relationships?.childIds ?? existingProfile?.childIds ?? [];
  const siblingIds = relationships?.siblingIds ?? existingProfile?.siblingIds ?? [];
  
  if (isPlaceholder) {
    // Return MINIMAL placeholder person (keeps tree structure intact)
    const placeholderPerson = {
      id: row.user_id,
      name: '', // Empty name for privacy
      parentIds,
      spouseIds,
      childIds,
      siblingIds,
      createdAt: new Date(row.created_at).getTime(),
      updatedAt: new Date(row.updated_at).getTime(),
      version: 1,
      isPlaceholder: true,
      placeholderReason: isCoppaDeleted ? 'coppa_deleted' : isBlocked ? 'blocked' : 'deleted',
      // ❌ NO bio, photoUrl, phoneNumber, birthDate, deathDate, gender
    };
    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/f336e8f0-8f7a-40aa-8f54-32371722b5de',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'mappers.ts:101',message:'mapPersonRow returning placeholder',data:{userId:row.user_id,isPlaceholder:placeholderPerson.isPlaceholder,placeholderReason:placeholderPerson.placeholderReason},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,C'})}).catch(()=>{});
    // #endregion
    return placeholderPerson;
  }

  // Normal person mapping (existing code - keep as is)
  const createdAt = existingProfile?.createdAt ?? new Date(row.created_at).getTime();
  const updatedAt = existingProfile?.updatedAt ?? new Date(row.updated_at).getTime();
  const version = existingProfile?.version 
    ? ((row.version ?? existingProfile.version) + 1)
    : ((row.version ?? 1));

  const normalPerson = {
    id: row.user_id,
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
    updatedBy: (row as any).updated_by || undefined,
    version,
    hiddenTaggedUpdateIds: existingProfile?.hiddenTaggedUpdateIds ?? undefined,
    linkedAuthUserId: row.linked_auth_user_id || undefined,
  };
  // #region agent log
  fetch('http://127.0.0.1:7244/ingest/f336e8f0-8f7a-40aa-8f54-32371722b5de',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'mappers.ts:140',message:'mapPersonRow returning normal person',data:{userId:row.user_id,hasName:!!normalPerson.name,isPlaceholder:normalPerson.isPlaceholder||false},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,C'})}).catch(()=>{});
  // #endregion
  return normalPerson;
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
