-- Migration 0008: Add vanity_domain column to tenants
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenants' AND column_name = 'vanity_domain'
  ) THEN
    ALTER TABLE tenants ADD COLUMN vanity_domain TEXT UNIQUE;
  END IF;
END $$;
