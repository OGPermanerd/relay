import { z } from "zod";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { sql } from "drizzle-orm";
import { server } from "../server.js";
import { db, DEFAULT_TENANT_ID } from "@everyskill/db";
import { trackUsage } from "../tracking/events.js";
import { getUserId, getTenantId } from "../auth.js";

// ---------------------------------------------------------------------------
// Helpers (self-contained — MCP server runs standalone)
// ---------------------------------------------------------------------------

function generateSlug(name: string): string {
  if (!name || name.trim().length === 0) return "skill";
  const normalized = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const slug = normalized
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
  return slug || "skill";
}

async function generateUniqueSlug(name: string): Promise<string> {
  const baseSlug = generateSlug(name);
  if (!db) return baseSlug;

  const existing = (await db.execute(
    sql`SELECT slug FROM skills WHERE slug LIKE ${baseSlug + "%"}`
  )) as unknown as { slug: string }[];

  if (existing.length === 0) return baseSlug;
  const suffix = crypto.randomUUID().slice(0, 8);
  return `${baseSlug}-${suffix}`;
}

async function hashContent(content: string): Promise<string> {
  const data = new TextEncoder().encode(content);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function buildHookFrontmatter(
  skillId: string,
  skillName: string,
  category: string,
  hoursSaved: number
): string {
  const trackingUrl = process.env.NEXT_PUBLIC_ROOT_DOMAIN
    ? `https://${process.env.NEXT_PUBLIC_ROOT_DOMAIN}/api/track`
    : "https://everyskill.ai/api/track";

  return [
    "---",
    `everyskill_skill_id: ${skillId}`,
    `everyskill_skill_name: ${skillName}`,
    `everyskill_category: ${category}`,
    `everyskill_hours_saved: ${hoursSaved}`,
    "hooks:",
    "  PostToolUse:",
    '    - matcher: "*"',
    "      hooks:",
    "        - type: command",
    "          command: >-",
    "            bash -c '",
    "            INPUT=$(cat);",
    '            TN=$(echo "$INPUT" | jq -r ".tool_name // empty" 2>/dev/null || echo "$INPUT" | grep -o "\\"tool_name\\":\\"[^\\"]*\\"" | cut -d\\" -f4 || echo "unknown");',
    `            PL="{\\"skill_id\\":\\"${skillId}\\",\\"tool_name\\":\\"$TN\\",\\"ts\\":\\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\\",\\"hook_event\\":\\"PostToolUse\\"}";`,
    '            SIG=$(echo -n "$PL" | openssl dgst -sha256 -hmac "${EVERYSKILL_API_KEY:-none}" 2>/dev/null | awk "{print \\$NF}");',
    `            RESP=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${trackingUrl}" -H "Content-Type: application/json" -H "Authorization: Bearer \${EVERYSKILL_API_KEY:-}" -H "X-EverySkill-Signature: $SIG" -d "$PL" --connect-timeout 5 --max-time 10 2>>/tmp/everyskill-track.log);`,
    `            if [ "$RESP" != "200" ] && [ "$RESP" != "000" ]; then sleep 5; curl -s -o /dev/null -X POST "${trackingUrl}" -H "Content-Type: application/json" -H "Authorization: Bearer \${EVERYSKILL_API_KEY:-}" -H "X-EverySkill-Signature: $SIG" -d "$PL" --connect-timeout 5 --max-time 10 2>>/tmp/everyskill-track.log; fi;`,
    "            true",
    "            '",
    "          async: true",
    "          timeout: 30",
    "---",
    "",
  ].join("\n");
}

function stripFrontmatter(content: string): string {
  const match = content.match(/^---\n[\s\S]*?\n---\n/);
  return match ? content.slice(match[0].length) : content;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function handleCreateSkill({
  name,
  description,
  category,
  content,
  tags,
  hoursSaved,
  userId,
  visibility,
}: {
  name: string;
  description: string;
  category: string;
  content: string;
  tags?: string[];
  hoursSaved: number;
  userId?: string;
  visibility?: "tenant" | "personal";
}) {
  if (!db) {
    return {
      content: [
        { type: "text" as const, text: JSON.stringify({ error: "Database not configured" }) },
      ],
      isError: true,
    };
  }

  if (!userId) {
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            error: "Authentication required",
            message:
              "Set the EVERYSKILL_API_KEY environment variable to create skills. Get your key at https://everyskill.ai/settings.",
          }),
        },
      ],
      isError: true,
    };
  }

  const tenantId = getTenantId() || DEFAULT_TENANT_ID;
  const rawContent = stripFrontmatter(content);
  const slug = await generateUniqueSlug(name);
  const skillId = crypto.randomUUID();
  const tagsJson = tags && tags.length > 0 ? JSON.stringify(tags) : null;

  // Insert skill
  try {
    const skillVisibility = visibility || "tenant";
    await db.execute(sql`
      INSERT INTO skills (id, tenant_id, name, slug, description, category, content, hours_saved, author_id, tags, status, visibility)
      VALUES (${skillId}, ${tenantId}, ${name}, ${slug}, ${description}, ${category}, ${rawContent}, ${hoursSaved}, ${userId}, ${tagsJson}::jsonb, 'draft', ${skillVisibility})
    `);
  } catch (err) {
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            success: false,
            error: "Failed to create skill",
            message: err instanceof Error ? err.message : "Unknown error",
          }),
        },
      ],
      isError: true,
    };
  }

  // Build content with frontmatter hooks
  const contentWithFrontmatter =
    buildHookFrontmatter(skillId, name, category, hoursSaved) + rawContent;

  // Update skill content to include frontmatter
  await db.execute(sql`
    UPDATE skills SET content = ${contentWithFrontmatter} WHERE id = ${skillId}
  `);

  // Create version record and publish
  const contentHash = await hashContent(contentWithFrontmatter);
  const versionId = crypto.randomUUID();
  try {
    await db.execute(sql`
      INSERT INTO skill_versions (id, tenant_id, skill_id, version, content_url, content_hash, content_type, name, description, created_by)
      VALUES (${versionId}, ${tenantId}, ${skillId}, 1, '', ${contentHash}, 'text/markdown', ${name}, ${description}, ${userId})
    `);

    // Publish immediately
    await db.execute(sql`
      UPDATE skills SET published_version_id = ${versionId} WHERE id = ${skillId}
    `);
  } catch {
    // Version/publish failed but skill exists — still usable
  }

  // Track creation
  await trackUsage({
    toolName: "create_skill",
    skillId,
    userId,
    metadata: { skillName: name, category },
  });

  // Auto-save to local skills directory
  let savedTo: string | undefined;
  try {
    const skillsDir = path.join(os.homedir(), ".claude", "skills");
    const filePath = path.join(skillsDir, `${slug}.md`);
    fs.mkdirSync(skillsDir, { recursive: true });
    fs.writeFileSync(filePath, contentWithFrontmatter, "utf-8");
    savedTo = filePath;
  } catch {
    // Auto-save failed — not critical
  }

  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "everyskill.ai";

  const responseBody: Record<string, unknown> = {
    success: true,
    skill: {
      id: skillId,
      name,
      slug,
      category,
      hoursSaved,
      url: `https://${rootDomain}/skills/${slug}`,
    },
    message: savedTo
      ? `Skill "${name}" created as a draft. It will be visible after review and approval. Saved locally to ${savedTo}. View at https://${rootDomain}/skills/${slug}`
      : `Skill "${name}" created as a draft. It will be visible after review and approval. View at https://${rootDomain}/skills/${slug}`,
  };

  if (savedTo) {
    responseBody.savedTo = savedTo;
  }

  return {
    content: [{ type: "text" as const, text: JSON.stringify(responseBody, null, 2) }],
  };
}

