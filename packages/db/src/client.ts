/**
 * Database client setup with Drizzle ORM
 *
 * Uses globalThis to cache the postgres client across Next.js hot reloads
 * in development. Without this, each hot reload creates a new connection
 * pool, eventually exhausting PostgreSQL's connection limit.
 */

import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import * as relations from "./relations";

type SchemaType = typeof schema & typeof relations;

const globalForDb = globalThis as unknown as {
  _pgClient?: ReturnType<typeof postgres>;
  _drizzle?: PostgresJsDatabase<SchemaType>;
};

// Connection string from environment
const connectionString = process.env.DATABASE_URL;

// Default tenant ID used during single-tenant phase.
// Phase 26+ will resolve tenant from session/subdomain and use withTenant() instead.
export const DEFAULT_TENANT_ID = "default-tenant-000-0000-000000000000";

function createClient() {
  if (!connectionString) return { client: null, drizzleDb: null };

  // Reuse cached client in development to prevent connection exhaustion
  if (globalForDb._pgClient && globalForDb._drizzle) {
    return { client: globalForDb._pgClient, drizzleDb: globalForDb._drizzle };
  }

  const client = postgres(connectionString, {
    // Set default tenant context on every new connection so RLS policies work
    // during single-tenant phase. Each connection starts with this setting.
    onnotice: () => {},
    connection: {
      "app.current_tenant_id": DEFAULT_TENANT_ID,
    },
  });
  const drizzleDb = drizzle(client, { schema: { ...schema, ...relations } });

  globalForDb._pgClient = client;
  globalForDb._drizzle = drizzleDb;

  return { client, drizzleDb };
}

const { drizzleDb } = createClient();

export const db = drizzleDb;

// Helper for checking database connection
export function isDatabaseConfigured(): boolean {
  return !!connectionString && !!db;
}
