-- RLS Policies for Updates Table
-- Run this SQL in your Supabase SQL Editor

-- Policy: Users can INSERT their own updates
CREATE POLICY "Users can create their own updates" ON updates
  FOR INSERT 
  WITH CHECK (created_by = auth.uid());

-- Policy: Users can SELECT updates they created OR updates for people they have access to
-- (For now, we'll allow users to see updates for people they created)
CREATE POLICY "Users can view their own updates" ON updates
  FOR SELECT 
  USING (
    created_by = auth.uid() 
    OR person_id IN (
      SELECT id FROM people WHERE created_by = auth.uid()
    )
  );

-- Policy: Users can UPDATE updates they created
CREATE POLICY "Users can update their own updates" ON updates
  FOR UPDATE 
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- Policy: Users can DELETE updates they created
CREATE POLICY "Users can delete their own updates" ON updates
  FOR DELETE 
  USING (created_by = auth.uid());

-- RLS Policies for Update Tags Table

-- Policy: Users can INSERT tags for updates they created
CREATE POLICY "Users can create tags for their updates" ON update_tags
  FOR INSERT 
  WITH CHECK (
    update_id IN (
      SELECT id FROM updates WHERE created_by = auth.uid()
    )
  );

-- Policy: Users can SELECT tags for updates they can see
CREATE POLICY "Users can view tags for their updates" ON update_tags
  FOR SELECT 
  USING (
    update_id IN (
      SELECT user_id FROM updates 
      WHERE created_by = auth.uid() 
      OR user_id IN (
        SELECT user_id FROM people WHERE created_by = auth.uid()
      )
    )
  );

-- Policy: Users can DELETE tags for updates they created
CREATE POLICY "Users can delete tags for their updates" ON update_tags
  FOR DELETE 
  USING (
    update_id IN (
      SELECT id FROM updates WHERE created_by = auth.uid()
    )
  );
