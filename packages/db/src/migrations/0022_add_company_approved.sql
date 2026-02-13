ALTER TABLE skills ADD COLUMN company_approved BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE skills ADD COLUMN approved_at TIMESTAMP;
ALTER TABLE skills ADD COLUMN approved_by TEXT REFERENCES users(id);
CREATE INDEX skills_company_approved_idx ON skills (company_approved) WHERE company_approved = true;
