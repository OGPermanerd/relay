import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { z } from "zod";
import { validateApiKey } from "@everyskill/db/services/api-keys";
import { db, writeAuditLog } from "@everyskill/db";
import { usageEvents } from "@everyskill/db/schema/usage-events";
import { incrementSkillUses } from "@everyskill/db/services/skill-metrics";
import { searchSkillsByQuery } from "@everyskill/db/services/search-skills";

// ---------------------------------------------------------------------------
// Read-only mode: when true, only read tools are registered (no writes)
// Defaults to true for safety — set MCP_REMOTE_MODE=full to enable writes
// ---------------------------------------------------------------------------
const REMOTE_READONLY = process.env.MCP_REMOTE_MODE !== "full";

// TODO: Replace with dynamic tenant resolution when multi-tenant routing is implemented
const DEFAULT_TENANT_ID = "default-tenant-000-0000-000000000000";

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------
const ALLOWED_ORIGINS = ["https://claude.ai", "https://claude.com"];

function corsHeaders(origin: string): Record<string, string> {
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : "";
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS, DELETE",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, Mcp-Session-Id",
    "Access-Control-Expose-Headers": "Mcp-Session-Id",
    "Access-Control-Max-Age": "86400",
  };
}

// ---------------------------------------------------------------------------
// Rate limiter (in-memory sliding window, 60 req/min per key)
// ---------------------------------------------------------------------------
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const MAX_PER_MINUTE = 60;

function checkRateLimit(keyId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(keyId);

  if (!entry || now >= entry.resetAt) {
    rateLimitMap.set(keyId, { count: 1, resetAt: now + 60_000 });
    return true; // allowed
  }

  entry.count += 1;
  return entry.count <= MAX_PER_MINUTE;
}

// ---------------------------------------------------------------------------
// Usage tracking helper (inline — cannot import from apps/mcp)
// ---------------------------------------------------------------------------
async function trackUsage(
  event: {
    toolName: string;
    skillId?: string;
    userId?: string;
    metadata?: Record<string, unknown>;
  },
  { skipIncrement = false }: { skipIncrement?: boolean } = {}
) {
  try {
    if (!db) return;
    await db.insert(usageEvents).values({ tenantId: DEFAULT_TENANT_ID, ...event });
    if (event.skillId && !skipIncrement) await incrementSkillUses(event.skillId);

    // Audit log — fire-and-forget
    writeAuditLog({
      actorId: event.userId,
      tenantId: DEFAULT_TENANT_ID,
      action: `mcp.${event.toolName}`,
      resourceType: event.skillId ? "skill" : "mcp_tool",
      resourceId: event.skillId || event.toolName,
      metadata: { transport: "http", ...event.metadata },
    }).catch(() => {});
  } catch (e) {
    console.error("Failed to track usage:", e);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function extractUserId(extra: {
  authInfo?: { extra?: Record<string, unknown> };
}): string | undefined {
  return extra.authInfo?.extra?.userId as string | undefined;
}

function extractKeyId(extra: { authInfo?: { clientId?: string } }): string | undefined {
  return extra.authInfo?.clientId;
}

function rateLimitError() {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({
          error: "Rate limit exceeded. Try again in 60 seconds.",
        }),
      },
    ],
    isError: true,
  };
}

