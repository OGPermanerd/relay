/**
 * Convert URL type parameter to database categories
 */
export function getCategoriesToFilter(type: string | undefined): string[] | undefined {
  switch (type) {
    case "claude-skill":
      return ["agent"];
    case "ai-prompt":
      return ["prompt"];
    case "other":
      return ["workflow", "mcp"];
    default:
      return undefined; // No filter (show all)
  }
}
