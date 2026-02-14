-- Add AI-generated skill summary fields
ALTER TABLE skills ADD COLUMN IF NOT EXISTS inputs TEXT[] DEFAULT '{}';
ALTER TABLE skills ADD COLUMN IF NOT EXISTS outputs TEXT[] DEFAULT '{}';
ALTER TABLE skills ADD COLUMN IF NOT EXISTS activities_saved TEXT[] DEFAULT '{}';
