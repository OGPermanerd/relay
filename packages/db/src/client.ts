/**
 * Database client setup with Drizzle ORM
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import * as relations from "./relations";

// Connection string from environment
const connectionString = process.env.DATABASE_URL;

// Create postgres client (lazy initialization)
const client = connectionString ? postgres(connectionString) : null;

// Create drizzle instance with schema AND relations for type-safe queries
// Merging schema and relations enables db.query.* relational queries
export const db = client ? drizzle(client, { schema: { ...schema, ...relations } }) : null;

// Helper for checking database connection
export function isDatabaseConfigured(): boolean {
  return !!connectionString && !!client;
}
