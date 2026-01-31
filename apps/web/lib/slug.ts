import { db, skills } from "@relay/db";
import { like } from "drizzle-orm";

/**
 * Generate a URL-safe slug from a skill name
 * @param name - The skill name to convert
 * @returns A URL-safe slug (lowercase, alphanumeric + hyphens, max 50 chars)
 */
export function generateSlug(name: string): string {
  if (!name || name.trim().length === 0) {
    return "skill";
  }

  // Normalize string with NFD (canonical decomposition) and remove diacritics
  const normalized = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // Convert to lowercase, replace non-alphanumeric with hyphens
  const slug = normalized
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") // Trim leading/trailing hyphens
    .slice(0, 50); // Limit to 50 characters

  return slug || "skill";
}

/**
 * Generate a unique slug by checking for collisions in the database
 * @param name - The skill name to convert
 * @param database - The drizzle database instance
 * @returns A unique URL-safe slug
 */
export async function generateUniqueSlug(name: string, database: typeof db): Promise<string> {
  const baseSlug = generateSlug(name);

  // Handle null database case (graceful degradation)
  if (!database) {
    return baseSlug;
  }

  // Check for existing skills with this slug or slug-prefix
  const existingSkills = await database
    .select({ slug: skills.slug })
    .from(skills)
    .where(like(skills.slug, `${baseSlug}%`));

  // No collision - use base slug
  if (existingSkills.length === 0) {
    return baseSlug;
  }

  // Collision exists - append 8-char UUID suffix
  const suffix = crypto.randomUUID().slice(0, 8);
  return `${baseSlug}-${suffix}`;
}
