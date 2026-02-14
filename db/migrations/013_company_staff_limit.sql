BEGIN;

-- Plan limit: company can have (staff_limit + 1) users total — 1 manager + staff_limit staff (reps, back_office, etc.).
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS staff_limit INTEGER NOT NULL DEFAULT 5;

COMMENT ON COLUMN companies.staff_limit IS 'Max staff slots (reps, back_office, etc.). Total users allowed = staff_limit + 1 (the +1 is for manager).';

COMMIT;
