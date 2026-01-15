-- Migration: Add deletion_type column to people table
-- This allows us to differentiate between 'delete_profile' and 'deactivate_profile' deletion requests
-- and filter content appropriately

-- Add deletion_type column
ALTER TABLE public.people 
  ADD COLUMN IF NOT EXISTS deletion_type TEXT CHECK (deletion_type IN ('delete_profile', 'deactivate_profile'));

-- Update the request_account_deletion function to accept and store deletion_type
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
