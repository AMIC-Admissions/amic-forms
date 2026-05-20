/*
  # Create Storage Buckets for Signed PDFs and Attachments

  ## Summary
  Sets up two private Supabase Storage buckets to replace base64 blob storage
  in the database with efficient file storage URLs.

  ## New Buckets
  - `signed-pdfs` — stores completed signed PDF files per submission
    - Path pattern: {reference_number}/{filename}-signed.pdf
  - `attachments` — stores form attachment files per submission
    - Path pattern: {reference_number}/{slot_id}/{filename}

  ## Security Model
  Both buckets are private (not publicly listed). Policies allow:
  - Anonymous users can INSERT (upload) — needed during form submission (unauthenticated)
  - Authenticated admins can SELECT (read/download)
  - Authenticated admins can DELETE (cleanup)

  ## Notes
  - signature_data and pdf_data (template base64) are NOT migrated — they stay in DB
  - Existing rows are unaffected; old base64 values in signed_pdf_data remain readable
    as a fallback until naturally replaced by new submissions
*/

-- Create signed-pdfs bucket (private)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'signed-pdfs',
  'signed-pdfs',
  false,
  52428800,  -- 50MB limit
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Create attachments bucket (private)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'attachments',
  'attachments',
  false,
  20971520,  -- 20MB limit
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/jpg', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- ────────────────────────────────────────────────
-- signed-pdfs policies
-- ────────────────────────────────────────────────

-- Anyone (including anon) can upload signed PDFs during form submission
CREATE POLICY "Anyone can upload signed PDFs"
  ON storage.objects
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'signed-pdfs');

-- Authenticated admins can read signed PDFs
CREATE POLICY "Authenticated users can read signed PDFs"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'signed-pdfs');

-- Authenticated admins can delete signed PDFs
CREATE POLICY "Authenticated users can delete signed PDFs"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'signed-pdfs');

-- ────────────────────────────────────────────────
-- attachments policies
-- ────────────────────────────────────────────────

-- Anyone (including anon) can upload attachments during form submission
CREATE POLICY "Anyone can upload attachments"
  ON storage.objects
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'attachments');

-- Authenticated admins can read attachments
CREATE POLICY "Authenticated users can read attachments"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'attachments');

-- Authenticated admins can delete attachments
CREATE POLICY "Authenticated users can delete attachments"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'attachments');
