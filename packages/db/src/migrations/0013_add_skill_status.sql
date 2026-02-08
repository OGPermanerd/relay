-- Add status column to skills table
-- DEFAULT 'published' ensures existing skills remain visible
-- New skills will explicitly set status='draft' in application code
ALTER TABLE skills ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'published';

-- Index for efficient filtering on status
CREATE INDEX IF NOT EXISTS skills_status_idx ON skills (status);

-- Composite index for author + status queries (My Skills page)
CREATE INDEX IF NOT EXISTS skills_author_status_idx ON skills (author_id, status);
