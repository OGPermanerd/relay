-- Create skill_messages table for author-to-author grouping proposals
CREATE TABLE IF NOT EXISTS skill_messages (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id),
  from_user_id text NOT NULL REFERENCES users(id),
  to_user_id text NOT NULL REFERENCES users(id),
  subject_skill_id text NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  proposed_parent_skill_id text REFERENCES skills(id) ON DELETE SET NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);

-- Indexes
CREATE INDEX IF NOT EXISTS skill_messages_to_user_idx ON skill_messages(to_user_id);
CREATE INDEX IF NOT EXISTS skill_messages_tenant_id_idx ON skill_messages(tenant_id);
CREATE INDEX IF NOT EXISTS skill_messages_from_user_idx ON skill_messages(from_user_id);

-- RLS
ALTER TABLE skill_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON skill_messages
  AS RESTRICTIVE FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));
