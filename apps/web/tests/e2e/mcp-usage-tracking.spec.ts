import { test, expect } from "@playwright/test";
import { createHash } from "crypto";
import { db, users, skills } from "@everyskill/db";
import { apiKeys } from "@everyskill/db/schema/api-keys";
import { usageEvents } from "@everyskill/db/schema/usage-events";
import { eq, and, desc, gt } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Test API key — seeded before all tests in this file
// ---------------------------------------------------------------------------
const TEST_RAW_KEY = "rlk_e2e_mcp_usage_test_key_1234567890abcdef";
const TEST_KEY_HASH = createHash("sha256").update(TEST_RAW_KEY).digest("hex");
const TEST_USER_ID = "e2e-test-user";
const TEST_SKILL_ID = "mcp-usage-test-skill";
const DEFAULT_TENANT_ID = "default-tenant-000-0000-000000000000";

/** MCP JSON-RPC headers required by mcp-handler */
const mcpHeaders = {
  "Content-Type": "application/json",
  Accept: "application/json, text/event-stream",
  Authorization: `Bearer ${TEST_RAW_KEY}`,
  Origin: "https://claude.ai",
};

/**
 * Parse an SSE response body into JSON-RPC result.
 * mcp-handler returns `event: message\ndata: {...}\n\n` format.
 */
function parseSseResponse(body: string): Record<string, unknown> {
  const lines = body.split("\n");
  for (const line of lines) {
    if (line.startsWith("data: ")) {
      return JSON.parse(line.slice(6));
    }
  }
  throw new Error(`No data line found in SSE response: ${body.slice(0, 200)}`);
}

/** Send an MCP JSON-RPC request and parse the SSE response */
async function mcpRequest(
  request: {
    post: (
      url: string,
      options: Record<string, unknown>
    ) => Promise<{ status: () => number; text: () => Promise<string> }>;
  },
  body: Record<string, unknown>
) {
  const response = await request.post("/api/mcp/mcp", {
    headers: mcpHeaders,
    data: body,
  });
  const status = response.status();
  const text = await response.text();
  return { status, body: status === 200 ? parseSseResponse(text) : text };
}

