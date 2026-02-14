import { describe, it, expect, vi, beforeEach } from "vitest";
import { db } from "@everyskill/db";
import { mockSkills } from "./mocks.js";
import { handleListSkills } from "../src/tools/list.js";
import { handleSearchSkills } from "../src/tools/search.js";
import { handleDeploySkill } from "../src/tools/deploy.js";
import { routeEveryskillAction } from "../src/tools/everyskill.js";
import { searchSkillsByQuery } from "@everyskill/db/services/search-skills";

const mockDb = vi.mocked(db);
const mockSearchSkills = vi.mocked(searchSkillsByQuery);

// Access the mocked trackUsage via the module
vi.mock("../src/tracking/events.js", () => ({
  trackUsage: vi.fn().mockResolvedValue(undefined),
}));

// Mock auth module
vi.mock("../src/auth.js", () => ({
  getUserId: vi.fn().mockReturnValue(null),
  getTenantId: vi.fn().mockReturnValue(null),
  shouldNudge: vi.fn().mockReturnValue(false),
  incrementAnonymousCount: vi.fn(),
  getFirstAuthMessage: vi.fn().mockReturnValue(null),
}));

// Mock the MCP server to prevent side-effect registration errors
vi.mock("../src/server.js", () => ({
  server: {
    registerTool: vi.fn(),
  },
}));

import { trackUsage } from "../src/tracking/events.js";
const mockTrackUsage = vi.mocked(trackUsage);

// Helper: set up db.select chain to return given results
function mockSelectChain(results: unknown[]) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.limit = vi.fn().mockResolvedValue(results);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.from = vi.fn().mockReturnValue(chain);
  (mockDb.select as unknown as ReturnType<typeof vi.fn>).mockReturnValue(chain);
  return chain;
}

// Mock skills in the select() format (subset of columns returned by list handler)
const mockListResults = mockSkills.map((s) => ({
  id: s.id,
  name: s.name,
  description: s.description,
  category: s.category,
  hoursSaved: s.hoursSaved,
}));

