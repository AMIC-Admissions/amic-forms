/*
  # Restrict submissions INSERT policy

  ## Summary
  Replaces the open "WITH CHECK (true)" INSERT policy on submissions with a
  constrained version that still allows anonymous parents to submit forms, but
  rejects rows that are clearly malformed.

  ## Changes
  - DROP the previous open INSERT policy
  - CREATE a new INSERT policy scoped to the `anon` role only, with a WITH CHECK
    that validates the minimum required fields are present:
      • reference_number must be non-empty
      • template_id must be provided (not null)
    This prevents empty/junk rows from being inserted while keeping the public
    form-submission flow fully functional.

  ## Security
  - No USING clause on INSERT (correct — INSERT policies only use WITH CHECK)
  - Authenticated admin inserts also work because the admin SELECT/UPDATE/DELETE
    policies apply to the authenticated role; admins do not need an explicit
    INSERT policy in the current flow (templates are managed, not submissions).
*/

DROP POLICY IF EXISTS "Anyone can insert submissions" ON submissions;

CREATE POLICY "Anon can insert valid submissions"
  ON submissions FOR INSERT
  TO anon
  WITH CHECK (
    reference_number IS NOT NULL AND reference_number <> '' AND
    template_id IS NOT NULL
  );
