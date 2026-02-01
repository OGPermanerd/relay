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
