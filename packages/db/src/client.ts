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

function createClient() {
  if (!connectionString) return { client: null, drizzleDb: null };

  // Reuse cached client in development to prevent connection exhaustion
  if (globalForDb._pgClient && globalForDb._drizzle) {
    return { client: globalForDb._pgClient, drizzleDb: globalForDb._drizzle };
  }

  const client = postgres(connectionString);
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
