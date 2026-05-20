/*
  # Add signing_workflow and workflow_state columns (safe migration)

  - Adds `signing_workflow` jsonb to `form_templates` if not exists
  - Adds `workflow_state` jsonb to `submissions` if not exists
  - Adds any missing RLS policies for user_roles
*/

-- signing_workflow column on form_templates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'form_templates' AND column_name = 'signing_workflow'
  ) THEN
    ALTER TABLE form_templates ADD COLUMN signing_workflow jsonb;
  END IF;
END $$;

-- workflow_state column on submissions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'submissions' AND column_name = 'workflow_state'
  ) THEN
    ALTER TABLE submissions ADD COLUMN workflow_state jsonb;
  END IF;
END $$;

-- Ensure super_admin update policy exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'user_roles' AND policyname = 'Super admins can update roles'
  ) THEN
    CREATE POLICY "Super admins can update roles"
      ON user_roles FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM user_roles ur
          WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin'
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM user_roles ur
          WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin'
        )
      );
  END IF;
END $$;

-- Ensure super_admin delete policy exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'user_roles' AND policyname = 'Super admins can delete roles'
  ) THEN
    CREATE POLICY "Super admins can delete roles"
      ON user_roles FOR DELETE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM user_roles ur
          WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin'
        )
      );
  END IF;
END $$;
