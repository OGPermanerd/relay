-- Migration 0007: Add per-tenant API key expiry configuration
-- SOC2-05: Default 90-day expiry, configurable per tenant

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'site_settings' AND column_name = 'key_expiry_days'
  ) THEN
    ALTER TABLE site_settings ADD COLUMN key_expiry_days INTEGER NOT NULL DEFAULT 90;
  END IF;
END $$;
