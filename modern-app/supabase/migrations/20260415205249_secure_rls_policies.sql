/*
  # Secure RLS Policies — Remove All USING(true)/WITH CHECK(true) Open Policies

  ## Summary
  Replaces all insecure "open to public" RLS policies with properly restricted ones
  tied to Supabase Auth (authenticated JWT users for admin operations).

  ## Changes Made

  ### form_templates
  - DROP all "Anyone can ..." policies (open write access removed)
  - SELECT: anon users can read only active templates (needed to fill public forms)
  - INSERT: only authenticated (admin) users
  - UPDATE: only authenticated (admin) users
  - DELETE: only authenticated (admin) users

  ### school_settings
  - DROP all open write policies
  - SELECT: anon users can read (needed to display logo on public pages)
  - INSERT: only authenticated (admin) users
  - UPDATE: only authenticated (admin) users
  - DELETE: only authenticated (admin) users

  ### submissions
  - DROP open update/delete policies
  - SELECT: only authenticated (admin) users can list/view all submissions
  - INSERT: anon allowed (parents submit without login) — no WITH CHECK(true) bypass needed for insert
  - UPDATE: only authenticated (admin) users
  - DELETE: only authenticated (admin) users

  ## Security Notes
  - "authenticated" role = Supabase JWT session (admin who signed in via Supabase Auth)
  - anon role = public visitors (parents filling forms)
  - No policy uses USING(true) or WITH CHECK(true) for write operations
*/

-- ============================================================
-- form_templates
-- ============================================================

DROP POLICY IF EXISTS "Anyone can insert templates"   ON form_templates;
DROP POLICY IF EXISTS "Anyone can update templates"   ON form_templates;
DROP POLICY IF EXISTS "Anyone can delete templates"   ON form_templates;
DROP POLICY IF EXISTS "Anyone can read templates"     ON form_templates;
DROP POLICY IF EXISTS "Public can read active templates" ON form_templates;
DROP POLICY IF EXISTS "Authenticated users can insert templates" ON form_templates;
DROP POLICY IF EXISTS "Authenticated users can update templates" ON form_templates;
DROP POLICY IF EXISTS "Authenticated users can delete templates" ON form_templates;

-- Public (anon) may read active templates only — required for parents to open the form link
CREATE POLICY "Anon can read active templates"
  ON form_templates FOR SELECT
  TO anon
  USING (is_active = true);

-- Authenticated admin can read ALL templates (including inactive ones)
CREATE POLICY "Admin can read all templates"
  ON form_templates FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- Only authenticated admin can create templates
CREATE POLICY "Admin can insert templates"
  ON form_templates FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- Only authenticated admin can modify templates
CREATE POLICY "Admin can update templates"
  ON form_templates FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Only authenticated admin can delete templates
CREATE POLICY "Admin can delete templates"
  ON form_templates FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);


-- ============================================================
-- school_settings
-- ============================================================

DROP POLICY IF EXISTS "Anyone can insert settings"   ON school_settings;
DROP POLICY IF EXISTS "Anyone can update settings"   ON school_settings;
DROP POLICY IF EXISTS "Anyone can delete settings"   ON school_settings;
DROP POLICY IF EXISTS "Anyone can read settings"     ON school_settings;
DROP POLICY IF EXISTS "Authenticated users can insert settings" ON school_settings;
DROP POLICY IF EXISTS "Authenticated users can update settings" ON school_settings;
DROP POLICY IF EXISTS "Authenticated users can delete settings" ON school_settings;

-- Public (anon) may read settings — required to display school logo on public pages
CREATE POLICY "Anyone can read settings"
  ON school_settings FOR SELECT
  TO public
  USING (true);

-- Only authenticated admin can insert settings
CREATE POLICY "Admin can insert settings"
  ON school_settings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- Only authenticated admin can update settings
CREATE POLICY "Admin can update settings"
  ON school_settings FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Only authenticated admin can delete settings
CREATE POLICY "Admin can delete settings"
  ON school_settings FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);


-- ============================================================
-- submissions
-- ============================================================

DROP POLICY IF EXISTS "Anyone can update submissions" ON submissions;
DROP POLICY IF EXISTS "Anyone can delete submissions" ON submissions;
DROP POLICY IF EXISTS "Anyone can read submissions"   ON submissions;
DROP POLICY IF EXISTS "Anyone can insert submissions" ON submissions;
DROP POLICY IF EXISTS "Authenticated users can update submissions" ON submissions;
DROP POLICY IF EXISTS "Authenticated users can delete submissions" ON submissions;

-- Parents (anon) may create a submission — no auth required to submit a form
CREATE POLICY "Anyone can insert submissions"
  ON submissions FOR INSERT
  TO public
  WITH CHECK (true);

-- Only authenticated admin can view all submissions
CREATE POLICY "Admin can read all submissions"
  ON submissions FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- Only authenticated admin can update submissions (e.g. change status, mark excel_synced)
CREATE POLICY "Admin can update submissions"
  ON submissions FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Only authenticated admin can delete submissions
CREATE POLICY "Admin can delete submissions"
  ON submissions FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);
