-- Fix saved_projects table to remove foreign key constraint for demo usage

-- Drop existing foreign key constraint if it exists
ALTER TABLE saved_projects DROP CONSTRAINT IF EXISTS saved_projects_user_id_fkey;

-- Drop existing RLS policies
DROP POLICY IF EXISTS "Users can view their own saved projects" ON saved_projects;
DROP POLICY IF EXISTS "Users can insert their own saved projects" ON saved_projects;
DROP POLICY IF EXISTS "Users can update their own saved projects" ON saved_projects;
DROP POLICY IF EXISTS "Users can delete their own saved projects" ON saved_projects;
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON saved_projects;

-- Create new permissive RLS policy for demo usage
CREATE POLICY "Allow all operations for demo" ON saved_projects
    FOR ALL USING (true) WITH CHECK (true);

-- Grant necessary permissions
GRANT ALL ON saved_projects TO authenticated;
GRANT ALL ON saved_projects TO anon;
