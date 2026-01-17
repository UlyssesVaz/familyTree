# Supabase Database Migrations

This document contains SQL migrations that need to be run in your Supabase database.

## Migration: Secure Invitation Claiming (Profile Hijacking Fix)

**Date:** 2024
**Purpose:** Fix profile hijacking vulnerability by implementing atomic RPC functions for invitation claiming.

### Required Functions

Run these SQL statements in your Supabase SQL Editor:

#### 1. `claim_invitation` RPC Function

This function atomically claims an invitation, preventing race conditions and double-claiming.

```sql
-- Function: claim_invitation
-- Purpose: Atomically claim an invitation link, preventing race conditions
-- Security: Uses SELECT ... FOR UPDATE to lock the invitation row

CREATE OR REPLACE FUNCTION claim_invitation(
  p_token TEXT,
  p_claiming_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_invitation RECORD;
  v_person RECORD;
  v_result JSONB;
BEGIN
  -- Step 1: Lock and fetch the invitation (SELECT ... FOR UPDATE prevents concurrent claims)
  SELECT 
    il.id,
    il.target_person_id,
    il.expires_at,
    il.created_by,
    p.name as person_name,
    p.linked_auth_user_id
  INTO v_invitation
  FROM invitation_links il
  INNER JOIN people p ON p.user_id = il.target_person_id
  WHERE il.token = p_token
  FOR UPDATE OF il; -- Lock the invitation row

  -- Step 2: Validate invitation exists
  IF v_invitation.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_message', 'Invalid or expired invitation link',
      'error_code', 'INVALID_TOKEN'
    );
  END IF;

  -- Step 3: Check if already expired
  IF v_invitation.expires_at < NOW() THEN
    -- Delete expired invitation
    DELETE FROM invitation_links WHERE token = p_token;
    
    RETURN jsonb_build_object(
      'success', false,
      'error_message', 'This invitation link has expired',
      'error_code', 'EXPIRED'
    );
  END IF;

  -- Step 4: Check if profile is already claimed
  IF v_invitation.linked_auth_user_id IS NOT NULL THEN
    -- Delete the invitation (already claimed, no need to keep it)
    DELETE FROM invitation_links WHERE token = p_token;
    
    RETURN jsonb_build_object(
      'success', false,
      'error_message', 'This profile has already been claimed',
      'error_code', 'ALREADY_CLAIMED'
    );
  END IF;

  -- Step 5: Claim the profile (atomic update)
  UPDATE people
  SET 
    linked_auth_user_id = p_claiming_user_id,
    updated_at = NOW(),
    updated_by = p_claiming_user_id
  WHERE user_id = v_invitation.target_person_id
    AND linked_auth_user_id IS NULL; -- Double-check (defense in depth)

  -- Step 6: Verify the update succeeded
  IF NOT FOUND THEN
    -- Another process claimed it between our check and update
    RETURN jsonb_build_object(
      'success', false,
      'error_message', 'This profile has already been claimed',
      'error_code', 'ALREADY_CLAIMED'
    );
  END IF;

  -- Step 7: Delete the invitation (prevent reuse)
  DELETE FROM invitation_links WHERE token = p_token;

  -- Step 8: Return success
  RETURN jsonb_build_object(
    'success', true,
    'target_person_id', v_invitation.target_person_id,
    'person_name', v_invitation.person_name
  );
END;
$$;
```

#### 2. `validate_invitation_token` RPC Function

This function validates an invitation token without claiming it, used for pre-auth UI validation.

