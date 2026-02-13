BEGIN;

-- Allow 'invited' status for staff (created but not yet verified/activated).
ALTER TABLE company_users DROP CONSTRAINT IF EXISTS company_users_status_check;
ALTER TABLE company_users ADD CONSTRAINT company_users_status_check
  CHECK (status IN ('invited', 'active', 'inactive'));

COMMIT;
