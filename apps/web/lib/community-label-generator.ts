import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { db } from "@everyskill/db";
import { sql } from "drizzle-orm";

/**
 * AI-powered community label generation via Claude Haiku.
 *
 * generateCommunityLabel: Produces a name + description for a set of skills.
 * generateAndPersistCommunityLabels: Labels all communities for a tenant and persists to DB.
 */

const LABEL_MODEL = "claude-haiku-4-5-20251001";

const CommunityLabelSchema = z.object({
  name: z.string(),
  description: z.string(),
});

const LABEL_JSON_SCHEMA = {
  type: "object" as const,
  properties: {
    name: { type: "string" as const },
    description: { type: "string" as const },
  },
  required: ["name", "description"],
  additionalProperties: false,
};

const SYSTEM_PROMPT = `You name clusters of related AI automation skills. Given member skills, produce a community name (2-5 words, title case) and 1-2 sentence description. Be specific. Good: "Code Review Automation". Bad: "Productivity Tools".`;

// ---------------------------------------------------------------------------
// Generate a label for a single community
// ---------------------------------------------------------------------------

export async function generateCommunityLabel(
  skills: { name: string; description: string; category: string }[]
): Promise<{ name: string; description: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  const client = new Anthropic({ apiKey });

  const skillList = skills
    .map((s) => `- ${s.name} (${s.category}): ${(s.description || "").slice(0, 100)}`)
    .join("\n");

  const response = await client.messages.create({
    model: LABEL_MODEL,
    max_tokens: 256,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Name this skill community:\n\n${skillList}`,
      },
    ],
    output_config: {
      format: { type: "json_schema", schema: LABEL_JSON_SCHEMA },
    },
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text in label response");
  }

  return CommunityLabelSchema.parse(JSON.parse(textBlock.text));
}

// ---------------------------------------------------------------------------
// Generate and persist labels for all communities in a tenant
// ---------------------------------------------------------------------------

export async function generateAndPersistCommunityLabels(tenantId: string): Promise<number> {
  if (!db) return 0;

  // Get distinct community IDs for this tenant
  const communityRows = await db.execute(sql`
    SELECT DISTINCT community_id
    FROM skill_communities
    WHERE tenant_id = ${tenantId}
    ORDER BY community_id
  `);

  const communityIds = (communityRows as unknown as { community_id: number }[]).map((r) =>
    Number(r.community_id)
  );

  let labeledCount = 0;

  for (const cid of communityIds) {
    try {
      // Fetch member skills for this community
      const skillRows = await db.execute(sql`
        SELECT s.name, s.description, s.category
        FROM skill_communities sc
        JOIN skills s ON s.id = sc.skill_id
        WHERE sc.tenant_id = ${tenantId}
          AND sc.community_id = ${cid}
          AND s.status = 'published'
      `);

      const skills = skillRows as unknown as {
        name: string;
        description: string;
        category: string;
      }[];

      if (skills.length === 0) continue;

      // Generate AI label
      const label = await generateCommunityLabel(skills);

      // Persist label to all rows in this community
      await db.execute(sql`
        UPDATE skill_communities
        SET community_label = ${label.name},
            community_description = ${label.description}
        WHERE tenant_id = ${tenantId}
          AND community_id = ${cid}
      `);

      labeledCount++;
    } catch (err) {
      console.warn(
        `[COMMUNITY LABELS] Failed to label community ${cid} for tenant ${tenantId}:`,
        err
      );
      // Continue with remaining communities
    }
  }

  return labeledCount;
}
