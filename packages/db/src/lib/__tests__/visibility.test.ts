import { describe, it, expect } from "vitest";
import { type SQL } from "drizzle-orm";
import {
  VISIBILITY_LEVELS,
  ORG_VISIBLE_LEVELS,
  isOrgVisible,
  orgVisibleSQL,
  buildVisibilityFilter,
  visibilitySQL,
} from "../visibility";

/**
 * Recursively extract all string values from a Drizzle SQL object.
 * Handles nested queryChunks, Param values, and column references.
 */
function extractSQLStrings(obj: unknown, seen = new WeakSet()): string[] {
  if (obj === null || obj === undefined) return [];
  if (typeof obj === "string") return [obj];
  if (typeof obj === "number" || typeof obj === "boolean") return [String(obj)];

  if (typeof obj !== "object") return [];

  // Prevent circular reference loops
  if (seen.has(obj as object)) return [];
  seen.add(obj as object);

  const strings: string[] = [];

  // Handle Drizzle Param and StringChunk objects (contain a value property)
  if ("value" in (obj as Record<string, unknown>)) {
    const val = (obj as Record<string, unknown>).value;
    if (typeof val === "string") {
      strings.push(val);
    } else if (Array.isArray(val)) {
      for (const item of val) {
        if (typeof item === "string") strings.push(item);
      }
    }
  }

  // Handle Drizzle Column objects (contain a name property for the column name)
  if ("name" in (obj as Record<string, unknown>)) {
    const name = (obj as Record<string, unknown>).name;
    if (typeof name === "string") strings.push(name);
  }

  // Handle queryChunks arrays
  if ("queryChunks" in (obj as Record<string, unknown>)) {
    const chunks = (obj as Record<string, unknown>).queryChunks;
    if (Array.isArray(chunks)) {
      for (const chunk of chunks) {
        strings.push(...extractSQLStrings(chunk, seen));
      }
    }
  }

  // Handle arrays directly
  if (Array.isArray(obj)) {
    for (const item of obj) {
      strings.push(...extractSQLStrings(item, seen));
    }
  }

  return strings;
}

/**
 * Convert a Drizzle SQL object to a flat string for content assertions.
 */
function sqlToString(sqlObj: SQL): string {
  return extractSQLStrings(sqlObj).join(" ");
}

describe("VISIBILITY_LEVELS", () => {
  it("exports all 4 visibility levels", () => {
    expect(VISIBILITY_LEVELS).toEqual(["global_approved", "tenant", "personal", "private"]);
  });

  it("has exactly 4 levels", () => {
    expect(VISIBILITY_LEVELS).toHaveLength(4);
  });
});

describe("ORG_VISIBLE_LEVELS", () => {
  it("exports only global_approved and tenant", () => {
    expect(ORG_VISIBLE_LEVELS).toEqual(["global_approved", "tenant"]);
  });

  it("has exactly 2 levels", () => {
    expect(ORG_VISIBLE_LEVELS).toHaveLength(2);
  });
});

describe("isOrgVisible", () => {
  it("returns true for global_approved", () => {
    expect(isOrgVisible("global_approved")).toBe(true);
  });

  it("returns true for tenant", () => {
    expect(isOrgVisible("tenant")).toBe(true);
  });

  it("returns false for personal", () => {
    expect(isOrgVisible("personal")).toBe(false);
  });

  it("returns false for private", () => {
    expect(isOrgVisible("private")).toBe(false);
  });

  it("returns false for unknown values", () => {
    expect(isOrgVisible("unknown")).toBe(false);
    expect(isOrgVisible("")).toBe(false);
  });
});

describe("orgVisibleSQL", () => {
  it("returns SQL containing both global_approved and tenant", () => {
    const result = orgVisibleSQL();
    const str = sqlToString(result);

    expect(str).toContain("global_approved");
    expect(str).toContain("tenant");
  });
});

describe("buildVisibilityFilter", () => {
  it("without userId: returns filter for global_approved and tenant only", () => {
    const filter = buildVisibilityFilter();
    expect(filter).toBeDefined();

    const str = sqlToString(filter);

    expect(str).toContain("global_approved");
    expect(str).toContain("tenant");
    // Should NOT contain personal or private when no userId
    expect(str).not.toContain("personal");
    expect(str).not.toContain("private");
  });

  it("with userId: returns filter for all 4 levels", () => {
    const userId = "test-user-123";
    const filter = buildVisibilityFilter(userId);
    expect(filter).toBeDefined();

    const str = sqlToString(filter);

    expect(str).toContain("global_approved");
    expect(str).toContain("tenant");
    expect(str).toContain("personal");
    expect(str).toContain("private");
    // Should reference the author column
    expect(str).toContain("author_id");
  });

  it("with userId: includes the userId in author checks", () => {
    const userId = "user-abc-456";
    const filter = buildVisibilityFilter(userId);
    const str = sqlToString(filter);

    expect(str).toContain(userId);
  });
});

describe("visibilitySQL", () => {
  it("without userId: returns SQL matching global_approved and tenant", () => {
    const result = visibilitySQL();
    const str = sqlToString(result);

    expect(str).toContain("global_approved");
    expect(str).toContain("tenant");
    expect(str).not.toContain("personal");
    expect(str).not.toContain("private");
    expect(str).not.toContain("author_id");
  });

  it("with userId: returns SQL matching all 4 levels with author check", () => {
    const userId = "test-user-789";
    const result = visibilitySQL(userId);
    const str = sqlToString(result);

    expect(str).toContain("global_approved");
    expect(str).toContain("tenant");
    expect(str).toContain("personal");
    expect(str).toContain("private");
    expect(str).toContain("author_id");
  });

  it("with userId: includes the userId as a parameter", () => {
    const userId = "user-xyz-000";
    const result = visibilitySQL(userId);
    const str = sqlToString(result);

    expect(str).toContain(userId);
  });

  it("without userId: does not include author_id check", () => {
    const result = visibilitySQL();
    const str = sqlToString(result);
    expect(str).not.toContain("author_id");
  });
});
