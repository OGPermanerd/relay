import { notFound } from "next/navigation";
import { db, skills } from "@relay/db";
import { ratings } from "@relay/db/schema";
import { getSkillEmbedding, findSimilarSkills, type SimilarSkillResult } from "@relay/db/services";
import { eq, and, desc, sql } from "drizzle-orm";
import { SkillDetail } from "@/components/skill-detail";
import { SimilarSkillsSection } from "@/components/similar-skills-section";
import { getSkillStats } from "@/lib/skill-stats";
import { getSkillDetailTrends } from "@/lib/skill-detail-trends";
import { auth } from "@/auth";
import { RatingForm } from "@/components/rating-form";
import { ReviewsList } from "@/components/reviews-list";

interface SkillPageProps {
  params: Promise<{ slug: string }>;
}

export default async function SkillPage(props: SkillPageProps) {
  const params = await props.params;

  // Handle null db case
  if (!db) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <p className="text-gray-600">Database not configured</p>
      </div>
    );
  }

  // Fetch skill from database with author relation
  const skill = await db.query.skills.findFirst({
    where: eq(skills.slug, params.slug),
    with: {
      author: {
        columns: { id: true, name: true, image: true },
      },
    },
  });

  if (!skill) {
    notFound();
  }

  // Get usage statistics, trends, and similar skills in parallel
  const [stats, trends, similarSkills] = await Promise.all([
    getSkillStats(skill.id),
    getSkillDetailTrends(skill.id),
    // Query similar skills using the skill's embedding
    (async (): Promise<SimilarSkillResult[]> => {
      try {
        const embedding = await getSkillEmbedding(skill.id);
        if (embedding?.embedding) {
          return await findSimilarSkills(embedding.embedding, {
            threshold: 0.7,
            limit: 5,
            excludeSkillId: skill.id,
          });
        }
        return [];
      } catch (error) {
        // Log but don't fail - similar skills is enhancement, not critical
        console.warn("Failed to fetch similar skills:", error);
        return [];
      }
    })(),
  ]);

  // Get session for authenticated user
  const session = await auth();

  // Query user's existing rating (if logged in)
  const existingRating =
    session?.user?.id && db
      ? await db.query.ratings.findFirst({
          where: and(eq(ratings.skillId, skill.id), eq(ratings.userId, session.user.id)),
          columns: {
            rating: true,
            comment: true,
            hoursSavedEstimate: true,
          },
        })
      : null;

  // Query reviews for this skill (exclude current user to avoid showing their own review in list)
  const reviews = db
    ? await db.query.ratings.findMany({
        where: session?.user?.id
          ? and(eq(ratings.skillId, skill.id), sql`${ratings.userId} != ${session.user.id}`)
          : eq(ratings.skillId, skill.id),
        with: {
          user: {
            columns: { name: true, image: true },
          },
        },
        orderBy: desc(ratings.createdAt),
        limit: 20,
      })
    : [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="max-w-4xl">
        <SkillDetail skill={skill} stats={stats} trends={trends} />

        {/* Similar Skills section */}
        {similarSkills.length > 0 && (
          <div className="mt-8">
            <SimilarSkillsSection similarSkills={similarSkills} />
          </div>
        )}

        {/* Rating form for authenticated users */}
        {session?.user && (
          <div className="mt-8 rounded-lg border border-gray-200 p-6">
            <h2 className="mb-4 text-xl font-semibold">
              {existingRating ? "Update Your Rating" : "Rate This Skill"}
            </h2>
            <RatingForm
              skillId={skill.id}
              skillSlug={skill.slug}
              existingRating={existingRating ?? undefined}
            />
          </div>
        )}

        {/* Reviews section */}
        <div className="mt-8">
          <h2 className="mb-4 text-xl font-semibold">Reviews ({reviews.length})</h2>
          <ReviewsList reviews={reviews} />
        </div>
      </div>
    </div>
  );
}