test.describe("MCP Usage Tracking", () => {
  // mcp-handler@1.0.7 returns persistent 500s for authenticated tool calls in
  // Next.js dev server. The library's internal session management conflicts with
  // the dev server's module reloading. Tests pass in production builds.
  // TODO: Re-enable when mcp-handler fixes session handling or upgrade available.
  test.describe.configure({ mode: "serial" });
  test.fixme(true, "mcp-handler@1.0.7 returns 500 in Next.js dev server");

  test.beforeAll(async () => {
    if (!db) throw new Error("Database required for MCP usage tracking tests");

    // Pre-warm the MCP route to trigger Next.js dev server compilation.
    // Without this, the first real request hits a 500 during route compilation.
    const baseUrl = process.env.BASE_URL || "http://localhost:2002";
    await fetch(`${baseUrl}/api/mcp/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", method: "initialize", id: 0 }),
    }).catch(() => {});

    // Ensure test user exists
    await db
      .insert(users)
      .values({
        tenantId: DEFAULT_TENANT_ID,
        id: TEST_USER_ID,
        email: "e2e-test@company.com",
        name: "E2E Test User",
      })
      .onConflictDoUpdate({
        target: users.id,
        set: { email: "e2e-test@company.com", name: "E2E Test User" },
      });

    // Seed API key (upsert on keyHash)
    const existing = await db.query.apiKeys.findFirst({
      where: eq(apiKeys.keyHash, TEST_KEY_HASH),
    });

    if (!existing) {
      await db.insert(apiKeys).values({
        tenantId: DEFAULT_TENANT_ID,
        userId: TEST_USER_ID,
        keyHash: TEST_KEY_HASH,
        keyPrefix: TEST_RAW_KEY.slice(0, 8),
        name: "E2E MCP Test Key",
      });
    } else if (existing.revokedAt) {
      // Un-revoke if leftover from a previous run
      await db.update(apiKeys).set({ revokedAt: null }).where(eq(apiKeys.keyHash, TEST_KEY_HASH));
    }

    // Seed a test skill for deploy_skill tests
    await db
      .insert(skills)
      .values({
        tenantId: DEFAULT_TENANT_ID,
        id: TEST_SKILL_ID,
        name: "MCP Usage Test Skill",
        slug: "mcp-usage-test-skill",
        description: "A test skill for verifying MCP deploy usage tracking",
        category: "productivity",
        content: "You are a helpful test assistant. Respond concisely.",
        hoursSaved: 2,
        totalUses: 0,
        authorId: TEST_USER_ID,
      })
      .onConflictDoUpdate({
        target: skills.id,
        set: {
          name: "MCP Usage Test Skill",
          totalUses: 0, // Reset for clean test
          updatedAt: new Date(),
        },
      });
  });

  test.afterAll(async () => {
    if (!db) return;
    await db
      .update(apiKeys)
      .set({ revokedAt: new Date() })
      .where(eq(apiKeys.keyHash, TEST_KEY_HASH));
    await db.delete(skills).where(eq(skills.id, TEST_SKILL_ID));
  });

  test("should return server info via server_info tool", async ({ request }) => {
    const { status, body } = await mcpRequest(request, {
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "server_info",
        arguments: {},
      },
      id: 1,
    });

    expect(status).toBe(200);
    const result = body as Record<string, unknown>;
    expect(result.jsonrpc).toBe("2.0");
    expect(result.id).toBe(1);

    const inner = result.result as { content: { type: string; text: string }[] };
    const info = JSON.parse(inner.content[0].text);
    expect(info.name).toBe("EverySkill Skills");
    expect(info.version).toBe("1.0.0");
    expect(info.categories).toContain("productivity");
  });

  test("should log usage event when calling list_skills", async ({ request }) => {
    if (!db) throw new Error("Database required");

    // Record timestamp before the tool call
    const beforeCall = new Date();

    // Call list_skills via MCP (stateless — no init needed per request)
    const { status, body } = await mcpRequest(request, {
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "list_skills",
        arguments: { limit: 5 },
      },
      id: 2,
    });

    expect(status).toBe(200);
    const result = body as Record<string, unknown>;
    expect(result.jsonrpc).toBe("2.0");
    expect(result.id).toBe(2);

    const inner = result.result as { content: { type: string; text: string }[] };
    expect(inner.content).toBeTruthy();
    expect(inner.content.length).toBeGreaterThan(0);

    // Parse the tool output — should contain skills list
    const toolOutput = JSON.parse(inner.content[0].text);
    expect(toolOutput.count).toBeDefined();
    expect(toolOutput.skills).toBeDefined();
    expect(Array.isArray(toolOutput.skills)).toBe(true);

    // Wait for fire-and-forget tracking to complete
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Verify usage event was logged in the database
    const events = await db.query.usageEvents.findMany({
      where: and(
        eq(usageEvents.toolName, "list_skills"),
        eq(usageEvents.userId, TEST_USER_ID),
        gt(usageEvents.createdAt, beforeCall)
      ),
      orderBy: desc(usageEvents.createdAt),
      limit: 1,
    });

    expect(events.length).toBe(1);
    expect(events[0].toolName).toBe("list_skills");
    expect(events[0].userId).toBe(TEST_USER_ID);

    // Verify metadata was captured
    const metadata = events[0].metadata as Record<string, unknown>;
    expect(metadata).toBeTruthy();
    expect(metadata.limit).toBe(5);
    expect(typeof metadata.resultCount).toBe("number");
  });

  test("should log usage event when calling search_skills", async ({ request }) => {
    if (!db) throw new Error("Database required");

    const beforeCall = new Date();

    const { status, body } = await mcpRequest(request, {
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "search_skills",
        arguments: { query: "test", limit: 3 },
      },
      id: 3,
    });

    expect(status).toBe(200);
    const result = body as Record<string, unknown>;
    const inner = result.result as { content: { type: string; text: string }[] };

    const toolOutput = JSON.parse(inner.content[0].text);
    expect(toolOutput.query).toBe("test");
    expect(typeof toolOutput.count).toBe("number");

    // Wait for fire-and-forget tracking
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Verify usage event
    const events = await db.query.usageEvents.findMany({
      where: and(
        eq(usageEvents.toolName, "search_skills"),
        eq(usageEvents.userId, TEST_USER_ID),
        gt(usageEvents.createdAt, beforeCall)
      ),
      orderBy: desc(usageEvents.createdAt),
      limit: 1,
    });

    expect(events.length).toBe(1);
    expect(events[0].toolName).toBe("search_skills");

    const metadata = events[0].metadata as Record<string, unknown>;
    expect(metadata.query).toBe("test");
    expect(typeof metadata.resultCount).toBe("number");
  });

  test("should deploy a skill, log usage, and increment totalUses", async ({ request }) => {
    if (!db) throw new Error("Database required");

    // Step 1: Verify the test skill exists and record its initial totalUses
    const skillBefore = await db.query.skills.findFirst({
      where: eq(skills.id, TEST_SKILL_ID),
      columns: { id: true, totalUses: true, name: true },
    });
    expect(skillBefore).toBeTruthy();
    const usesBefore = skillBefore!.totalUses;

    const beforeCall = new Date();

    // Step 2: Deploy the skill via MCP (simulates Claude downloading it)
    const { status, body } = await mcpRequest(request, {
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "deploy_skill",
        arguments: { skillId: TEST_SKILL_ID },
      },
      id: 10,
    });

    expect(status).toBe(200);
    const result = body as Record<string, unknown>;
    expect(result.jsonrpc).toBe("2.0");
    expect(result.id).toBe(10);

    const inner = result.result as { content: { type: string; text: string }[] };
    expect(inner.content).toBeTruthy();
    expect(inner.content.length).toBeGreaterThan(0);

    // Step 3: Verify the deploy response contains the skill content
    const deployOutput = JSON.parse(inner.content[0].text);
    expect(deployOutput.success).toBe(true);
    expect(deployOutput.skill.id).toBe(TEST_SKILL_ID);
    expect(deployOutput.skill.name).toBe("MCP Usage Test Skill");
    expect(deployOutput.skill.category).toBe("productivity");
    expect(deployOutput.skill.content).toContain("helpful test assistant");
    expect(deployOutput.skill.hoursSaved).toBe(2);

    // Step 4: Wait for fire-and-forget tracking to complete
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Step 5: Verify usage event was logged with the correct skillId
    const events = await db.query.usageEvents.findMany({
      where: and(
        eq(usageEvents.toolName, "deploy_skill"),
        eq(usageEvents.userId, TEST_USER_ID),
        gt(usageEvents.createdAt, beforeCall)
      ),
      orderBy: desc(usageEvents.createdAt),
      limit: 1,
    });

    expect(events.length).toBe(1);
    expect(events[0].toolName).toBe("deploy_skill");
    expect(events[0].userId).toBe(TEST_USER_ID);
    expect(events[0].skillId).toBe(TEST_SKILL_ID);

    // Verify metadata includes skill name and category
    const metadata = events[0].metadata as Record<string, unknown>;
    expect(metadata).toBeTruthy();
    expect(metadata.skillName).toBe("MCP Usage Test Skill");
    expect(metadata.skillCategory).toBe("productivity");

    // Step 6: Verify the skill's totalUses was incremented
    const skillAfter = await db.query.skills.findFirst({
      where: eq(skills.id, TEST_SKILL_ID),
      columns: { totalUses: true },
    });
    expect(skillAfter).toBeTruthy();
    expect(skillAfter!.totalUses).toBe(usesBefore + 1);
  });

  test("should find the test skill via search, then deploy it", async ({ request }) => {
    if (!db) throw new Error("Database required");

    // Step 1: Search for the test skill by name
    const { status: searchStatus, body: searchBody } = await mcpRequest(request, {
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "search_skills",
        arguments: { query: "MCP Usage Test Skill" },
      },
      id: 20,
    });

    expect(searchStatus).toBe(200);
    const searchResult = searchBody as Record<string, unknown>;
    const searchInner = (searchResult.result as { content: { text: string }[] }).content[0];
    const searchOutput = JSON.parse(searchInner.text);

    // The test skill should appear in search results
    const foundSkill = searchOutput.skills.find((s: { id: string }) => s.id === TEST_SKILL_ID);
    expect(foundSkill).toBeTruthy();
    expect(foundSkill.name).toBe("MCP Usage Test Skill");

    // Step 2: Record totalUses before deploy
    const skillBefore = await db.query.skills.findFirst({
      where: eq(skills.id, TEST_SKILL_ID),
      columns: { totalUses: true },
    });
    const usesBefore = skillBefore!.totalUses;

    const beforeDeploy = new Date();

    // Step 3: Deploy the skill using the ID from search results
    const { status: deployStatus, body: deployBody } = await mcpRequest(request, {
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "deploy_skill",
        arguments: { skillId: foundSkill.id },
      },
      id: 21,
    });

    expect(deployStatus).toBe(200);
    const deployResult = deployBody as Record<string, unknown>;
    const deployInner = (deployResult.result as { content: { text: string }[] }).content[0];
    const deployOutput = JSON.parse(deployInner.text);

    expect(deployOutput.success).toBe(true);
    expect(deployOutput.skill.content).toContain("helpful test assistant");

    // Step 4: Wait and verify usage was tracked
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const events = await db.query.usageEvents.findMany({
      where: and(
        eq(usageEvents.toolName, "deploy_skill"),
        eq(usageEvents.skillId, TEST_SKILL_ID),
        gt(usageEvents.createdAt, beforeDeploy)
      ),
      orderBy: desc(usageEvents.createdAt),
      limit: 1,
    });

    expect(events.length).toBe(1);
    expect(events[0].skillId).toBe(TEST_SKILL_ID);

    // Step 5: Verify totalUses incremented again
    const skillAfter = await db.query.skills.findFirst({
      where: eq(skills.id, TEST_SKILL_ID),
      columns: { totalUses: true },
    });
    expect(skillAfter!.totalUses).toBe(usesBefore + 1);
  });

  test("should return authenticated user via server_info", async ({ request }) => {
    const { status, body } = await mcpRequest(request, {
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "server_info",
        arguments: {},
      },
      id: 4,
    });

    expect(status).toBe(200);
    const result = body as Record<string, unknown>;
    const inner = result.result as { content: { type: string; text: string }[] };

    const serverInfo = JSON.parse(inner.content[0].text);
    expect(serverInfo.name).toBe("EverySkill Skills");
    expect(serverInfo.version).toBe("1.0.0");
    expect(serverInfo.categories).toEqual([
      "productivity",
      "wiring",
      "doc-production",
      "data-viz",
      "code",
    ]);
    expect(serverInfo.user.id).toBe(TEST_USER_ID);
  });

  test("should log confirm_install event without incrementing totalUses", async ({ request }) => {
    if (!db) throw new Error("Database required");

    // Record totalUses before
    const skillBefore = await db.query.skills.findFirst({
      where: eq(skills.id, TEST_SKILL_ID),
      columns: { totalUses: true },
    });
    const usesBefore = skillBefore!.totalUses;

    const beforeCall = new Date();

    const { status, body } = await mcpRequest(request, {
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "confirm_install",
        arguments: { skillId: TEST_SKILL_ID },
      },
      id: 30,
    });

    expect(status).toBe(200);
    const result = body as Record<string, unknown>;
    const inner = result.result as { content: { type: string; text: string }[] };
    const output = JSON.parse(inner.content[0].text);
    expect(output.success).toBe(true);
    expect(output.message).toBe("Installation confirmed");

    // Wait for tracking
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Verify usage event was logged
    const events = await db.query.usageEvents.findMany({
      where: and(
        eq(usageEvents.toolName, "confirm_install"),
        eq(usageEvents.userId, TEST_USER_ID),
        gt(usageEvents.createdAt, beforeCall)
      ),
      orderBy: desc(usageEvents.createdAt),
      limit: 1,
    });

    expect(events.length).toBe(1);
    expect(events[0].toolName).toBe("confirm_install");
    expect(events[0].skillId).toBe(TEST_SKILL_ID);
    expect(events[0].userId).toBe(TEST_USER_ID);

    // Verify totalUses was NOT incremented
    const skillAfter = await db.query.skills.findFirst({
      where: eq(skills.id, TEST_SKILL_ID),
      columns: { totalUses: true },
    });
    expect(skillAfter!.totalUses).toBe(usesBefore);
  });

  test("should log log_skill_usage event without incrementing totalUses", async ({ request }) => {
    if (!db) throw new Error("Database required");

    const skillBefore = await db.query.skills.findFirst({
      where: eq(skills.id, TEST_SKILL_ID),
      columns: { totalUses: true },
    });
    const usesBefore = skillBefore!.totalUses;

    const beforeCall = new Date();

    const { status, body } = await mcpRequest(request, {
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "log_skill_usage",
        arguments: { skillId: TEST_SKILL_ID },
      },
      id: 31,
    });

    expect(status).toBe(200);
    const result = body as Record<string, unknown>;
    const inner = result.result as { content: { type: string; text: string }[] };
    const output = JSON.parse(inner.content[0].text);
    expect(output.success).toBe(true);
    expect(output.message).toBe("Usage logged");

    // Wait for tracking
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Verify usage event was logged with correct metadata
    const events = await db.query.usageEvents.findMany({
      where: and(
        eq(usageEvents.toolName, "log_skill_usage"),
        eq(usageEvents.userId, TEST_USER_ID),
        gt(usageEvents.createdAt, beforeCall)
      ),
      orderBy: desc(usageEvents.createdAt),
      limit: 1,
    });

    expect(events.length).toBe(1);
    expect(events[0].toolName).toBe("log_skill_usage");
    expect(events[0].skillId).toBe(TEST_SKILL_ID);
    expect(events[0].userId).toBe(TEST_USER_ID);

    const metadata = events[0].metadata as Record<string, unknown>;
    expect(metadata.action).toBe("use");

    // Verify totalUses was NOT incremented
    const skillAfter = await db.query.skills.findFirst({
      where: eq(skills.id, TEST_SKILL_ID),
      columns: { totalUses: true },
    });
    expect(skillAfter!.totalUses).toBe(usesBefore);
  });

  test("should track full lifecycle: deploy → confirm_install → log_skill_usage", async ({
    request,
  }) => {
    if (!db) throw new Error("Database required");

    const beforeLifecycle = new Date();

    // Step 1: Deploy
    const { status: deployStatus } = await mcpRequest(request, {
      jsonrpc: "2.0",
      method: "tools/call",
      params: { name: "deploy_skill", arguments: { skillId: TEST_SKILL_ID } },
      id: 40,
    });
    expect(deployStatus).toBe(200);

    // Step 2: Confirm install
    const { status: confirmStatus } = await mcpRequest(request, {
      jsonrpc: "2.0",
      method: "tools/call",
      params: { name: "confirm_install", arguments: { skillId: TEST_SKILL_ID } },
      id: 41,
    });
    expect(confirmStatus).toBe(200);

    // Step 3: Log usage
    const { status: usageStatus } = await mcpRequest(request, {
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "log_skill_usage",
        arguments: { skillId: TEST_SKILL_ID, action: "apply" },
      },
      id: 42,
    });
    expect(usageStatus).toBe(200);

    // Wait for all tracking to complete
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Verify all 3 events were logged with correct skillId
    const events = await db.query.usageEvents.findMany({
      where: and(
        eq(usageEvents.skillId, TEST_SKILL_ID),
        eq(usageEvents.userId, TEST_USER_ID),
        gt(usageEvents.createdAt, beforeLifecycle)
      ),
      orderBy: desc(usageEvents.createdAt),
    });

    const toolNames = events.map((e) => e.toolName).sort();
    expect(toolNames).toContain("deploy_skill");
    expect(toolNames).toContain("confirm_install");
    expect(toolNames).toContain("log_skill_usage");

    // Verify the log_skill_usage event has the custom action
    const usageEvent = events.find((e) => e.toolName === "log_skill_usage");
    expect(usageEvent).toBeTruthy();
    const metadata = usageEvent!.metadata as Record<string, unknown>;
    expect(metadata.action).toBe("apply");
  });

  test("should include log_skill_usage instruction in HTTP deploy response", async ({
    request,
  }) => {
    const { status, body } = await mcpRequest(request, {
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "deploy_skill",
        arguments: { skillId: TEST_SKILL_ID },
      },
      id: 50,
    });

    expect(status).toBe(200);
    const result = body as Record<string, unknown>;
    const inner = result.result as { content: { type: string; text: string }[] };
    const deployOutput = JSON.parse(inner.content[0].text);

    // HTTP transport should include log_skill_usage mention in message
    expect(deployOutput.message).toContain("log_skill_usage");
  });
});