// ---------------------------------------------------------------------------
// Tool registration
// ---------------------------------------------------------------------------

server.registerTool(
  "create_skill",
  {
    description:
      "Create and publish a new skill on EverySkill. Takes a process, workflow, or prompt and publishes it as a reusable skill. The skill is saved locally and published to the marketplace. Requires EVERYSKILL_API_KEY.",
    inputSchema: {
      name: z.string().min(1).max(100).describe("Skill name (e.g. 'Git PR Review Automation')"),
      description: z.string().min(1).max(2000).describe("What this skill does and when to use it"),
      category: z
        .enum(["prompt", "workflow", "agent", "mcp"])
        .describe("Skill type: prompt, workflow, agent, or mcp"),
      content: z.string().min(1).describe("The full skill content (markdown)"),
      tags: z.array(z.string()).max(10).optional().describe("Optional tags for discovery (max 10)"),
      hoursSaved: z
        .number()
        .min(0)
        .max(1000)
        .default(1)
        .describe("Estimated hours saved per use (default: 1)"),
      visibility: z
        .enum(["tenant", "personal"])
        .optional()
        .describe("Skill visibility: 'tenant' (default, visible to org) or 'personal' (only you)"),
    },
  },
  async ({ name, description, category, content, tags, hoursSaved, visibility }) =>
    handleCreateSkill({
      name,
      description,
      category,
      content,
      tags,
      hoursSaved,
      userId: getUserId() ?? undefined,
      visibility,
    })
);
