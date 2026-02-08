import { z } from "zod";
import crypto from "node:crypto";
import { sql } from "drizzle-orm";
import { server } from "../server.js";
import { db, DEFAULT_TENANT_ID } from "@everyskill/db";
import { getUserId, getTenantId } from "../auth.js";

// ---------------------------------------------------------------------------
// Helpers (self-contained — MCP server runs standalone)
// ---------------------------------------------------------------------------

function stripFrontmatter(content: string): string {
  const match = content.match(/^---\n[\s\S]*?\n---\n/);
  return match ? content.slice(match[0].length) : content;
}

async function hashContent(content: string): Promise<string> {
  const data = new TextEncoder().encode(content);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

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

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function handleUpdateSkill({
  skillId,
  content,
  description,
}: {
  skillId: string;
  content: string;
  description?: string;
}) {
  if (!db) {
    return {
      content: [
        { type: "text" as const, text: JSON.stringify({ error: "Database not configured" }) },
      ],
      isError: true,
    };
  }

  const userId = getUserId();
  if (!userId) {
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            error: "Authentication required",
            message:
              "Set the EVERYSKILL_API_KEY environment variable to update skills. Get your key at https://everyskill.ai/settings.",
          }),
        },
      ],
      isError: true,
    };
  }

  const tenantId = getTenantId() || DEFAULT_TENANT_ID;

  // Fetch skill from DB
  const result = (await db.execute(
    sql`SELECT id, name, slug, description, category, content, author_id, hours_saved, tenant_id FROM skills WHERE id = ${skillId} LIMIT 1`
  )) as unknown as {
    id: string;
    name: string;
    slug: string;
    description: string;
    category: string;
    content: string;
    author_id: string | null;
    hours_saved: number | null;
    tenant_id: string;
  }[];

  const skill = result[0];
  if (!skill) {
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ error: "Skill not found", skillId }),
        },
      ],
      isError: true,
    };
  }

  // -------------------------------------------------------------------------
  // Author path: create new version, update skill content
  // -------------------------------------------------------------------------
  if (userId === skill.author_id) {
    // Get latest version number
    const versionResult = (await db.execute(
      sql`SELECT COALESCE(MAX(version), 0) as max_version FROM skill_versions WHERE skill_id = ${skillId}`
    )) as unknown as { max_version: number }[];

    const newVersion = (versionResult[0]?.max_version ?? 0) + 1;
    const contentHash = await hashContent(content);
    const versionId = crypto.randomUUID();

    // Insert version record
    try {
      await db.execute(sql`
        INSERT INTO skill_versions (id, tenant_id, skill_id, version, content_url, content_hash, content_type, name, description, created_by)
        VALUES (${versionId}, ${tenantId}, ${skillId}, ${newVersion}, '', ${contentHash}, 'text/markdown', ${skill.name}, ${description || skill.description}, ${userId})
      `);
    } catch {
      // Version record failed — not critical, continue with update
    }

    // Update skill
    if (description) {
      await db.execute(sql`
        UPDATE skills
        SET content = ${content},
            published_version_id = ${versionId},
            description = ${description},
            status = 'draft',
            updated_at = NOW()
        WHERE id = ${skillId}
      `);
    } else {
      await db.execute(sql`
        UPDATE skills
        SET content = ${content},
            published_version_id = ${versionId},
            status = 'draft',
            updated_at = NOW()
        WHERE id = ${skillId}
      `);
    }

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              action: "updated",
              skillId,
              version: newVersion,
              message: `Skill updated to version ${newVersion}. Status set to draft for review.`,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  // -------------------------------------------------------------------------
  // Non-author path: create a fork
  // -------------------------------------------------------------------------

  // Compute forkedAtContentHash from the original skill's body (no frontmatter)
  const forkedAtContentHash = await hashContent(stripFrontmatter(skill.content));

  const forkName = skill.name + " (Fork)";
  const slug = await generateUniqueSlug(forkName);
  const newSkillId = crypto.randomUUID();
  const forkDescription = description || skill.description;

  // Insert forked skill
  try {
    await db.execute(sql`
      INSERT INTO skills (id, tenant_id, name, slug, description, category, content, hours_saved, author_id, forked_from_id, forked_at_content_hash, status)
      VALUES (${newSkillId}, ${tenantId}, ${forkName}, ${slug}, ${forkDescription}, ${skill.category}, ${content}, ${skill.hours_saved ?? 1}, ${userId}, ${skillId}, ${forkedAtContentHash}, 'draft')
    `);
  } catch (err) {
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            error: "Failed to create fork",
            message: err instanceof Error ? err.message : "Unknown error",
          }),
        },
      ],
      isError: true,
    };
  }

  // Insert version record for the fork (version 1)
  const contentHash = await hashContent(content);
  const versionId = crypto.randomUUID();
  try {
    await db.execute(sql`
      INSERT INTO skill_versions (id, tenant_id, skill_id, version, content_url, content_hash, content_type, name, description, created_by)
      VALUES (${versionId}, ${tenantId}, ${newSkillId}, 1, '', ${contentHash}, 'text/markdown', ${forkName}, ${forkDescription}, ${userId})
    `);

    // Update fork's publishedVersionId
    await db.execute(sql`
      UPDATE skills SET published_version_id = ${versionId} WHERE id = ${newSkillId}
    `);
  } catch {
    // Version/publish failed but fork exists — still usable
  }

  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(
          {
            action: "forked",
            skillId: newSkillId,
            slug,
            forkName,
            forkedFromId: skillId,
            forkedAtContentHash,
            message: `Created fork "${forkName}" as draft. Original skill unchanged.`,
          },
          null,
          2
        ),
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Tool registration
// ---------------------------------------------------------------------------

server.registerTool(
  "update_skill",
  {
    description:
      "Push local skill modifications back to EverySkill. If you are the skill author, creates a new version (set to draft for re-review). If not the author, creates a fork. Requires EVERYSKILL_API_KEY.",
    inputSchema: {
      skillId: z.string().describe("Skill ID to update"),
      content: z.string().describe("Updated skill content (full markdown)"),
      description: z
        .string()
        .optional()
        .describe("Updated description (optional, keeps existing if omitted)"),
    },
  },
  async ({ skillId, content, description }) => handleUpdateSkill({ skillId, content, description })
);
