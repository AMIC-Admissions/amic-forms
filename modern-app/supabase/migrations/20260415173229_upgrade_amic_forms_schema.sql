/*
  # Upgrade AMIC Forms Schema

  ## Summary
  Extends the existing schema to support:
  - Full field type set (text, textarea, checkbox, dropdown, yesno, and existing types)
  - Per-field unique IDs for named data storage (not just field type as key)
  - Conditional logic rules on form fields
  - Required attachment definitions per template
  - Excel/webhook URL per template for submission sync
  - Signed PDF stored in database (not just localStorage)
  - Excel sync status per submission

  ## Modified Tables

  ### form_templates
  - `required_attachments` (jsonb) - Array of {id, label, labelAr, required} objects
  - `excel_webhook_url` (text) - Power Automate / webhook URL for Excel sync

  ### submissions
  - `signed_pdf_data` (text) - Base64 signed PDF stored in DB
  - `excel_synced` (boolean) - Whether submission was synced to Excel

  ## Notes
  - All changes use IF NOT EXISTS / conditional DDL to be safe
  - No data is dropped or altered
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'form_templates' AND column_name = 'required_attachments'
  ) THEN
    ALTER TABLE form_templates ADD COLUMN required_attachments jsonb NOT NULL DEFAULT '[]';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'form_templates' AND column_name = 'excel_webhook_url'
  ) THEN
    ALTER TABLE form_templates ADD COLUMN excel_webhook_url text NOT NULL DEFAULT '';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'submissions' AND column_name = 'signed_pdf_data'
  ) THEN
    ALTER TABLE submissions ADD COLUMN signed_pdf_data text DEFAULT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'submissions' AND column_name = 'excel_synced'
  ) THEN
    ALTER TABLE submissions ADD COLUMN excel_synced boolean NOT NULL DEFAULT false;
  END IF;
END $$;
