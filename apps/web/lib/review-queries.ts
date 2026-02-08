import { db, skills, users, reviewDecisions } from "@everyskill/db";
import { eq, and, sql, desc, count } from "drizzle-orm";
import { getSkillReview, getDecisionsForSkill } from "@everyskill/db";
import type { DecisionWithReviewer } from "@everyskill/db";
import type { SkillReview } from "@everyskill/db";

// =============================================================================
// Types
// =============================================================================

/**
 * Single item in the review queue list
 * Dates serialized as ISO strings for hydration safety
 */
export interface ReviewQueueItem {
  id: string;
  name: string;
  slug: string;
  category: string;
  status: string;
  authorName: string | null;
  authorId: string | null;
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
}

/**
 * Paginated review queue result with total count
 */
export interface ReviewQueueResult {
  skills: ReviewQueueItem[];
  total: number;
}

/**
 * Parameters for querying the review queue
 */
export interface ReviewQueueParams {
  tenantId: string;
  page: number;
  pageSize: number;
  status?: string;
  category?: string;
  dateFrom?: string; // ISO date string
  dateTo?: string; // ISO date string
}

/**
 * Decision record with serialized date for client consumption
 */
export interface SerializedDecision {
  id: string;
  action: string;
  notes: string | null;
  reviewerName: string | null;
  createdAt: string; // ISO string
}

/**
 * Full review detail result for the admin review detail page
 */
export interface ReviewDetailResult {
  skill: {
    id: string;
    name: string;
    slug: string;
    description: string;
    content: string;
    category: string;
    tags: string[] | null;
    status: string;
    statusMessage: string | null;
    createdAt: string; // ISO string
    updatedAt: string; // ISO string
    author: {
      id: string;
      name: string | null;
      image: string | null;
    } | null;
  };
  aiReview: SkillReview | null;
  decisions: SerializedDecision[];
  previousContent: string | null;
}

// =============================================================================
// Query Functions
// =============================================================================

/**
 * Get paginated review queue for a tenant
 *
 * Returns skills filtered by status (default: "ai_reviewed"), category, and date range.
 * Results ordered by updatedAt DESC (most recently updated first).
 */
export async function getReviewQueue(params: ReviewQueueParams): Promise<ReviewQueueResult> {
  if (!db) {
    return { skills: [], total: 0 };
  }

  const { tenantId, page, pageSize, status, category, dateFrom, dateTo } = params;
  const effectiveStatus = status ?? "ai_reviewed";
  const offset = (page - 1) * pageSize;

  // Build WHERE conditions
  const conditions = [eq(skills.tenantId, tenantId), eq(skills.status, effectiveStatus)];

  if (category) {
    conditions.push(eq(skills.category, category));
  }

  if (dateFrom) {
    conditions.push(sql`${skills.createdAt} >= ${dateFrom}::timestamptz`);
  }

  if (dateTo) {
    conditions.push(sql`${skills.createdAt} <= ${dateTo}::timestamptz`);
  }

  const whereClause = and(...conditions);

  // Run data and count queries in parallel
  const [rows, countResult] = await Promise.all([
    db
      .select({
        id: skills.id,
        name: skills.name,
        slug: skills.slug,
        category: skills.category,
        status: skills.status,
        authorName: users.name,
        authorId: skills.authorId,
        createdAt: skills.createdAt,
        updatedAt: skills.updatedAt,
      })
      .from(skills)
      .leftJoin(users, eq(skills.authorId, users.id))
      .where(whereClause)
      .orderBy(desc(skills.updatedAt))
      .limit(pageSize)
      .offset(offset),
    db.select({ total: count() }).from(skills).where(whereClause),
  ]);

  return {
    skills: rows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      category: row.category,
      status: row.status,
      authorName: row.authorName,
      authorId: row.authorId,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    })),
    total: countResult[0]?.total ?? 0,
  };
}

/**
 * Get full review detail for a skill including AI review and decision history
 *
 * Returns null if skill not found or doesn't belong to tenant.
 */
export async function getReviewDetail(
  skillId: string,
  tenantId: string
): Promise<ReviewDetailResult | null> {
  if (!db) {
    return null;
  }

  // Fetch skill with author
  const skillRows = await db
    .select({
      id: skills.id,
      name: skills.name,
      slug: skills.slug,
      description: skills.description,
      content: skills.content,
      category: skills.category,
      tags: skills.tags,
      status: skills.status,
      statusMessage: skills.statusMessage,
      createdAt: skills.createdAt,
      updatedAt: skills.updatedAt,
      authorId: skills.authorId,
      authorName: users.name,
      authorImage: users.image,
    })
    .from(skills)
    .leftJoin(users, eq(skills.authorId, users.id))
    .where(and(eq(skills.id, skillId), eq(skills.tenantId, tenantId)))
    .limit(1);

  const skillRow = skillRows[0];
  if (!skillRow) {
    return null;
  }

  // Fetch AI review, decisions, and most recent previous content in parallel
  const [aiReview, decisions, previousContentRows] = await Promise.all([
    getSkillReview(skillId),
    getDecisionsForSkill(skillId),
    db
      .select({ previousContent: reviewDecisions.previousContent })
      .from(reviewDecisions)
      .where(eq(reviewDecisions.skillId, skillId))
      .orderBy(desc(reviewDecisions.createdAt))
      .limit(1),
  ]);

  // Serialize decisions dates
  const serializedDecisions: SerializedDecision[] = decisions.map((d: DecisionWithReviewer) => ({
    id: d.id,
    action: d.action,
    notes: d.notes,
    reviewerName: d.reviewerName,
    createdAt: d.createdAt.toISOString(),
  }));

  // Extract previous content from most recent decision (if any)
  const previousContent = previousContentRows[0]?.previousContent ?? null;

  return {
    skill: {
      id: skillRow.id,
      name: skillRow.name,
      slug: skillRow.slug,
      description: skillRow.description,
      content: skillRow.content,
      category: skillRow.category,
      tags: skillRow.tags,
      status: skillRow.status,
      statusMessage: skillRow.statusMessage,
      createdAt: skillRow.createdAt.toISOString(),
      updatedAt: skillRow.updatedAt.toISOString(),
      author: skillRow.authorId
        ? {
            id: skillRow.authorId,
            name: skillRow.authorName,
            image: skillRow.authorImage,
          }
        : null,
    },
    aiReview,
    decisions: serializedDecisions,
    previousContent,
  };
}

/**
 * Get count of skills pending admin review for a tenant
 *
 * Counts skills with status "ai_reviewed" — these have passed AI review
 * and are waiting for human admin approval.
 */
export async function getPendingReviewCount(tenantId: string): Promise<number> {
  if (!db) {
    return 0;
  }

  const result = await db
    .select({ total: count() })
    .from(skills)
    .where(and(eq(skills.tenantId, tenantId), eq(skills.status, "ai_reviewed")));

  return result[0]?.total ?? 0;
}
