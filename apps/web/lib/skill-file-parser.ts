export interface ParsedSkillData {
  name?: string;
  description?: string;
  category?: "prompt" | "workflow" | "agent" | "mcp";
  tags?: string;
  usageInstructions?: string;
  content?: string;
  parseMessage?: string;
  relaySkillId?: string;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_ZIP_FILES = 20;

export async function parseSkillFile(file: File): Promise<ParsedSkillData> {
  if (file.size > MAX_FILE_SIZE) {
    return { parseMessage: "File is too large (max 10MB)." };
  }

  const name = file.name.toLowerCase();

  if (name.endsWith(".mcp.json")) {
    return parseMcpJson(await file.text());
  }
  if (name.endsWith(".json")) {
    return parseJsonFile(file.name, await file.text());
  }
  if (name.endsWith(".md")) {
    return parseMarkdownFile(file.name, await file.text());
  }
  if (name.endsWith(".zip")) {
    return parseZipFile(file);
  }

  return { parseMessage: `Unsupported file type. Accepted: .md, .json, .mcp.json, .zip` };
}

// ---------------------------------------------------------------------------
// Markdown
// ---------------------------------------------------------------------------

function parseMarkdownFile(filename: string, text: string): ParsedSkillData {
  const baseName = filename.replace(/\.md$/i, "");
  const isClaude = baseName.toLowerCase() === "claude";

  // Extract and strip relay frontmatter if present
  const { content: cleanedText, relaySkillId } = extractRelayFrontmatter(text);

  const heading = extractFirstHeading(cleanedText);
  const name = heading || titleCase(baseName);
  const description = extractFirstParagraph(cleanedText);

  return {
    name,
    description,
    category: isClaude ? "agent" : "prompt",
    content: cleanedText,
    relaySkillId,
    parseMessage: `Imported "${filename}" as ${isClaude ? "agent" : "prompt"} skill.`,
  };
}

// ---------------------------------------------------------------------------
// MCP JSON
// ---------------------------------------------------------------------------

function parseMcpJson(text: string): ParsedSkillData {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { parseMessage: "Invalid JSON in .mcp.json file." };
  }

  const servers = parsed.mcpServers as Record<string, unknown> | undefined;
  const serverNames = servers ? Object.keys(servers) : [];
  const name =
    serverNames.length === 1
      ? titleCase(serverNames[0])
      : serverNames.length > 1
        ? `MCP Servers (${serverNames.join(", ")})`
        : "MCP Server Config";

  return {
    name,
    description: `MCP server configuration with ${serverNames.length || "unknown"} server(s).`,
    category: "mcp",
    content: text,
    parseMessage: `Imported MCP config with server(s): ${serverNames.join(", ") || "none detected"}.`,
  };
}

// ---------------------------------------------------------------------------
// Generic JSON
// ---------------------------------------------------------------------------

function parseJsonFile(filename: string, text: string): ParsedSkillData {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { parseMessage: "Invalid JSON file." };
  }

  // Delegate to MCP parser if it has mcpServers key
  if ("mcpServers" in parsed) {
    return parseMcpJson(text);
  }

  const baseName = filename.replace(/\.json$/i, "");
  const name = (typeof parsed.name === "string" && parsed.name) || titleCase(baseName);
  const description = typeof parsed.description === "string" ? parsed.description : undefined;

  // Heuristic category detection
  let category: ParsedSkillData["category"];
  if ("steps" in parsed || "nodes" in parsed) {
    category = "workflow";
  } else if ("tools" in parsed || "system_prompt" in parsed || "systemPrompt" in parsed) {
    category = "agent";
  }

  return {
    name,
    description,
    category,
    content: text,
    parseMessage: `Imported "${filename}"${category ? ` as ${category} skill` : ""}.`,
  };
}

// ---------------------------------------------------------------------------
// ZIP
// ---------------------------------------------------------------------------

