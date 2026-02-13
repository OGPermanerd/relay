import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { eq } from "drizzle-orm";
import { db } from "@everyskill/db";
import { skills } from "@everyskill/db/schema/skills";
import { getUserId } from "../auth.js";

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

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function handleCheckSkillStatus({
  skillId,
  filePath,
}: {
  skillId: string;
  filePath?: string;
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

  // Fetch skill from DB
  const result = await db
    .select({
      id: skills.id,
      slug: skills.slug,
      name: skills.name,
      content: skills.content,
      status: skills.status,
      authorId: skills.authorId,
    })
    .from(skills)
    .where(eq(skills.id, skillId))
    .limit(1);

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

  // Access control: skill must be published OR user must be author
  if (skill.status !== "published" && skill.authorId !== userId) {
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            error: "Access denied",
            message: "Skill is not published and you are not the author.",
          }),
        },
      ],
      isError: true,
    };
  }

  // Determine local file path
  const localPath = filePath || path.join(os.homedir(), ".claude", "skills", skill.slug + ".md");

  // Check if file exists locally
  if (!fs.existsSync(localPath)) {
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            status: "not_installed",
            skillId,
            name: skill.name,
            expectedPath: localPath,
            message: `Skill "${skill.name}" is not installed locally. Use deploy_skill to install it.`,
          }),
        },
      ],
    };
  }

  // Read local file content
  const localContent = fs.readFileSync(localPath, "utf-8");

  // CRITICAL for FORK-02: Strip frontmatter from BOTH local and DB content
  // before hashing so tracking hook changes do not trigger false drift
  const localBody = stripFrontmatter(localContent);
  const dbBody = stripFrontmatter(skill.content);

  const localHash = await hashContent(localBody);
  const dbHash = await hashContent(dbBody);

  const hasDiverged = localHash !== dbHash;

  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(
          {
            status: hasDiverged ? "diverged" : "current",
            skillId,
            name: skill.name,
            localHash,
            dbHash,
            filePath: localPath,
            message: hasDiverged
              ? `Local file has been modified. Use update_skill to push changes back.`
              : `Local file matches the published version.`,
          },
          null,
          2
        ),
      },
    ],
  };
}
