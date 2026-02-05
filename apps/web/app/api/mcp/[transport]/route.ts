import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { z } from "zod";
import { validateApiKey } from "@relay/db/services/api-keys";
import { db } from "@relay/db";
import { usageEvents } from "@relay/db/schema/usage-events";
import { incrementSkillUses } from "@relay/db/services/skill-metrics";

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
async function trackUsage(event: {
  toolName: string;
  skillId?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    if (!db) return;
    await db.insert(usageEvents).values(event);
    if (event.skillId) await incrementSkillUses(event.skillId);
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
          "List all available skills in the Relay marketplace. Returns skill ID, name, description, category, and estimated hours saved.",
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
          "Search for skills in the Relay marketplace by query. Matches against name and description.",
        inputSchema: {
          query: z.string().min(1).describe("Search query (matches name, description)"),
          category: z
            .enum(["prompt", "workflow", "agent", "mcp"])
            .optional()
            .describe("Filter by skill category"),
          limit: z.number().min(1).max(25).default(10).describe("Maximum number of results"),
        },
      },
      async ({ query, category, limit }, extra) => {
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

        const queryLower = query.toLowerCase();

        const allResults = await db.query.skills.findMany({
          columns: {
            id: true,
            name: true,
            description: true,
            category: true,
            hoursSaved: true,
          },
        });

        const filtered = allResults.filter((skill) => {
          const matchesQuery =
            skill.name.toLowerCase().includes(queryLower) ||
            skill.description.toLowerCase().includes(queryLower);
          const matchesCategory = !category || skill.category === category;
          return matchesQuery && matchesCategory;
        });

        const results = filtered.slice(0, limit);

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
          "Deploy a skill from Relay into this conversation. Returns the skill content for immediate use. Use the skill ID from list_skills or search_skills results.",
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
                    "This skill is now available in this conversation. You can use it directly.",
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
    // server_info
    // -----------------------------------------------------------------------
    server.registerTool(
      "server_info",
      {
        description:
          "Get information about this Relay Skills MCP server, including available categories and the authenticated user.",
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
                  name: "Relay Skills",
                  version: "1.0.0",
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
  },
  {
    serverInfo: { name: "Relay Skills", version: "1.0.0" },
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
  const response = await authHandler(request);
  const headers = corsHeaders(origin);
  for (const [key, value] of Object.entries(headers)) {
    if (value) response.headers.set(key, value);
  }
  return response;
}

// ---------------------------------------------------------------------------
// Route exports
// ---------------------------------------------------------------------------
export { withCors as GET, withCors as POST, withCors as DELETE };
