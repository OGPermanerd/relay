ALTER TABLE skill_communities
  ADD COLUMN IF NOT EXISTS community_label TEXT,
  ADD COLUMN IF NOT EXISTS community_description TEXT;
