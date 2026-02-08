import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db, skills } from "@everyskill/db";
import { eq, desc, sql } from "drizzle-orm";
import { MySkillsList, type MySkillItem } from "@/components/my-skills-list";
import Link from "next/link";

export default async function MySkillsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  if (!db) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <p className="text-gray-600">Database not configured</p>
      </div>
    );
  }

  const userSkills = await db
    .select({
      id: skills.id,
      name: skills.name,
      slug: skills.slug,
      category: skills.category,
      status: skills.status,
      statusMessage: skills.statusMessage,
      totalUses: skills.totalUses,
      averageRating: skills.averageRating,
      createdAt: skills.createdAt,
      forkCount: sql<number>`(SELECT count(*)::int FROM skills s2 WHERE s2.forked_from_id = ${skills.id})`,
    })
    .from(skills)
    .where(eq(skills.authorId, session.user.id))
    .orderBy(desc(skills.createdAt));

  const serialized: MySkillItem[] = userSkills.map((s) => ({
    ...s,
    statusMessage: s.statusMessage ?? null,
    createdAt: s.createdAt.toISOString(),
  }));

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Skills</h1>
          <p className="mt-1 text-sm text-gray-600">Skills you&apos;ve created</p>
        </div>
        <Link
          href="/skills/new"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          New Skill
        </Link>
      </div>

      <div className="mt-6">
        {serialized.length === 0 ? (
          <div className="rounded-lg bg-white p-8 text-center shadow-sm">
            <p className="text-gray-600">You haven&apos;t created any skills yet.</p>
            <Link
              href="/skills/new"
              className="mt-3 inline-block text-sm font-medium text-blue-600 hover:text-blue-500"
            >
              Create your first skill &rarr;
            </Link>
          </div>
        ) : (
          <MySkillsList skills={serialized} />
        )}
      </div>
    </div>
  );
}
