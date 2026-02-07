import { vi } from "vitest";

// Mock the database module
vi.mock("@everyskill/db", () => ({
  db: {
    query: {
      skills: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
      },
    },
    insert: vi.fn(() => ({
      values: vi.fn(),
    })),
  },
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
