-- Create digest_frequency enum for notification preferences
DO $$ BEGIN
  CREATE TYPE digest_frequency AS ENUM ('none', 'daily', 'weekly');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id),
  user_id text NOT NULL REFERENCES users(id),
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  action_url text,
  metadata text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);

-- Indexes for notifications
CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON notifications(user_id);
CREATE INDEX IF NOT EXISTS notifications_tenant_id_idx ON notifications(tenant_id);
CREATE INDEX IF NOT EXISTS notifications_user_unread_idx ON notifications(user_id, is_read);

-- RLS for notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY tenant_isolation ON notifications
    AS RESTRICTIVE FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true))
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create notification_preferences table
CREATE TABLE IF NOT EXISTS notification_preferences (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id),
  user_id text NOT NULL UNIQUE REFERENCES users(id),
  grouping_proposal_email boolean NOT NULL DEFAULT true,
  grouping_proposal_in_app boolean NOT NULL DEFAULT true,
  trending_digest digest_frequency NOT NULL DEFAULT 'weekly',
  platform_updates_email boolean NOT NULL DEFAULT true,
  platform_updates_in_app boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for notification_preferences
CREATE INDEX IF NOT EXISTS notification_preferences_tenant_id_idx ON notification_preferences(tenant_id);

-- RLS for notification_preferences
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY tenant_isolation ON notification_preferences
    AS RESTRICTIVE FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true))
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