// ---------------------------------------------------------------------------
// MCP handler with tool registrations
// ---------------------------------------------------------------------------
const handler = createMcpHandler(
  (server) => {
    // -----------------------------------------------------------------------
    // list_skills
    // -----------------------------------------------------------------------
    server.registerTool(
      "list_skills",
      {
        description:
          "List all available skills in the EverySkill marketplace. Returns skill ID, name, description, category, and estimated hours saved.",
        inputSchema: {
          category: z
            .enum(["prompt", "workflow", "agent", "mcp"])
            .optional()
            .describe("Filter by skill category"),
          limit: z.number().min(1).max(50).default(20).describe("Maximum number of results"),
        },
      },
      async ({ category, limit }, extra) => {
        const userId = extractUserId(extra);
        const keyId = extractKeyId(extra);
        if (keyId && !checkRateLimit(keyId)) return rateLimitError();

        if (!db) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({ error: "Database not configured" }),
              },
            ],
            isError: true,
          };
        }

        const allResults = await db.query.skills.findMany({
          limit: category ? undefined : limit,
          columns: {
            id: true,
            name: true,
            description: true,
            category: true,
            hoursSaved: true,
          },
        });

        const results = category
          ? allResults.filter((s) => s.category === category).slice(0, limit)
          : allResults;

        await trackUsage({
          toolName: "list_skills",
          userId,
          metadata: { category, limit, resultCount: results.length },
        });

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ count: results.length, skills: results }, null, 2),
            },
          ],
        };
      }
    );

    // -----------------------------------------------------------------------
    // search_skills
    // -----------------------------------------------------------------------
    server.registerTool(
      "search_skills",
      {
        description:
          "Search for skills in the EverySkill marketplace by query. Matches against name, description, author name, and tags.",
        inputSchema: {
          query: z
            .string()
            .min(1)
            .describe("Search query (matches name, description, author, tags)"),
          category: z
            .enum(["prompt", "workflow", "agent", "mcp"])
            .optional()
            .describe("Filter by skill category"),
          limit: z.number().min(1).max(50).default(10).describe("Maximum number of results"),
        },
      },
      async ({ query, category, limit }, extra) => {
        const userId = extractUserId(extra);
        const keyId = extractKeyId(extra);
        if (keyId && !checkRateLimit(keyId)) return rateLimitError();

        const results = await searchSkillsByQuery({ query, category, limit });

        await trackUsage({
          toolName: "search_skills",
          userId,
          metadata: { query, category, resultCount: results.length },
        });

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ query, count: results.length, skills: results }, null, 2),
            },
          ],
        };
      }
    );

    // -----------------------------------------------------------------------
    // deploy_skill
    // -----------------------------------------------------------------------
    server.registerTool(
      "deploy_skill",
      {
        description:
          "Deploy a skill from EverySkill into this conversation. Returns the skill content for immediate use. Use the skill ID from list_skills or search_skills results.",
        inputSchema: {
          skillId: z.string().describe("Skill ID from search/list results"),
        },
      },
      async ({ skillId }, extra) => {
        const userId = extractUserId(extra);
        const keyId = extractKeyId(extra);
        if (keyId && !checkRateLimit(keyId)) return rateLimitError();

        if (!db) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({ error: "Database not configured" }),
              },
            ],
            isError: true,
          };
        }

        const allSkills = await db.query.skills.findMany();
        const skill = allSkills.find((s) => s.id === skillId);

        if (!skill) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  {
                    success: false,
                    error: "Skill not found",
                    message: `No skill found with ID: ${skillId}. Use list_skills or search_skills to find valid skill IDs.`,
                  },
                  null,
                  2
                ),
              },
            ],
            isError: true,
          };
        }

        await trackUsage({
          toolName: "deploy_skill",
          skillId: skill.id,
          userId,
          metadata: { skillName: skill.name, skillCategory: skill.category },
        });

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  success: true,
                  skill: {
                    id: skill.id,
                    name: skill.name,
                    category: skill.category,
                    content: skill.content,
                    hoursSaved: skill.hoursSaved,
                  },
                  message:
                    "This skill is now available in this conversation. When you use it, call log_skill_usage with the skillId to track usage.",
                },
                null,
                2
              ),
            },
          ],
        };
      }
    );

    // -----------------------------------------------------------------------
    // confirm_install (write tool — disabled in read-only mode)
    // -----------------------------------------------------------------------
    if (!REMOTE_READONLY) {
      server.registerTool(
        "confirm_install",
        {
          description:
            "Confirm that a skill has been saved/installed locally. Call this after saving a deployed skill file to log the installation.",
          inputSchema: {
            skillId: z.string().describe("The skill ID that was installed"),
          },
        },
        async ({ skillId }, extra) => {
          const userId = extractUserId(extra);
          const keyId = extractKeyId(extra);
          if (keyId && !checkRateLimit(keyId)) return rateLimitError();

          await trackUsage(
            { toolName: "confirm_install", skillId, userId },
            { skipIncrement: true }
          );

          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({ success: true, message: "Installation confirmed" }),
              },
            ],
          };
        }
      );
    }

    // -----------------------------------------------------------------------
    // log_skill_usage (write tool — disabled in read-only mode)
    // -----------------------------------------------------------------------
    if (!REMOTE_READONLY) {
      server.registerTool(
        "log_skill_usage",
        {
          description:
            "Log that a skill is being used in a conversation. Call this when you actually use a deployed skill to track real usage.",
          inputSchema: {
            skillId: z.string().describe("The skill ID being used"),
            action: z
              .string()
              .optional()
              .default("use")
              .describe("The action being performed (defaults to 'use')"),
          },
        },
        async ({ skillId, action }, extra) => {
          const userId = extractUserId(extra);
          const keyId = extractKeyId(extra);
          if (keyId && !checkRateLimit(keyId)) return rateLimitError();

          await trackUsage(
            { toolName: "log_skill_usage", skillId, userId, metadata: { action } },
            { skipIncrement: true }
          );

          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({ success: true, message: "Usage logged" }),
              },
            ],
          };
        }
      );
    }

    // -----------------------------------------------------------------------
    // server_info
    // -----------------------------------------------------------------------
    server.registerTool(
      "server_info",
      {
        description:
          "Get information about this EverySkill Skills MCP server, including available categories and the authenticated user.",
        inputSchema: {},
      },
      async (_args, extra) => {
        const userId = extractUserId(extra);
        const keyId = extractKeyId(extra);
        if (keyId && !checkRateLimit(keyId)) return rateLimitError();

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  name: "EverySkill Skills",
                  version: "1.0.0",
                  mode: REMOTE_READONLY ? "readonly" : "full",
                  categories: ["prompt", "workflow", "agent", "mcp"],
                  user: { id: userId },
                },
                null,
                2
              ),
            },
          ],
        };
      }
    );

    // -----------------------------------------------------------------------
    // suggest_skills prompt
    // -----------------------------------------------------------------------
    server.registerPrompt(
      "suggest_skills",
      {
        description: "Suggest relevant EverySkill skills for the current conversation",
      },
      () => ({
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: "Search Relay for skills relevant to the current conversation. Use search_skills with a query matching the user's task, then present the top results with descriptions.",
            },
          },
        ],
      })
    );
  },
  {
    serverInfo: { name: "EverySkill Skills", version: "1.0.0" },
  },
  { basePath: "/api/mcp", maxDuration: 60 }
);

