import { describe, it, expect, vi, beforeEach } from "vitest";
import { db } from "@everyskill/db";
import { trackUsage } from "../src/tracking/events.js";
import { incrementSkillUses } from "@everyskill/db/services/skill-metrics";

const mockDb = vi.mocked(db);
const mockIncrementSkillUses = vi.mocked(incrementSkillUses);

describe("trackUsage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset insert mock to return chainable .values()
    mockDb.insert.mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    } as unknown as ReturnType<typeof db.insert>);
    mockIncrementSkillUses.mockResolvedValue(undefined);
  });

  it("inserts usage event into database", async () => {
    const event = {
      toolName: "list_skills",
      metadata: { category: "productivity", limit: 20, resultCount: 3 },
    };

    await trackUsage(event);

    expect(mockDb.insert).toHaveBeenCalledTimes(1);
    const valuesCall = mockDb.insert.mock.results[0].value.values;
    expect(valuesCall).toHaveBeenCalledWith(event);
  });

  it("calls incrementSkillUses when skillId is provided", async () => {
    const event = {
      toolName: "deploy_skill",
      skillId: "skill-1",
      metadata: { skillName: "Code Review" },
    };

    await trackUsage(event);

    expect(mockIncrementSkillUses).toHaveBeenCalledTimes(1);
    expect(mockIncrementSkillUses).toHaveBeenCalledWith("skill-1");
  });

  it("does NOT call incrementSkillUses when no skillId", async () => {
    const event = {
      toolName: "list_skills",
      metadata: { resultCount: 5 },
    };

    await trackUsage(event);

    expect(mockIncrementSkillUses).not.toHaveBeenCalled();
  });

  it("does not throw when db.insert fails", async () => {
    mockDb.insert.mockReturnValue({
      values: vi.fn().mockRejectedValue(new Error("Connection refused")),
    } as unknown as ReturnType<typeof db.insert>);

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(trackUsage({ toolName: "list_skills", metadata: {} })).resolves.toBeUndefined();

    expect(consoleSpy).toHaveBeenCalledWith("Failed to track usage:", expect.any(Error));
    consoleSpy.mockRestore();
  });

  it("tracks search_skills with query metadata", async () => {
    const event = {
      toolName: "search_skills",
      metadata: { query: "review", category: undefined, resultCount: 1 },
    };

    await trackUsage(event);

    expect(mockDb.insert).toHaveBeenCalledTimes(1);
    const valuesCall = mockDb.insert.mock.results[0].value.values;
    expect(valuesCall).toHaveBeenCalledWith(event);
    expect(mockIncrementSkillUses).not.toHaveBeenCalled();
  });

  it("tracks deploy_skill with skillId and increments uses", async () => {
    const event = {
      toolName: "deploy_skill",
      skillId: "skill-3",
      metadata: { skillName: "Test Writer", skillCategory: "prompt" },
    };

    await trackUsage(event);

    expect(mockDb.insert).toHaveBeenCalledTimes(1);
    const valuesCall = mockDb.insert.mock.results[0].value.values;
    expect(valuesCall).toHaveBeenCalledWith(event);
    expect(mockIncrementSkillUses).toHaveBeenCalledWith("skill-3");
  });
});
