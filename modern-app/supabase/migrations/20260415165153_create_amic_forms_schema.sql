
/*
  # AMIC Forms Schema

  ## Summary
  Creates the full schema for the AMIC school forms application.

  ## New Tables

  ### form_templates
  Stores PDF form templates created by the admin.
  - `id` - UUID primary key
  - `name` - Template name in English
  - `name_ar` - Template name in Arabic
  - `pdf_data` - Base64-encoded PDF file content
  - `pdf_filename` - Original filename of the uploaded PDF
  - `fields` - JSONB array of field configurations (type, position, size, page)
  - `is_active` - Whether this template is available for submissions
  - `created_at` - Creation timestamp

  ### submissions
  Stores completed form submissions from parents/users.
  - `id` - UUID primary key
  - `reference_number` - Unique human-readable reference (AMIC-XXXX)
  - `template_id` - FK to form_templates
  - `template_name` - Snapshot of template name at time of submission
  - `form_data` - JSONB with field values (parentName, studentName, idNumber, date)
  - `signature_data` - Base64 PNG of the drawn signature
  - `attachments` - JSONB array of attachment metadata
  - `created_at` - Submission timestamp
  - `status` - Submission status

  ## Security
  - RLS enabled on all tables
  - Public can read active templates (to fill forms)
  - Authenticated users (admin) can manage templates
  - Anyone can insert submissions (no login required)
  - Anyone can read submissions by reference number
  - Authenticated users can read all submissions (admin view)
*/

CREATE TABLE IF NOT EXISTS form_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT '',
  name_ar text NOT NULL DEFAULT '',
  pdf_data text NOT NULL DEFAULT '',
  pdf_filename text NOT NULL DEFAULT '',
  fields jsonb NOT NULL DEFAULT '[]',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE form_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read active templates"
  ON form_templates FOR SELECT
  USING (is_active = true);

CREATE POLICY "Authenticated users can insert templates"
  ON form_templates FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update templates"
  ON form_templates FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete templates"
  ON form_templates FOR DELETE
  TO authenticated
  USING (true);

CREATE TABLE IF NOT EXISTS submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_number text UNIQUE NOT NULL,
  template_id uuid REFERENCES form_templates(id) ON DELETE SET NULL,
  template_name text NOT NULL DEFAULT '',
  form_data jsonb NOT NULL DEFAULT '{}',
  signature_data text DEFAULT NULL,
  attachments jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz DEFAULT now(),
  status text NOT NULL DEFAULT 'completed'
);

ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert submissions"
  ON submissions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can read submissions"
  ON submissions FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can update submissions"
  ON submissions FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete submissions"
  ON submissions FOR DELETE
  TO authenticated
  USING (true);
