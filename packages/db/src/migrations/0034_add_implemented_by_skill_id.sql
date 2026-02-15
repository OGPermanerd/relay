-- Add implemented_by_skill_id column to skill_feedback for suggestion-to-fork traceability
ALTER TABLE skill_feedback ADD COLUMN implemented_by_skill_id TEXT REFERENCES skills(id);
CREATE INDEX skill_feedback_implemented_by_idx ON skill_feedback(implemented_by_skill_id);
