CREATE TABLE IF NOT EXISTS resume_shares (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  include_company_skills BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP,
  revoked_at TIMESTAMP
);

CREATE INDEX idx_resume_shares_token ON resume_shares(token);
CREATE INDEX idx_resume_shares_user_id ON resume_shares(user_id);
