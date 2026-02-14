-- Add allow_skill_download toggle to site_settings
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS allow_skill_download BOOLEAN NOT NULL DEFAULT true;
