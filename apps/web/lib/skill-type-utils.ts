/**
 * Convert URL type parameter to database categories
 */
export function getCategoriesToFilter(type: string | undefined): string[] | undefined {
  switch (type) {
    case "productivity":
      return ["productivity"];
    case "wiring":
      return ["wiring"];
    case "doc-production":
      return ["doc-production"];
    case "data-viz":
      return ["data-viz"];
    case "code":
      return ["code"];
    default:
      return undefined; // No filter (show all)
  }
}
