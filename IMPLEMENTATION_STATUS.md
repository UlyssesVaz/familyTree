# Backend Implementation Status

## ✅ Completed

### 1. Reports API (`services/supabase/reports-api.ts`)
- ✅ `reportContent()` - Submit reports for inappropriate content
- ✅ `getUserReports()` - Get user's report history
- ✅ Connected to ReportAbuseModal in:
  - `app/(tabs)/profile.tsx`
  - `app/(tabs)/family.tsx`
  - `app/person/[personId].tsx`
- ✅ Handles 'other' reason → maps to 'abuse' for API compatibility

### 2. Account Deletion API (`services/supabase/account-api.ts`)
- ✅ `requestAccountDeletion()` - Start deletion with grace period
- ✅ `cancelAccountDeletion()` - Cancel during grace period
- ✅ `getAccountDeletionStatus()` - Get current deletion status
- ✅ `restoreAccount()` - Restore using recovery token
- ✅ `processAccountDeletion()` - Background job for actual deletion
- ✅ Connected to Settings page (`app/(tabs)/settings.tsx`)
- ✅ Handles both `delete_profile` and `deactivate_profile` options

### 3. Update Management API (`services/supabase/updates-api.ts`)
- ✅ `updateUpdate()` - Edit update (title, caption, photo, privacy, tags)
- ✅ `toggleUpdatePrivacy()` - Toggle public/private
- ✅ Both functions verify user ownership
- ✅ Handle photo upload/replacement
- ✅ Update update_tags when taggedPersonIds change

### 4. Store Updates (`stores/updates-store.ts`)
- ✅ `updateUpdate()` - Now calls API and syncs with backend
- ✅ `toggleUpdatePrivacy()` - Now calls API and syncs with backend
- ✅ Optimistic updates with error handling
- ✅ Reverts on API failure

### 5. UI Updates
- ✅ Profile screen - Async handling for edit and privacy toggle
- ✅ Family screen - Async handling for edit and privacy toggle
- ✅ Error handling with user-friendly alerts

### 6. Deletion Filtering
- ✅ `getAllUpdates()` - Filters out updates from `delete_profile` users
- ✅ `getAllPeople()` - Filters out people with `delete_profile` deletion
- ✅ `deactivate_profile` users' content remains visible
- ✅ Defensive filtering in stores as safety net

## ⚠️ Database Migration Required

### Run This SQL in Supabase SQL Editor:

```sql
-- Add deletion_type column
ALTER TABLE public.people 
  ADD COLUMN IF NOT EXISTS deletion_type TEXT CHECK (deletion_type IN ('delete_profile', 'deactivate_profile'));

-- Update the request_account_deletion function
CREATE OR REPLACE FUNCTION public.request_account_deletion(
  token_input TEXT,
  deletion_type_input TEXT
)
RETURNS VOID AS $$
BEGIN
  UPDATE public.people
  SET 
    deletion_requested_at = NOW(),
    deletion_grace_period_ends_at = NOW() + INTERVAL '30 days',
    deletion_recovery_token = token_input,
    deletion_type = deletion_type_input
  WHERE linked_auth_user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**File:** `DATABASE_MIGRATION_DELETION_TYPE.sql`

## 📋 Testing Checklist

### Reports
- [ ] Submit report from profile screen → Check database
- [ ] Submit report from family screen → Check database
- [ ] Submit report from person profile → Check database
- [ ] Verify reports table has correct data

### Account Deletion
- [ ] Request `delete_profile` deletion → Check people table has deletion_type
- [ ] Request `deactivate_profile` deletion → Check people table has deletion_type
- [ ] Sign out and sign back in → Deleted content should be hidden
- [ ] Verify `delete_profile` users' updates are filtered
- [ ] Verify `deactivate_profile` users' updates remain visible
- [ ] Cancel deletion → Deletion fields should be cleared

### Update Management
- [ ] Edit update title/caption → Should save to database
- [ ] Edit update photo → Should upload new photo, delete old one
- [ ] Toggle privacy → Should update is_public in database
- [ ] Edit tags → Should update update_tags table
- [ ] Verify optimistic updates work (instant UI feedback)
- [ ] Verify error handling (reverts on failure)

## 🎯 Next Steps

1. **Run Database Migration** - Execute `DATABASE_MIGRATION_DELETION_TYPE.sql`
2. **Test All Features** - Use the checklist above
3. **Background Job** - Set up scheduled function for `processAccountDeletion()`
4. **Edge Function** - Create Edge Function for auth.users deletion (requires service_role)

## 📝 Notes

- **Deletion Filtering**: `delete_profile` hides content, `deactivate_profile` keeps it visible
- **Best Practice**: Filter at API level (SQL), defensive filtering in stores
- **Auth User Deletion**: Requires Edge Function or admin action (can't delete from client)
- **Grace Period**: 30 days for both deletion types (user can cancel)
