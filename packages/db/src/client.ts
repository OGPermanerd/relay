/**
 * Database client setup
 * Will be fully configured in Plan 02 with schema
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

// Connection string from environment
const connectionString = process.env.DATABASE_URL;

// Create postgres client (lazy initialization)
const client = connectionString ? postgres(connectionString) : null;

// Create drizzle instance (will add schema in Plan 02)
export const db = client ? drizzle(client) : null;

// Helper for checking database connection
export function isDatabaseConfigured(): boolean {
  return !!connectionString && !!client;
}
