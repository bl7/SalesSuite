BEGIN;

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS address TEXT NOT NULL DEFAULT '';

COMMENT ON COLUMN companies.address IS 'Company address (required on signup).';

COMMIT;
