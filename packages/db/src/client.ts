/**
 * Database client setup with Drizzle ORM
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Connection string from environment
const connectionString = process.env.DATABASE_URL;

// Create postgres client (lazy initialization)
const client = connectionString ? postgres(connectionString) : null;

// Create drizzle instance with schema for type-safe queries
export const db = client ? drizzle(client, { schema }) : null;

// Helper for checking database connection
export function isDatabaseConfigured(): boolean {
  return !!connectionString && !!client;
}
