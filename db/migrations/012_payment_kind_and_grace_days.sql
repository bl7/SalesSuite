BEGIN;

-- Grace and complimentary extensions: record type and support adding days (not just months).
ALTER TABLE company_payments
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'payment'
    CHECK (kind IN ('payment', 'grace', 'complimentary')),
  ADD COLUMN IF NOT EXISTS days_added INTEGER CHECK (days_added IS NULL OR days_added > 0);

-- Allow grace entries that only add days (months_added = 0). Existing rows keep months_added > 0.
ALTER TABLE company_payments DROP CONSTRAINT IF EXISTS company_payments_months_added_check;
ALTER TABLE company_payments ADD CONSTRAINT company_payments_months_non_negative
  CHECK (months_added >= 0);
ALTER TABLE company_payments ADD CONSTRAINT company_payments_has_extension
  CHECK (months_added > 0 OR (days_added IS NOT NULL AND days_added > 0));

COMMENT ON COLUMN company_payments.kind IS 'payment = paid; grace = extra days; complimentary = e.g. month on us.';
COMMENT ON COLUMN company_payments.days_added IS 'When set, subscription extended by this many days (used for grace/complimentary).';

COMMIT;
