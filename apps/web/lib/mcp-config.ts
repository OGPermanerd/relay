import type { DetectedOS } from "@/lib/os-detection";

/**
 * Generate MCP config JSON for a skill
 * Format matches claude_desktop_config.json structure
 */
export function generateMcpConfig(skill: { name: string; slug: string }): string {
  const config = {
    mcpServers: {
      [skill.slug]: {
        command: "npx",
        args: ["-y", `@anthropic-ai/relay-${skill.slug}`],
      },
    },
  };
  return JSON.stringify(config, null, 2);
}

// ---------------------------------------------------------------------------
// Platform-specific config generation (Phase 19)
// ---------------------------------------------------------------------------

export type Platform = "claude-desktop" | "claude-code" | "other-ide" | "other-systems";

/**
 * Generate a JSON config string for the given platform.
 *
 * All platforms use the same stdio config structure with `npx -y @relay/mcp`.
 */
export function generatePlatformConfig(_platform: Platform, _origin: string): string {
  const config = {
    mcpServers: {
      "relay-skills": {
        command: "npx",
        args: ["-y", "@relay/mcp"],
      },
    },
  };
  return JSON.stringify(config, null, 2);
}

/**
 * Get the config file path for a given platform and OS combination.
 */
export function getConfigFilePath(platform: Platform, os: DetectedOS): string {
  switch (platform) {
    case "claude-desktop":
      switch (os) {
        case "macos":
          return "~/Library/Application Support/Claude/claude_desktop_config.json";
        case "windows":
          return "%APPDATA%\\Claude\\claude_desktop_config.json";
        case "linux":
          return "~/.config/Claude/claude_desktop_config.json";
      }
      break;
    case "claude-code":
      return "~/.claude.json";
    case "other-ide":
    case "other-systems":
      return "Your MCP client's config file";
  }
}

/**
 * Get brief setup instructions for a given platform.
 */
export function getConfigInstructions(platform: Platform): string {
  switch (platform) {
    case "claude-desktop":
      return "Add to your Claude Desktop config file, then restart Claude Desktop.";
    case "claude-code":
      return "Add to ~/.claude.json or run: claude mcp add relay-skills -- npx -y @relay/mcp";
    case "other-ide":
      return "Add to your IDE's MCP configuration file.";
    case "other-systems":
      return "Add to your MCP client's configuration.";
  }
}