```sql
-- Function: validate_invitation_token
-- Purpose: Validate an invitation token without claiming it (for pre-auth UI)
-- Security: Read-only, no mutations

CREATE OR REPLACE FUNCTION validate_invitation_token(
  p_token TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_invitation RECORD;
  v_result JSONB;
BEGIN
  -- Fetch invitation and person details
  SELECT 
    il.target_person_id,
    il.expires_at,
    p.name as person_name,
    p.linked_auth_user_id
  INTO v_invitation
  FROM invitation_links il
  INNER JOIN people p ON p.user_id = il.target_person_id
  WHERE il.token = p_token;

  -- Check if invitation exists
  IF v_invitation.target_person_id IS NULL THEN
    RETURN jsonb_build_object(
      'is_valid', false,
      'is_already_claimed', false,
      'error_code', 'INVALID_TOKEN'
    );
  END IF;

  -- Check if expired
  IF v_invitation.expires_at < NOW() THEN
    RETURN jsonb_build_object(
      'is_valid', false,
      'is_already_claimed', false,
      'error_code', 'EXPIRED'
    );
  END IF;

  -- Check if already claimed
  IF v_invitation.linked_auth_user_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'is_valid', false,
      'is_already_claimed', true,
      'error_code', 'ALREADY_CLAIMED'
    );
  END IF;

  -- Valid invitation
  RETURN jsonb_build_object(
    'is_valid', true,
    'is_already_claimed', false,
    'target_person_id', v_invitation.target_person_id,
    'person_name', v_invitation.person_name,
    'expires_at', v_invitation.expires_at
  );
END;
$$;
```

### Security Notes

1. **Row Locking**: The `claim_invitation` function uses `SELECT ... FOR UPDATE` to lock the invitation row, preventing concurrent claims.

2. **Atomic Operations**: All validation and updates happen in a single transaction within the RPC function.

3. **Defense in Depth**: Multiple checks ensure the profile isn't already claimed:
   - Check before update
   - Conditional update (`WHERE linked_auth_user_id IS NULL`)
   - Verify update succeeded

4. **Error Codes**: Structured error codes allow the frontend to show appropriate messages.

### Testing

After running these migrations, test the following scenarios:

1. **Valid token, first claim** → Should succeed
2. **Same token, second claim** → Should return "already claimed"
3. **Expired token** → Should return "expired"
4. **Invalid token** → Should return "invalid"
5. **Two simultaneous claims** → First succeeds, second fails

### Rollback

If you need to rollback these changes:

```sql
DROP FUNCTION IF EXISTS claim_invitation(TEXT, UUID);
DROP FUNCTION IF EXISTS validate_invitation_token(TEXT);
```

---

## Migration: Account Deletion - Auth Users Deletion (Edge Function & Scheduled Job)

**Date:** 2024
**Purpose:** Complete account deletion by removing auth.users records after grace period. Required for App Store compliance (Apple Guideline 5.1.1).

### Required Components

1. **Supabase Edge Function** - `delete-user` function (file: `supabase/functions/delete-user/index.ts`)
2. **Scheduled Database Function** - Processes expired deletion requests daily

### Step 1: Deploy Edge Function

The Edge Function code is located at `supabase/functions/delete-user/index.ts`. To deploy it:

**Using Supabase CLI:**

```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Deploy the function
supabase functions deploy delete-user
```

**Using Supabase Dashboard:**

1. Go to your Supabase project dashboard
2. Navigate to **Edge Functions** → **Create a new function**
3. Name it `delete-user`
4. Copy the contents of `supabase/functions/delete-user/index.ts` into the editor
5. Deploy the function

**Important:** The Edge Function requires these environment variables (automatically available in Supabase):
- `SUPABASE_URL` - Your project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (automatically injected by Supabase)

### Step 2: Deploy Process Expired Deletions Edge Function

The comprehensive Edge Function that handles ALL cleanup (people table, updates, storage, auth.users) is located at `supabase/functions/process-expired-deletions/index.ts`. Deploy it:

```bash
supabase functions deploy process-expired-deletions
```

This Edge Function:
- Finds expired deletion requests (grace period ended)
- Deletes updates and their photos (if delete_profile type)
- Deletes person photos from storage
- Cleans up people table (converts to shadow profile)
- Deletes auth.users record (permanent deletion)

### Step 3: Optional SQL Helper Function

Run this SQL in your Supabase SQL Editor to create a helper function that returns expired deletions (cleaner query logic):

