import { vi } from "vitest";

// Chain builder for db.select().from().where().limit() — returns empty array by default
function createSelectChain(results: unknown[] = []) {
  const chain: Record<string, unknown> = {};
  chain.limit = vi.fn().mockResolvedValue(results);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.from = vi.fn().mockReturnValue(chain);
  return chain;
}

// Mock the database module
vi.mock("@everyskill/db", () => ({
  db: {
    query: {
      skills: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
      },
    },
    select: vi.fn(() => createSelectChain()),
    insert: vi.fn(() => ({
      values: vi.fn(),
    })),
  },
  DEFAULT_TENANT_ID: "default-tenant-000-0000-000000000000",
}));

// Mock the usage events schema
vi.mock("@everyskill/db/schema/usage-events", () => ({
  usageEvents: { toolName: "tool_name", skillId: "skill_id" },
}));

// Mock the skill metrics service
vi.mock("@everyskill/db/services/skill-metrics", () => ({
  incrementSkillUses: vi.fn(),
}));

// Mock the search-skills service
vi.mock("@everyskill/db/services/search-skills", () => ({
  searchSkillsByQuery: vi.fn(),
}));
