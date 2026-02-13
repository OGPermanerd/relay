-- Add visibility column: "tenant" (visible to all org members) or "personal" (author only)
ALTER TABLE skills ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'tenant';

-- Index for efficient filtering on visibility
CREATE INDEX IF NOT EXISTS skills_visibility_idx ON skills (visibility);

-- Composite index for personal skill lookups (visibility + author_id)
CREATE INDEX IF NOT EXISTS skills_visibility_author_idx ON skills (visibility, author_id);
