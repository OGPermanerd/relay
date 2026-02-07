-- Create tenants table
CREATE TABLE IF NOT EXISTS tenants (
	id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
	name text NOT NULL,
	slug text NOT NULL UNIQUE,
	domain text,
	logo text,
	is_active boolean NOT NULL DEFAULT true,
	plan text NOT NULL DEFAULT 'freemium',
	created_at timestamp NOT NULL DEFAULT now(),
	updated_at timestamp NOT NULL DEFAULT now()
);

-- Seed a default tenant for backfilling existing data
INSERT INTO tenants (id, name, slug, domain)
VALUES ('default-tenant-000-0000-000000000000', 'Default', 'default', NULL)
ON CONFLICT (slug) DO NOTHING;
