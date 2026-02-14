BEGIN;

-- Platform bosses: separate from company users; simple email + password, no email verification.
-- Used for overhead dashboard: view companies, staff counts; can add more bosses.
CREATE TABLE IF NOT EXISTS bosses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email CITEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bosses_email ON bosses (email);

DROP TRIGGER IF EXISTS trg_bosses_updated_at ON bosses;
CREATE TRIGGER trg_bosses_updated_at
BEFORE UPDATE ON bosses
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

COMMIT;
