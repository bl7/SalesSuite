-- Add cancel audit fields to orders (cancelled_at, cancelled_by, cancel_reason, cancel_note)
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_by_company_user_id UUID,
  ADD COLUMN IF NOT EXISTS cancel_reason TEXT,
  ADD COLUMN IF NOT EXISTS cancel_note TEXT;

ALTER TABLE orders
  DROP CONSTRAINT IF EXISTS fk_orders_cancelled_by;
ALTER TABLE orders
  ADD CONSTRAINT fk_orders_cancelled_by
  FOREIGN KEY (company_id, cancelled_by_company_user_id)
  REFERENCES company_users(company_id, id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_cancelled_at
  ON orders (company_id, cancelled_at) WHERE cancelled_at IS NOT NULL;
