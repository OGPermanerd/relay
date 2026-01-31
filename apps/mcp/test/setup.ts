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
