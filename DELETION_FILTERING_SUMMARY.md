# Deletion Filtering Implementation Summary

## Overview
This document explains how account deletion filtering works, differentiating between `delete_profile` and `deactivate_profile` options.

## Database Schema

### New Column Added
- `deletion_type` TEXT - Stores either `'delete_profile'` or `'deactivate_profile'`
- Added to `people` table via migration: `DATABASE_MIGRATION_DELETION_TYPE.sql`

### Updated Function
- `request_account_deletion()` - Now accepts `deletion_type_input` parameter

## Deletion Behavior

### Delete Profile (`delete_profile`)
**What happens:**
- User's updates/posts are **hidden** from all users
- User's profile is **hidden** from family tree
- Photos and stories are deleted from Storage
- Name remains in database (for family history) but not visible
- Account info deleted within 30 days

**Filtering:**
- `getAllUpdates()` - Filters out updates where `created_by` matches users with `deletion_type = 'delete_profile'`
- `getAllPeople()` - Filters out people where `deletion_type = 'delete_profile'`

### Deactivate Profile (`deactivate_profile`)
**What happens:**
- User's updates/posts **remain visible** (content stays up)
- User's profile **remains visible** in family tree
- Photos and stories **remain** in Storage
- Only account info (bio, phone) is removed
- Account info removed within 1 year (soft delete)

**Filtering:**
- `getAllUpdates()` - **Keeps** updates from `deactivate_profile` users
- `getAllPeople()` - **Keeps** people with `deactivate_profile`

## Implementation Details

### API Level Filtering (Primary)

#### `getAllUpdates()` in `updates-api.ts`
```typescript
// Step 1: Get user IDs who requested 'delete_profile' deletion
const deletedUserIds = await getDeletedUserIds('delete_profile');

// Step 2: Filter updates in JavaScript (after query)
updates = updates.filter(update => {
  return !update.createdBy || !deletedUserIdsSet.has(update.createdBy);
});
```

#### `getAllPeople()` in `people-api.ts`
```typescript
// SQL-level filtering (most efficient)
.or('deletion_type.is.null,deletion_type.neq.delete_profile')
```

### Store Level Filtering (Defensive)

#### `setUpdates()` in `updates-store.ts`
- Safety net in case API filtering fails
- Currently relies on API filtering (since Update type doesn't have deletion_type)
- Could be enhanced if needed

## Best Practices

1. **Filter at API level (SQL/query)** - Most efficient, prevents deleted data from reaching client
2. **Defensive filtering in stores** - Safety net, but API should handle it
3. **Differentiate deletion types** - `delete_profile` hides content, `deactivate_profile` keeps it
4. **Grace period** - Users can cancel deletion during 30-day grace period

## Migration Required

Run the SQL in `DATABASE_MIGRATION_DELETION_TYPE.sql`:
1. Add `deletion_type` column to `people` table
2. Update `request_account_deletion()` function to accept and store deletion type

## Testing Checklist

- [ ] Request `delete_profile` deletion → Updates and profile should be hidden
- [ ] Request `deactivate_profile` deletion → Updates and profile should remain visible
- [ ] Cancel deletion during grace period → Everything should be restored
- [ ] Sign in after deletion request → Deleted content should not appear
- [ ] Verify `deactivate_profile` users' content remains visible
