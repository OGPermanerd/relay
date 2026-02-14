/**
 * Custom migration runner.
 *
 * Reads *.sql files from src/migrations/, tracks applied ones in an
 * _applied_migrations table, and applies any that haven't run yet.
 *
 * Replaces `drizzle-kit migrate` which only tracks migrations in its own
 * meta/_journal.json and skips hand-crafted SQL files.
 *
 * Usage: tsx src/migrate.ts
 */

import postgres from "postgres";
import { readdir, readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, "migrations");

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL is not set");
    process.exit(1);
  }

  const sql = postgres(connectionString, { max: 1, onnotice: () => {} });

  try {
    // Ensure tracking table exists
    await sql`
      CREATE TABLE IF NOT EXISTS _applied_migrations (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    // Get already-applied migrations
    const applied = await sql<{ name: string }[]>`
      SELECT name FROM _applied_migrations ORDER BY name
    `;
    const appliedSet = new Set(applied.map((r) => r.name));

    // List SQL files sorted by name (numeric prefix ensures order)
    const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith(".sql")).sort();

    let count = 0;
    for (const file of files) {
      if (appliedSet.has(file)) continue;

      const filePath = join(MIGRATIONS_DIR, file);
      const sqlContent = await readFile(filePath, "utf-8");

      console.log(`Applying ${file}...`);
      await sql.begin(async (tx) => {
        await tx.unsafe(sqlContent);
        await tx`INSERT INTO _applied_migrations (name) VALUES (${file})`;
      });
      count++;
    }

    if (count === 0) {
      console.log("No new migrations to apply.");
    } else {
      console.log(`Applied ${count} migration${count > 1 ? "s" : ""}.`);
    }
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
