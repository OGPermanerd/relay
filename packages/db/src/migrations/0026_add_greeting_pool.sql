ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS greeting_pool JSONB;
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS greeting_pool_generated_at TIMESTAMPTZ;
