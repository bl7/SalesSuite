BEGIN;

-- Manual subscription: you add months when payment is received; access is blocked when subscription_ends_at is past or suspended.
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS subscription_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS subscription_suspended BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN companies.subscription_ends_at IS 'Access allowed until this time (inclusive). NULL = no subscription / treat as expired until first payment.';
COMMENT ON COLUMN companies.subscription_suspended IS 'If true, access blocked regardless of subscription_ends_at (e.g. manual halt).';

-- Audit log for manual payments: record when you add months so you have a trail.
CREATE TABLE IF NOT EXISTS company_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  months_added INTEGER NOT NULL CHECK (months_added > 0),
  amount_notes TEXT,
  recorded_by_boss_id UUID REFERENCES bosses(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_company_payments_company ON company_payments (company_id);
CREATE INDEX IF NOT EXISTS idx_company_payments_created ON company_payments (created_at DESC);

COMMIT;
