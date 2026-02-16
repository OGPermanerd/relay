import { db, skills, users } from "@everyskill/db";
import { eq, and, desc, inArray } from "drizzle-orm";

export interface CompanyApprovedSkill {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  totalUses: number;
  loomUrl: string | null;
  authorName: string | null;
}

export async function getCompanyApprovedSkills(limit = 6): Promise<CompanyApprovedSkill[]> {
  if (!db) return [];
  const rows = await db
    .select({
      id: skills.id,
      name: skills.name,
      slug: skills.slug,
      description: skills.description,
      category: skills.category,
      totalUses: skills.totalUses,
      loomUrl: skills.loomUrl,
      authorName: users.name,
    })
    .from(skills)
    .leftJoin(users, eq(skills.authorId, users.id))
    .where(
      and(
        eq(skills.companyApproved, true),
        eq(skills.status, "published"),
        inArray(skills.visibility, ["global_approved", "tenant"])
      )
    )
    .orderBy(desc(skills.approvedAt))
    .limit(limit);
  return rows;
}
