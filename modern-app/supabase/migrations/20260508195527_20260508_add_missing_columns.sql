/*
  # Add missing columns to submissions and form_templates

  ## Summary
  Adds several columns that are referenced in the codebase but may not exist in all
  database instances, using safe IF NOT EXISTS guards throughout.

  ## Changes

  ### submissions table
  - `signed_pdf_data` (text) — stores the base64-encoded signed PDF generated after form submission
  - `signer_email` (text) — email of the person who signed the form
  - `audit_log` (jsonb) — array of audit events (status changes, signature events, etc.)

  ### form_templates table
  - `required_attachments` (jsonb) — array of required attachment slot definitions
  - `excel_webhook_url` (text) — Power Automate webhook URL for Excel sync

  ## Notes
  - All columns use safe defaults so existing rows are not affected
  - No data is dropped or modified
*/

DO $$
BEGIN
  -- submissions: signed_pdf_data
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'submissions' AND column_name = 'signed_pdf_data'
  ) THEN
    ALTER TABLE submissions ADD COLUMN signed_pdf_data text;
  END IF;

  -- submissions: signer_email
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'submissions' AND column_name = 'signer_email'
  ) THEN
    ALTER TABLE submissions ADD COLUMN signer_email text DEFAULT '';
  END IF;

  -- submissions: audit_log
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'submissions' AND column_name = 'audit_log'
  ) THEN
    ALTER TABLE submissions ADD COLUMN audit_log jsonb DEFAULT '[]';
  END IF;

  -- form_templates: required_attachments
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'form_templates' AND column_name = 'required_attachments'
  ) THEN
    ALTER TABLE form_templates ADD COLUMN required_attachments jsonb DEFAULT '[]';
  END IF;

  -- form_templates: excel_webhook_url
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'form_templates' AND column_name = 'excel_webhook_url'
  ) THEN
    ALTER TABLE form_templates ADD COLUMN excel_webhook_url text DEFAULT '';
  END IF;
END $$;
