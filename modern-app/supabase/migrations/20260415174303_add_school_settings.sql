/*
  # School Settings Table

  ## Summary
  Creates a key-value settings table to store school-wide configuration like the logo.

  ## New Tables
  - `school_settings`
    - `key` (text, primary key) - setting name
    - `value` (text) - setting value (may be base64 for logo)
    - `updated_at` (timestamptz)

  ## Security
  - RLS enabled
  - Anyone can read settings (needed to show logo on public pages)
  - Only authenticated users (admin) can insert/update/delete settings
*/

CREATE TABLE IF NOT EXISTS school_settings (
  key text PRIMARY KEY,
  value text NOT NULL DEFAULT '',
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE school_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read settings"
  ON school_settings FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert settings"
  ON school_settings FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update settings"
  ON school_settings FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete settings"
  ON school_settings FOR DELETE
  TO authenticated
  USING (true);
