# Account Deletion Deployment Checklist

This checklist ensures you've completed all steps to enable full account deletion (including auth.users cleanup) for App Store compliance.

## ✅ Step 1: Fix Parameter Mismatch (Already Done)
- [x] Updated `account-api.ts` to use `type_input` instead of `deletion_type_input`

## 📋 Step 2: Create SQL Helper Function

**Action:** Go to Supabase Dashboard → SQL Editor and run this:

```sql
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

**Verify:** Check that the function was created successfully in Database → Functions.

## 📋 Step 3: Deploy Edge Functions

**Action:** In your terminal, run:

```bash
# Make sure you're in the FamilyTreeApp directory
cd FamilyTreeApp

# Login to Supabase (if not already)
supabase login

# Link to your project (if not already linked)
supabase link --project-ref YOUR_PROJECT_REF

# Deploy the delete-user function (for immediate deletions)
supabase functions deploy delete-user

# Deploy the process-expired-deletions function (for scheduled cleanup)
supabase functions deploy process-expired-deletions
```

**Verify:** Check Supabase Dashboard → Edge Functions to see both functions listed.

## 📋 Step 4: Set Up Scheduled Job

**Action:** Go to Supabase Dashboard → Database → Cron Jobs

1. Click "Create a new cron job"
2. Configure:
   - **Name:** `process-expired-account-deletions`
   - **Schedule:** `0 2 * * *` (Daily at 2 AM UTC)
   - **Command:** 
     ```sql
     SELECT net.http_post(
       url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/process-expired-deletions',
       headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
     );
     ```
   - Replace `YOUR_PROJECT_REF` with your actual project reference (find it in Settings → API → Project URL)
   - Replace `YOUR_SERVICE_ROLE_KEY` with your service role key (Settings → API → service_role key - **keep this secret!**)

**Verify:** The cron job should appear in the list and run daily.

## 🧪 Step 5: Test the Flow

### Test 1: Request Account Deletion
1. Open your app
2. Go to Settings → Delete Account
3. Request deletion (should set 30-day grace period)
4. Verify: Check `people` table - `deletion_requested_at` and `deletion_grace_period_ends_at` should be set

### Test 2: Manual Edge Function Test (Optional)
Test the Edge Function directly before waiting 30 days:

```bash
# Get your anon key from Supabase Dashboard → Settings → API
curl -X POST \
  'https://YOUR_PROJECT_REF.supabase.co/functions/v1/process-expired-deletions' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json'
```

Should return: `{"success":true,"processed_count":0,"message":"No expired deletions to process"}` (unless you manually set a grace period to expire)

### Test 3: Immediate Deletion (After Grace Period)
To test without waiting 30 days, manually expire a grace period in the database:

```sql
-- Set grace period to yesterday (for testing only)
UPDATE people 
SET deletion_grace_period_ends_at = NOW() - INTERVAL '1 day'
WHERE linked_auth_user_id = 'USER_ID_TO_TEST';
```

Then call the Edge Function manually or wait for the cron job to run.

## ✅ Verification Checklist

- [ ] SQL function `get_expired_deletions()` created and visible in Database → Functions
- [ ] Edge Function `delete-user` deployed and visible in Edge Functions
- [ ] Edge Function `process-expired-deletions` deployed and visible
- [ ] Cron job created and scheduled for daily execution
- [ ] Test: Account deletion request works (grace period set)
- [ ] Test: Edge Function can be invoked manually (returns success)

## 🔒 Security Notes

- **Service Role Key:** Never commit your service role key to git. It's only used in:
  - Edge Functions (automatically injected by Supabase)
  - Cron job SQL (stored securely in Supabase database)
- **Edge Functions:** Both functions use service_role key internally (automatically available)
- **RLS:** The SQL function uses `SECURITY DEFINER` to bypass RLS (safe because it's read-only)

## 📝 Next Steps After Deployment

1. Monitor the cron job execution logs in Supabase Dashboard
2. Check Edge Function logs for any errors
3. Verify deleted accounts can't sign in again (test with a deleted Google account)
4. Confirm storage bucket cleanup is working (check that photos are removed)

---

**Status:** Ready to execute! Follow steps 2-4 above.
