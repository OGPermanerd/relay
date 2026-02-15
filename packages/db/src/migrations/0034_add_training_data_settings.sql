ALTER TABLE site_settings
  ADD COLUMN IF NOT EXISTS training_data_capture_enabled BOOLEAN NOT NULL DEFAULT false;