```sql
-- Function: get_expired_deletions
-- Purpose: Helper function to get list of users whose grace period has expired
-- This is used by the process-expired-deletions Edge Function for cleaner query logic
-- Security: SECURITY DEFINER (read-only query)
-- Returns: Simple tuple with target_user_id (auth.users.id) and target_person_id (person.user_id)

CREATE OR REPLACE FUNCTION public.get_expired_deletions()
RETURNS TABLE (
  target_user_id UUID,   -- auth.users.id (linked_auth_user_id)
  target_person_id UUID  -- person.user_id
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
      p.linked_auth_user_id as target_user_id,
      p.user_id as target_person_id
    FROM public.people p
    WHERE p.deletion_grace_period_ends_at <= NOW()
      AND p.linked_auth_user_id IS NOT NULL
      AND p.deletion_requested_at IS NOT NULL
      -- Don't process COPPA deletions (they're handled separately)
      AND (p.coppa_deleted IS NULL OR p.coppa_deleted = false)
    ORDER BY p.deletion_grace_period_ends_at ASC;
END;
$$;
```

### Step 4: Set Up Scheduled Job

**Recommended: Use Supabase Cron to Call Edge Function Directly**

Supabase now supports scheduling Edge Functions directly. Go to **Database** → **Cron Jobs** in Supabase Dashboard:

1. Create a new cron job:
   - **Schedule:** `0 2 * * *` (runs daily at 2 AM UTC)
   - **Command:** 
     ```sql
     SELECT net.http_post(
       url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/process-expired-deletions',
       headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
     );
     ```
   - **Description:** "Process expired account deletions after 30-day grace period"
   - Replace `YOUR_PROJECT_REF` with your Supabase project reference
   - Replace `YOUR_SERVICE_ROLE_KEY` with your service role key (found in Settings → API)

**Alternative: Using pg_cron (if extension is enabled)**

```sql
-- Enable pg_cron extension (if not already enabled)
-- This may require superuser access
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule daily job to call Edge Function
SELECT cron.schedule(
  'process-expired-account-deletions',
  '0 2 * * *',  -- Daily at 2 AM UTC
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/process-expired-deletions',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
  );
  $$
);
```

**Note:** The Edge Function `process-expired-deletions` handles ALL cleanup (people table, updates, storage, auth.users) in one go, so no separate TypeScript service is needed.

### Step 5: Manual Testing

After deploying, test the Edge Function:

```bash
# Test with curl (replace with your project URL and anon key)
curl -X POST \
  'https://your-project-ref.supabase.co/functions/v1/delete-user' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"user_id": "test-user-id-here"}'
```

**Note:** The Edge Function will return an error if the user doesn't exist, which is expected for testing. Use a real user_id from your auth.users table for successful testing.

### Security Notes

1. **Service Role Key:** The Edge Function uses `SUPABASE_SERVICE_ROLE_KEY` which bypasses RLS. This is necessary to delete from `auth.users`.

2. **Idempotency:** The function handles "user not found" errors gracefully, making it safe to call multiple times.

3. **Authorization:** Consider adding additional authorization checks in the Edge Function if you want to restrict who can call it (e.g., only from specific services).

### Rollback

If you need to rollback:

```sql
-- Remove cron job
SELECT cron.unschedule('process-expired-account-deletions');

-- Remove SQL helper function (optional)
DROP FUNCTION IF EXISTS get_expired_deletions();

-- Delete Edge Functions via Supabase CLI
supabase functions delete delete-user
supabase functions delete process-expired-deletions
```

## Architecture Overview

**Flow for Account Deletion:**

1. **User Requests Deletion** → `requestAccountDeletion()` sets grace period (30 days)
2. **During Grace Period** → User can cancel via `cancelAccountDeletion()`
3. **After Grace Period** → Scheduled job calls `process-expired-deletions` Edge Function
4. **Edge Function Does Complete Cleanup:**
   - Deletes updates and photos (if `delete_profile`)
   - Deletes person photos from storage
   - Cleans people table (converts to shadow profile)
   - Deletes `auth.users` record (permanent - user can't sign in)

**Why Two Edge Functions?**

- `delete-user`: Simple, focused function for deleting a single `auth.users` record. Used by `processAccountDeletion()` when called immediately (non-grace-period deletions).
- `process-expired-deletions`: Comprehensive function that handles expired grace periods with full cleanup. Used by scheduled jobs.

This separation allows flexibility: immediate deletions can use `delete-user` via the TypeScript service, while scheduled jobs use the comprehensive `process-expired-deletions` function.