// ---------------------------------------------------------------------------
// Auth wrapper — validates rlk_ bearer tokens via existing service
// ---------------------------------------------------------------------------
const authHandler = withMcpAuth(
  handler,
  async (_req: Request, bearerToken?: string) => {
    if (!bearerToken) return undefined;
    const result = await validateApiKey(bearerToken);
    if (!result) return undefined;
    return {
      token: bearerToken,
      clientId: result.keyId,
      scopes: [],
      extra: { userId: result.userId },
    };
  },
  { required: true }
);

// ---------------------------------------------------------------------------
// CORS preflight handler
// ---------------------------------------------------------------------------
export async function OPTIONS(request: Request) {
  const origin = request.headers.get("Origin") ?? "";
  return new Response(null, {
    status: 204,
    headers: corsHeaders(origin),
  });
}

// ---------------------------------------------------------------------------
// Wrap auth handler to inject CORS headers on all responses
// ---------------------------------------------------------------------------
async function withCors(request: Request): Promise<Response> {
  const origin = request.headers.get("Origin") ?? "";
  try {
    const response = await authHandler(request);
    const headers = corsHeaders(origin);
    for (const [key, value] of Object.entries(headers)) {
      if (value) response.headers.set(key, value);
    }
    return response;
  } catch (error) {
    console.error("[MCP] Handler error:", error);
    const headers = corsHeaders(origin);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...headers },
    });
  }
}

// ---------------------------------------------------------------------------
// Route exports
// ---------------------------------------------------------------------------
export { withCors as GET, withCors as POST, withCors as DELETE };
