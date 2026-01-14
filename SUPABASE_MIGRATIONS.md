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
