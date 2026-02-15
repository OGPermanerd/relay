-- Enable advanced features by default for all tenants
-- These were previously opt-in but should be on by default

-- Update existing rows
UPDATE site_settings SET
  semantic_similarity_enabled = true,
  gmail_diagnostic_enabled = true,
  training_data_capture_enabled = true
WHERE semantic_similarity_enabled = false
   OR gmail_diagnostic_enabled = false
   OR training_data_capture_enabled = false;

-- Change column defaults for new tenants
ALTER TABLE site_settings
  ALTER COLUMN semantic_similarity_enabled SET DEFAULT true;

ALTER TABLE site_settings
  ALTER COLUMN gmail_diagnostic_enabled SET DEFAULT true;

ALTER TABLE site_settings
  ALTER COLUMN training_data_capture_enabled SET DEFAULT true;
