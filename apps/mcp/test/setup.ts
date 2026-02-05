import { vi } from "vitest";

// Mock the database module
vi.mock("@relay/db", () => ({
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
vi.mock("@relay/db/schema/usage-events", () => ({
  usageEvents: { toolName: "tool_name", skillId: "skill_id" },
}));

// Mock the skill metrics service
vi.mock("@relay/db/services/skill-metrics", () => ({
  incrementSkillUses: vi.fn(),
}));
