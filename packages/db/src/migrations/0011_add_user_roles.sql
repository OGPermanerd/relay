-- Add user_role enum and role column to users table
-- Backfills first user per tenant as admin, rest as member

-- 1. Create enum type (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('admin', 'member');
  END IF;
END
$$;

-- 2. Add role column with default 'member' (idempotent)
ALTER TABLE users ADD COLUMN IF NOT EXISTS role user_role NOT NULL DEFAULT 'member';

-- 3. Backfill: first user per tenant (by created_at) becomes admin
WITH first_users AS (
  SELECT DISTINCT ON (tenant_id) id
  FROM users
  ORDER BY tenant_id, created_at ASC
)
UPDATE users
SET role = 'admin'
FROM first_users
WHERE users.id = first_users.id
  AND users.role = 'member';
