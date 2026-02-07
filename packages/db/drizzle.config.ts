import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: "../../.env.local" });

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema/index.ts",
  out: "./src/migrations",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  entities: {
    roles: true,
  },
});