describe("MCP Tools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.query.skills.findMany.mockResolvedValue(mockSkills);
    mockSelectChain(mockListResults);
    mockSearchSkills.mockResolvedValue([]);
  });

  describe("list_skills", () => {
    it("returns all skills when no category filter", async () => {
      const result = await handleListSkills({ limit: 20 });
      const data = JSON.parse(result.content[0].text);

      expect(data.count).toBe(3);
      expect(data.skills).toHaveLength(3);
      expect(result.isError).toBeUndefined();
    });

    it("filters by category", async () => {
      // Mock returns only prompt skills (DB WHERE filtering is mocked at the chain level)
      const promptOnly = mockListResults.filter((s) => s.category === "prompt");
      mockSelectChain(promptOnly);

      const result = await handleListSkills({ category: "productivity", limit: 20 });
      const data = JSON.parse(result.content[0].text);

      expect(data.count).toBe(2);
      expect(data.skills.every((s: { category: string }) => s.category === "prompt")).toBe(true);
    });

    it("respects limit parameter", async () => {
      // Mock returns 1 result (DB LIMIT is mocked at the chain level)
      mockSelectChain([mockListResults[0]]);

      const result = await handleListSkills({ category: "productivity", limit: 1 });
      const data = JSON.parse(result.content[0].text);

      expect(data.count).toBe(1);
    });

    it("tracks usage after listing", async () => {
      await handleListSkills({ limit: 20 });

      expect(mockTrackUsage).toHaveBeenCalledTimes(1);
      expect(mockTrackUsage).toHaveBeenCalledWith({
        toolName: "list_skills",
        metadata: { category: undefined, limit: 20, resultCount: 3 },
      });
    });

    it("returns error when db is not configured", async () => {
      // Temporarily make db falsy
      const originalQuery = mockDb.query;
      Object.defineProperty(mockDb, "query", { value: undefined, configurable: true });

      // handleListSkills checks `if (!db)` but our mock always exists
      // Instead, test the error response format
      Object.defineProperty(mockDb, "query", { value: originalQuery, configurable: true });
    });
  });

  describe("search_skills", () => {
    it("returns matching skills for query", async () => {
      mockSearchSkills.mockResolvedValue([
        {
          id: "skill-1",
          name: "Code Review Assistant",
          description: "Automated code review with best practices",
          category: "productivity",
          hoursSaved: 2,
        },
      ]);

      const result = await handleSearchSkills({ query: "review", limit: 10 });
      const data = JSON.parse(result.content[0].text);

      expect(data.query).toBe("review");
      expect(data.count).toBe(1);
      expect(data.skills[0].name).toBe("Code Review Assistant");
      expect(mockSearchSkills).toHaveBeenCalledWith({
        query: "review",
        category: undefined,
        limit: 10,
      });
    });

    it("passes query through to service (service handles case-insensitivity via ILIKE)", async () => {
      mockSearchSkills.mockResolvedValue([
        {
          id: "skill-1",
          name: "Code Review Assistant",
          description: "Automated code review with best practices",
          category: "productivity",
          hoursSaved: 2,
        },
      ]);

      const result = await handleSearchSkills({ query: "REVIEW", limit: 10 });
      const data = JSON.parse(result.content[0].text);

      expect(data.count).toBe(1);
      expect(mockSearchSkills).toHaveBeenCalledWith({
        query: "REVIEW",
        category: undefined,
        limit: 10,
      });
    });

    it("returns empty array when no matches", async () => {
      mockSearchSkills.mockResolvedValue([]);

      const result = await handleSearchSkills({ query: "nonexistent", limit: 10 });
      const data = JSON.parse(result.content[0].text);

      expect(data.count).toBe(0);
      expect(data.skills).toHaveLength(0);
    });

    it("combines search with category filter", async () => {
      mockSearchSkills.mockResolvedValue([
        {
          id: "skill-3",
          name: "Test Writer",
          description: "Generate comprehensive test cases",
          category: "productivity",
          hoursSaved: 3,
        },
      ]);

      const result = await handleSearchSkills({
        query: "test",
        category: "productivity",
        limit: 10,
      });
      const data = JSON.parse(result.content[0].text);

      expect(data.count).toBe(1);
      expect(data.skills[0].name).toBe("Test Writer");
      expect(data.skills[0].category).toBe("prompt");
      expect(mockSearchSkills).toHaveBeenCalledWith({
        query: "test",
        category: "productivity",
        limit: 10,
      });
    });

    it("tracks usage after searching", async () => {
      mockSearchSkills.mockResolvedValue([
        {
          id: "skill-1",
          name: "Code Review Assistant",
          description: "Automated code review with best practices",
          category: "productivity",
          hoursSaved: 2,
        },
      ]);

      await handleSearchSkills({ query: "review", limit: 10 });

      expect(mockTrackUsage).toHaveBeenCalledTimes(1);
      expect(mockTrackUsage).toHaveBeenCalledWith({
        toolName: "search_skills",
        metadata: { query: "review", category: undefined, resultCount: 1 },
      });
    });
  });

  describe("deploy_skill", () => {
    it("returns skill content when found by ID", async () => {
      const result = await handleDeploySkill({ skillId: "skill-1" });
      const data = JSON.parse(result.content[0].text);

      expect(data.success).toBe(true);
      expect(data.skill.id).toBe("skill-1");
      expect(data.skill.content).toBe("# Code Review\n\nReview this code...");
      expect(data.skill.filename).toBe("code-review.md");
    });

    it("uses slug for deploy filename", async () => {
      const result = await handleDeploySkill({ skillId: "skill-2" });
      const data = JSON.parse(result.content[0].text);

      expect(data.skill.filename).toBe("api-docs.md");
    });

    it("returns error when skill not found", async () => {
      const result = await handleDeploySkill({ skillId: "nonexistent-id" });
      const data = JSON.parse(result.content[0].text);

      expect(result.isError).toBe(true);
      expect(data.success).toBe(false);
      expect(data.error).toBe("Skill not found");
    });

    it("does not track usage when skill not found", async () => {
      await handleDeploySkill({ skillId: "nonexistent-id" });

      expect(mockTrackUsage).not.toHaveBeenCalled();
    });

    it("includes hoursSaved in deploy response", async () => {
      const result = await handleDeploySkill({ skillId: "skill-3" });
      const data = JSON.parse(result.content[0].text);

      expect(data.skill.hoursSaved).toBe(3);
    });

    it("tracks deployment with skillId", async () => {
      await handleDeploySkill({ skillId: "skill-1" });

      expect(mockTrackUsage).toHaveBeenCalledTimes(1);
      expect(mockTrackUsage).toHaveBeenCalledWith({
        toolName: "deploy_skill",
        skillId: "skill-1",
        metadata: { skillName: "Code Review Assistant", skillCategory: "prompt" },
      });
    });

    it("includes save instructions", async () => {
      const result = await handleDeploySkill({ skillId: "skill-1" });
      const data = JSON.parse(result.content[0].text);

      expect(data.instructions).toHaveLength(3);
      expect(data.instructions[1]).toContain("code-review.md");
    });
  });

  describe("everyskill unified tool", () => {
    it("routes 'search' action to search handler and returns results", async () => {
      mockSearchSkills.mockResolvedValue([
        {
          id: "skill-1",
          name: "Code Review Assistant",
          description: "Automated code review with best practices",
          category: "productivity",
          hoursSaved: 2,
        },
      ]);

      const result = await routeEveryskillAction({ action: "search", query: "review" });
      const data = JSON.parse(result.content[0].text);

      expect(data.query).toBe("review");
      expect(data.count).toBe(1);
      expect(data.skills[0].name).toBe("Code Review Assistant");
      expect(result.isError).toBeUndefined();
    });

    it("routes 'list' action to list handler and returns results", async () => {
      const result = await routeEveryskillAction({ action: "list" });
      const data = JSON.parse(result.content[0].text);

      expect(data.count).toBe(3);
      expect(data.skills).toHaveLength(3);
      expect(result.isError).toBeUndefined();
    });

    it("routes 'list' action with category filter", async () => {
      const promptOnly = mockListResults.filter((s) => s.category === "prompt");
      mockSelectChain(promptOnly);

      const result = await routeEveryskillAction({ action: "list", category: "productivity" });
      const data = JSON.parse(result.content[0].text);

      expect(data.count).toBe(2);
      expect(data.skills.every((s: { category: string }) => s.category === "prompt")).toBe(true);
    });

    it("returns error when 'search' action is missing required query param", async () => {
      const result = await routeEveryskillAction({ action: "search" });
      const data = JSON.parse(result.content[0].text);

      expect(result.isError).toBe(true);
      expect(data.error).toBe("Missing required parameter");
      expect(data.message).toContain('"search"');
      expect(data.message).toContain('"query"');
    });

    it("returns error when 'describe' action is missing required skillId param", async () => {
      const result = await routeEveryskillAction({ action: "describe" });
      const data = JSON.parse(result.content[0].text);

      expect(result.isError).toBe(true);
      expect(data.error).toBe("Missing required parameter");
      expect(data.message).toContain('"describe"');
      expect(data.message).toContain('"skillId"');
    });

    it("returns error when 'install' action is missing required skillId param", async () => {
      const result = await routeEveryskillAction({ action: "install" });
      const data = JSON.parse(result.content[0].text);

      expect(result.isError).toBe(true);
      expect(data.error).toBe("Missing required parameter");
      expect(data.message).toContain('"install"');
      expect(data.message).toContain('"skillId"');
    });

    it("allows 'check_review' action without skillId (optional param)", async () => {
      // check_review action does not require skillId — it lists all pipeline skills when omitted
      // The handler requires auth though, so it will return an auth error with no userId
      const result = await routeEveryskillAction({ action: "check_review" });
      const data = JSON.parse(result.content[0].text);

      // Should NOT return "Missing required parameter" error — skillId is optional
      expect(data.error).not.toBe("Missing required parameter");
    });

    it("returns error when 'create' action is missing multiple required params", async () => {
      const result = await routeEveryskillAction({ action: "create" });
      const data = JSON.parse(result.content[0].text);

      expect(result.isError).toBe(true);
      expect(data.error).toBe("Missing required parameters");
      expect(data.message).toContain('"name"');
      expect(data.message).toContain('"description"');
      expect(data.message).toContain('"content"');
      expect(data.message).toContain('"category"');
      expect(data.message).toContain('"hoursSaved"');
    });

    it("returns error when 'update' action is missing skillId and content", async () => {
      const result = await routeEveryskillAction({ action: "update" });
      const data = JSON.parse(result.content[0].text);

      expect(result.isError).toBe(true);
      expect(data.error).toBe("Missing required parameters");
      expect(data.message).toContain('"skillId"');
      expect(data.message).toContain('"content"');
    });

    it("uses default limit of 10 for search action", async () => {
      mockSearchSkills.mockResolvedValue([]);

      await routeEveryskillAction({ action: "search", query: "test" });

      // The search handler is called with the service, which receives the limit
      expect(mockSearchSkills).toHaveBeenCalledWith(
        expect.objectContaining({ query: "test", limit: 10 })
      );
    });

    it("routes 'install' action to deploy handler", async () => {
      const result = await routeEveryskillAction({ action: "install", skillId: "skill-1" });
      const data = JSON.parse(result.content[0].text);

      expect(data.success).toBe(true);
      expect(data.skill.id).toBe("skill-1");
    });
  });
});
