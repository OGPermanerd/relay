import { notFound } from "next/navigation";
import { db, skills } from "@relay/db";
import { ratings } from "@relay/db/schema";
import {
  getSkillEmbedding,
  findSimilarSkills,
  getSkillReview,
  getForkCount,
  getTopForks,
  getParentSkill,
  type SimilarSkillResult,
} from "@relay/db/services";
import { eq, and, desc, sql } from "drizzle-orm";
import { SkillDetail } from "@/components/skill-detail";
import { SimilarSkillsSection } from "@/components/similar-skills-section";
import { SkillDetailTabs } from "@/components/skill-detail-tabs";
import { AiReviewTab } from "@/components/ai-review-tab";
import { getSkillStats } from "@/lib/skill-stats";
import { getSkillDetailTrends } from "@/lib/skill-detail-trends";
import { hashContent } from "@/lib/content-hash";
import { auth } from "@/auth";
import { RatingForm } from "@/components/rating-form";
import { ReviewsList } from "@/components/reviews-list";
import { SearchInput } from "@/components/search-input";
import { SkillTypeFilter } from "@/components/skill-type-filter";
import { ForkButton } from "@/components/fork-button";
import { InstallButton } from "@/components/install-button";
import { ForksSection } from "@/components/forks-section";
import Link from "next/link";

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

  // Get usage statistics, trends, similar skills, review, content hash, and fork data in parallel
  const [
    stats,
    trends,
    similarSkills,
    existingReview,
    currentContentHash,
    forkCount,
    topForks,
    parentSkill,
  ] = await Promise.all([
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
    getSkillReview(skill.id),
    hashContent(skill.content),
    getForkCount(skill.id),
    getTopForks(skill.id, 5),
    skill.forkedFromId ? getParentSkill(skill.forkedFromId) : Promise.resolve(null),
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

  // Determine if current user is the skill author
  const isAuthor = session?.user?.id === skill.authorId;

  // Map review to props shape for AiReviewTab
  const reviewProps = existingReview
    ? {
        categories: existingReview.categories,
        summary: existingReview.summary,
        createdAt: existingReview.createdAt,
        modelName: existingReview.modelName,
        isVisible: existingReview.isVisible,
        reviewedContentHash: existingReview.reviewedContentHash,
      }
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
      {/* Search bar and filters */}
      <div className="mb-6 flex items-center gap-4">
        <Link
          href="/skills"
          className="flex items-center gap-1 text-sm text-gray-600 hover:text-blue-600 transition-colors"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
            />
          </svg>
          Back to Skills
        </Link>
        <div className="flex-1">
          <SearchInput />
        </div>
        <SkillTypeFilter />
      </div>

      <div className="max-w-4xl">
        <SkillDetailTabs
          aiReviewContent={
            <AiReviewTab
              skillId={skill.id}
              isAuthor={isAuthor}
              existingReview={reviewProps}
              currentContentHash={currentContentHash}
              skillSlug={skill.slug}
            />
          }
        >
          {/* Details tab content -- preserves existing page layout */}
          <SkillDetail
            skill={skill}
            stats={stats}
            trends={trends}
            forkCount={forkCount}
            parentSkill={parentSkill}
          />

          {/* Install and Fork buttons */}
          <div className="mt-4 flex items-center gap-3">
            <InstallButton variant="full" />
            {session?.user && (
              <ForkButton skillId={skill.id} skillName={skill.name} forkCount={forkCount} />
            )}
          </div>

          {/* Forks section */}
          {topForks.length > 0 && (
            <div className="mt-8">
              <ForksSection forks={topForks} totalForkCount={forkCount} parentSlug={skill.slug} />
            </div>
          )}

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
                author={skill.author ? { id: skill.author.id, name: skill.author.name } : undefined}
              />
            </div>
          )}

          {/* Reviews section */}
          <div className="mt-8">
            <h2 className="mb-4 text-xl font-semibold">Reviews ({reviews.length})</h2>
            <ReviewsList reviews={reviews} />
          </div>
        </SkillDetailTabs>
      </div>
    </div>
  );
}