async function parseZipFile(file: File): Promise<ParsedSkillData> {
  let JSZip: typeof import("jszip");
  try {
    JSZip = (await import("jszip")).default as unknown as typeof import("jszip");
  } catch {
    return { parseMessage: "Failed to load ZIP support." };
  }

  let zip: Awaited<ReturnType<typeof JSZip.loadAsync>>;
  try {
    zip = await JSZip.loadAsync(file);
  } catch {
    return { parseMessage: "Could not read ZIP file. Is it a valid archive?" };
  }

  const entries = Object.keys(zip.files).filter((p) => !zip.files[p].dir);
  if (entries.length === 0) {
    return { parseMessage: "ZIP archive is empty." };
  }

  // Strip single root folder prefix if present
  const prefix = detectSingleRootFolder(entries);
  const stripped = prefix ? entries.map((e) => e.slice(prefix.length)) : entries;
  const entryMap = new Map(entries.map((e, i) => [stripped[i], e]));

  // Priority files to look for
  const priorities = [
    "CLAUDE.md",
    "claude.md",
    "README.md",
    "readme.md",
    ".mcp.json",
    "package.json",
  ];

  let bestFile: string | undefined;
  for (const p of priorities) {
    if (entryMap.has(p)) {
      bestFile = p;
      break;
    }
  }

  // Fallback: first .md or .json file
  if (!bestFile) {
    bestFile = stripped.find((e) => e.endsWith(".md")) || stripped.find((e) => e.endsWith(".json"));
  }

  if (!bestFile) {
    return { parseMessage: "No recognizable skill files found in ZIP archive." };
  }

  const realPath = entryMap.get(bestFile)!;
  const bestContent = await zip.files[realPath].async("string");

  // Parse the best file to extract metadata
  let result: ParsedSkillData;
  if (bestFile.endsWith(".mcp.json")) {
    result = parseMcpJson(bestContent);
  } else if (bestFile.endsWith(".json")) {
    result = parseJsonFile(bestFile, bestContent);
  } else {
    result = parseMarkdownFile(bestFile, bestContent);
  }

  // If content is just from one file, try to concatenate other relevant files
  const otherFiles = stripped
    .filter(
      (e) => e !== bestFile && (e.endsWith(".md") || e.endsWith(".json") || e.endsWith(".txt"))
    )
    .slice(0, MAX_ZIP_FILES - 1);

  if (otherFiles.length > 0) {
    const parts = [result.content || ""];
    for (const f of otherFiles) {
      const content = await zip.files[entryMap.get(f)!].async("string");
      parts.push(`\n\n--- ${f} ---\n\n${content}`);
    }
    result.content = parts.join("");
  }

  // Try to get name from package.json if we haven't already
  if (!result.name || result.name === "Package") {
    const pkgPath = entryMap.get("package.json");
    if (pkgPath && bestFile !== "package.json") {
      try {
        const pkg = JSON.parse(await zip.files[pkgPath].async("string"));
        if (typeof pkg.name === "string") {
          result.name = titleCase(pkg.name.replace(/^@[^/]+\//, ""));
        }
        if (!result.description && typeof pkg.description === "string") {
          result.description = pkg.description;
        }
      } catch {
        // ignore malformed package.json
      }
    }
  }

  // Override name from folder name if still missing
  if (!result.name && prefix) {
    result.name = titleCase(prefix.replace(/\/$/, ""));
  }

  result.parseMessage = `Imported from ZIP: "${bestFile}" (${entries.length} file${entries.length !== 1 ? "s" : ""} in archive).`;
  return result;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractRelayFrontmatter(text: string): { content: string; relaySkillId?: string } {
  const match = text.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) return { content: text };

  const frontmatter = match[1];
  // Only process if it contains relay_ fields
  if (!/^relay_/m.test(frontmatter)) return { content: text };

  const idMatch = frontmatter.match(/^relay_skill_id:\s*(.+)$/m);
  const relaySkillId = idMatch?.[1]?.trim();

  // Strip relay frontmatter from content
  const content = text.slice(match[0].length);
  return { content, relaySkillId };
}

function titleCase(str: string): string {
  return str
    .replace(/[-_]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function extractFirstHeading(text: string): string | undefined {
  const match = text.match(/^#{1,3}\s+(.+)$/m);
  return match?.[1]?.trim();
}

function extractFirstParagraph(text: string): string | undefined {
  const lines = text.split("\n");
  const paragraphLines: string[] = [];
  let started = false;

  for (const line of lines) {
    const trimmed = line.trim();
    // Skip headings, empty lines at start, and front-matter
    if (!started) {
      if (trimmed === "" || trimmed.startsWith("#") || trimmed.startsWith("---")) continue;
      started = true;
    }
    if (started) {
      if (trimmed === "") break;
      paragraphLines.push(trimmed);
    }
  }

  const para = paragraphLines.join(" ");
  return para.length > 0 ? para.slice(0, 500) : undefined;
}

function detectSingleRootFolder(entries: string[]): string | undefined {
  if (entries.length === 0) return undefined;
  const first = entries[0];
  const slashIdx = first.indexOf("/");
  if (slashIdx === -1) return undefined;

  const prefix = first.slice(0, slashIdx + 1);
  const allMatch = entries.every((e) => e.startsWith(prefix));
  return allMatch ? prefix : undefined;
}
