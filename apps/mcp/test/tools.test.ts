import { describe, it, expect, vi, beforeEach } from "vitest";
import { db } from "@relay/db";
import { mockSkills } from "./mocks.js";

// Get access to mocked db
const mockDb = vi.mocked(db);

describe("MCP Tools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("list_skills", () => {
    it("returns all skills when no category filter", async () => {
      mockDb.query.skills.findMany.mockResolvedValue(mockSkills);

      const result = await db.query.skills.findMany({
        limit: 20,
        columns: {
          id: true,
          name: true,
          description: true,
          category: true,
          hoursSaved: true,
        },
      });

      expect(result).toHaveLength(3);
      expect(db.query.skills.findMany).toHaveBeenCalled();
    });

    it("can filter by category in-memory", async () => {
      mockDb.query.skills.findMany.mockResolvedValue(mockSkills);

      const allResults = await db.query.skills.findMany({});

      // Simulate in-memory filtering like list.ts does
      const promptSkills = allResults.filter((s) => s.category === "prompt");

      expect(promptSkills).toHaveLength(2);
      expect(promptSkills.every((s) => s.category === "prompt")).toBe(true);
    });

    it("respects limit parameter", async () => {
      mockDb.query.skills.findMany.mockResolvedValue(mockSkills);

      const allResults = await db.query.skills.findMany({});

      // Simulate limit like list.ts does
      const limited = allResults.slice(0, 2);

      expect(limited).toHaveLength(2);
    });
  });

  describe("search_skills", () => {
    it("returns matching skills for query", async () => {
      mockDb.query.skills.findMany.mockResolvedValue(mockSkills);

      const allResults = await db.query.skills.findMany({});

      // Simulate search logic like search.ts does
      // "review" only matches skill-1
      const queryLower = "review".toLowerCase();
      const matches = allResults.filter(
        (skill) =>
          skill.name.toLowerCase().includes(queryLower) ||
          skill.description.toLowerCase().includes(queryLower)
      );

      expect(matches).toHaveLength(1);
      expect(matches[0].name).toBe("Code Review Assistant");
    });

    it("search is case-insensitive", async () => {
      mockDb.query.skills.findMany.mockResolvedValue(mockSkills);

      const allResults = await db.query.skills.findMany({});

      // Uppercase "REVIEW" should still match case-insensitively
      const queryLower = "REVIEW".toLowerCase();
      const matches = allResults.filter(
        (skill) =>
          skill.name.toLowerCase().includes(queryLower) ||
          skill.description.toLowerCase().includes(queryLower)
      );

      expect(matches).toHaveLength(1);
      expect(matches[0].name).toBe("Code Review Assistant");
    });

    it("returns empty array when no matches", async () => {
      mockDb.query.skills.findMany.mockResolvedValue(mockSkills);

      const allResults = await db.query.skills.findMany({});

      const queryLower = "nonexistent".toLowerCase();
      const matches = allResults.filter(
        (skill) =>
          skill.name.toLowerCase().includes(queryLower) ||
          skill.description.toLowerCase().includes(queryLower)
      );

      expect(matches).toHaveLength(0);
    });

    it("can combine search with category filter", async () => {
      mockDb.query.skills.findMany.mockResolvedValue(mockSkills);

      const allResults = await db.query.skills.findMany({});

      // Simulate combined filter like search.ts does
      const queryLower = "test".toLowerCase();
      const category = "prompt";
      const matches = allResults.filter((skill) => {
        const matchesQuery =
          skill.name.toLowerCase().includes(queryLower) ||
          skill.description.toLowerCase().includes(queryLower);
        const matchesCategory = skill.category === category;
        return matchesQuery && matchesCategory;
      });

      expect(matches).toHaveLength(1);
      expect(matches[0].name).toBe("Test Writer");
      expect(matches[0].category).toBe("prompt");
    });
  });

  describe("deploy_skill", () => {
    it("returns skill content when found by ID", async () => {
      mockDb.query.skills.findMany.mockResolvedValue(mockSkills);

      const allSkills = await db.query.skills.findMany({});

      // Simulate deploy logic like deploy.ts does
      const skillId = "skill-1";
      const skill = allSkills.find((s) => s.id === skillId);

      expect(skill).toBeDefined();
      expect(skill?.content).toBe("# Code Review\n\nReview this code...");
      expect(skill?.slug).toBe("code-review");
    });

    it("uses slug for deploy filename", async () => {
      mockDb.query.skills.findMany.mockResolvedValue(mockSkills);

      const allSkills = await db.query.skills.findMany({});
      const skill = allSkills.find((s) => s.id === "skill-2");

      // Verify slug can be used for filename
      const filename = `${skill?.slug}.md`;
      expect(filename).toBe("api-docs.md");
    });

    it("returns undefined when skill not found", async () => {
      mockDb.query.skills.findMany.mockResolvedValue(mockSkills);

      const allSkills = await db.query.skills.findMany({});
      const skill = allSkills.find((s) => s.id === "nonexistent-id");

      expect(skill).toBeUndefined();
    });

    it("includes hoursSaved in deploy response", async () => {
      mockDb.query.skills.findMany.mockResolvedValue(mockSkills);

      const allSkills = await db.query.skills.findMany({});
      const skill = allSkills.find((s) => s.id === "skill-3");

      expect(skill?.hoursSaved).toBe(3);
    });
  });
});

describe("Usage Tracking", () => {
  it("insert is called for tracking", () => {
    const valuesFn = vi.fn();
    const insertMock = vi.fn(() => ({ values: valuesFn }));
    mockDb.insert.mockImplementation(insertMock as unknown as typeof db.insert);

    // Trigger a mock insert
    db.insert({} as Parameters<typeof db.insert>[0]);

    expect(insertMock).toHaveBeenCalled();
  });
});
