/*
  # Appearance, Roles, and Sequential Signing

  1. Changes to school_settings
     - Already exists; new keys will be inserted via upsert:
       - `hero_bg_image`: base64 background image for landing page hero
       - `logo_size`: 'sm' | 'md' | 'lg' for logo display size

  2. New Tables
     - `user_roles`: Maps auth.users to role ('super_admin','admin','staff')
       - id (uuid, pk)
       - user_id (uuid, FK to auth.users, unique)
       - role (text, CHECK constraint)
       - created_at (timestamptz)

  3. Columns added to form_templates
     - `signing_workflow` (jsonb): { type: 'single'|'sequential', signers: [...] }

  4. Columns added to submissions
     - `workflow_state` (jsonb): { current_step: 0, steps: [...] }

  5. Security
     - RLS enabled on user_roles
     - Authenticated users can read all roles
     - Only super_admin can write roles
*/

-- user_roles table
CREATE TABLE IF NOT EXISTS user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('super_admin', 'admin', 'staff')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read roles"
  ON user_roles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Super admin can insert roles"
  ON user_roles FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'super_admin'
    )
  );

CREATE POLICY "Super admin can update roles"
  ON user_roles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'super_admin'
    )
  );

CREATE POLICY "Super admin can delete roles"
  ON user_roles FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'super_admin'
    )
  );

-- Allow new authenticated users to insert their own initial role
CREATE POLICY "Users can insert own initial role"
  ON user_roles FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- signing_workflow on form_templates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'form_templates' AND column_name = 'signing_workflow'
  ) THEN
    ALTER TABLE form_templates
      ADD COLUMN signing_workflow jsonb NOT NULL DEFAULT '{"type":"single","signers":[]}';
  END IF;
END $$;

-- workflow_state on submissions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'submissions' AND column_name = 'workflow_state'
  ) THEN
    ALTER TABLE submissions
      ADD COLUMN workflow_state jsonb NOT NULL DEFAULT '{"current_step":0,"steps":[]}';
  END IF;
END $$;
