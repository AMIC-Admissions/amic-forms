/*
  # Harden RLS: role-safe admin access + safer storage policies

  ## Goals
  - Enforce role-based access for admin writes (not just authenticated user)
  - Prevent self-escalation in `user_roles`
  - Keep public form submission flow working
  - Tighten anonymous storage uploads to expected path format
*/

-- ------------------------------------------------------------
-- Role helpers
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.has_any_role(required_roles text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = ANY(required_roles)
  );
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_any_role(ARRAY['super_admin']);
$$;

-- ------------------------------------------------------------
-- user_roles policies (remove escalation paths)
-- ------------------------------------------------------------

DROP POLICY IF EXISTS "Super admin can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Super admin can update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Super admin can delete roles" ON public.user_roles;
DROP POLICY IF EXISTS "Super admins can update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Super admins can delete roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can insert own initial role" ON public.user_roles;

-- Only super_admin can manage other users' roles.
CREATE POLICY "Super admin can insert roles"
  ON public.user_roles FOR INSERT
  TO authenticated
  WITH CHECK (public.is_super_admin());

CREATE POLICY "Super admin can update roles"
  ON public.user_roles FOR UPDATE
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "Super admin can delete roles"
  ON public.user_roles FOR DELETE
  TO authenticated
  USING (public.is_super_admin());

-- Optional self-bootstrap as staff only (no privilege escalation).
CREATE POLICY "Users can insert own initial staff role"
  ON public.user_roles FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND role = 'staff'
    AND NOT EXISTS (
      SELECT 1 FROM public.user_roles me WHERE me.user_id = auth.uid()
    )
  );

-- ------------------------------------------------------------
-- form_templates policies
-- ------------------------------------------------------------

DROP POLICY IF EXISTS "Authenticated users can insert templates" ON public.form_templates;
DROP POLICY IF EXISTS "Authenticated users can update templates" ON public.form_templates;
DROP POLICY IF EXISTS "Authenticated users can delete templates" ON public.form_templates;
DROP POLICY IF EXISTS "Admin can insert templates" ON public.form_templates;
DROP POLICY IF EXISTS "Admin can update templates" ON public.form_templates;
DROP POLICY IF EXISTS "Admin can delete templates" ON public.form_templates;

CREATE POLICY "Admin can insert templates"
  ON public.form_templates FOR INSERT
  TO authenticated
  WITH CHECK (public.has_any_role(ARRAY['admin','super_admin']));

CREATE POLICY "Admin can update templates"
  ON public.form_templates FOR UPDATE
  TO authenticated
  USING (public.has_any_role(ARRAY['admin','super_admin']))
  WITH CHECK (public.has_any_role(ARRAY['admin','super_admin']));

CREATE POLICY "Admin can delete templates"
  ON public.form_templates FOR DELETE
  TO authenticated
  USING (public.has_any_role(ARRAY['admin','super_admin']));

-- ------------------------------------------------------------
-- school_settings policies
-- ------------------------------------------------------------

DROP POLICY IF EXISTS "Authenticated users can insert settings" ON public.school_settings;
DROP POLICY IF EXISTS "Authenticated users can update settings" ON public.school_settings;
DROP POLICY IF EXISTS "Authenticated users can delete settings" ON public.school_settings;
DROP POLICY IF EXISTS "Admin can insert settings" ON public.school_settings;
DROP POLICY IF EXISTS "Admin can update settings" ON public.school_settings;
DROP POLICY IF EXISTS "Admin can delete settings" ON public.school_settings;

CREATE POLICY "Admin can insert settings"
  ON public.school_settings FOR INSERT
  TO authenticated
  WITH CHECK (public.has_any_role(ARRAY['admin','super_admin']));

CREATE POLICY "Admin can update settings"
  ON public.school_settings FOR UPDATE
  TO authenticated
  USING (public.has_any_role(ARRAY['admin','super_admin']))
  WITH CHECK (public.has_any_role(ARRAY['admin','super_admin']));

CREATE POLICY "Admin can delete settings"
  ON public.school_settings FOR DELETE
  TO authenticated
  USING (public.has_any_role(ARRAY['admin','super_admin']));

-- ------------------------------------------------------------
-- submissions policies
-- ------------------------------------------------------------

DROP POLICY IF EXISTS "Authenticated users can update submissions" ON public.submissions;
DROP POLICY IF EXISTS "Authenticated users can delete submissions" ON public.submissions;
DROP POLICY IF EXISTS "Admin can read all submissions" ON public.submissions;
DROP POLICY IF EXISTS "Admin can update submissions" ON public.submissions;
DROP POLICY IF EXISTS "Admin can delete submissions" ON public.submissions;

CREATE POLICY "Staff+ can read submissions"
  ON public.submissions FOR SELECT
  TO authenticated
  USING (public.has_any_role(ARRAY['staff','admin','super_admin']));

CREATE POLICY "Admin can update submissions"
  ON public.submissions FOR UPDATE
  TO authenticated
  USING (public.has_any_role(ARRAY['admin','super_admin']))
  WITH CHECK (public.has_any_role(ARRAY['admin','super_admin']));

CREATE POLICY "Admin can delete submissions"
  ON public.submissions FOR DELETE
  TO authenticated
  USING (public.has_any_role(ARRAY['admin','super_admin']));

-- ------------------------------------------------------------
-- storage.objects policies
-- ------------------------------------------------------------

DROP POLICY IF EXISTS "Anyone can upload signed PDFs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read signed PDFs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete signed PDFs" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete attachments" ON storage.objects;

-- Keep anon upload for public form flow, but require expected path format:
-- {ref}/{filename}
CREATE POLICY "Public can upload signed PDFs with valid path"
  ON storage.objects FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    bucket_id = 'signed-pdfs'
    AND name ~ '^[^/]+/[^/].+$'
  );

CREATE POLICY "Admin can read signed PDFs"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'signed-pdfs'
    AND public.has_any_role(ARRAY['staff','admin','super_admin'])
  );

CREATE POLICY "Admin can delete signed PDFs"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'signed-pdfs'
    AND public.has_any_role(ARRAY['admin','super_admin'])
  );

-- Keep anon upload for public form flow, with path format:
-- {ref}/{slot}/{filename}
CREATE POLICY "Public can upload attachments with valid path"
  ON storage.objects FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    bucket_id = 'attachments'
    AND name ~ '^[^/]+/[^/]+/[^/].+$'
  );

CREATE POLICY "Admin can read attachments"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'attachments'
    AND public.has_any_role(ARRAY['staff','admin','super_admin'])
  );

CREATE POLICY "Admin can delete attachments"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'attachments'
    AND public.has_any_role(ARRAY['admin','super_admin'])
  );
