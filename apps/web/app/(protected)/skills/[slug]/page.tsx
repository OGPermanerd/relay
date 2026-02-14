import { notFound } from "next/navigation";
import { db, skills, getSiteSettings } from "@everyskill/db";
import { ratings } from "@everyskill/db/schema";
import { getSkillReview, getForkCount, getTopForks, getParentSkill } from "@everyskill/db/services";
import { eq, and, desc, sql } from "drizzle-orm";
import { SkillDetail } from "@/components/skill-detail";
import { SimilarSkillsSection } from "@/components/similar-skills-section";
import { SkillDetailTabs } from "@/components/skill-detail-tabs";
import { AiReviewTab } from "@/components/ai-review-tab";
import { getSkillStats } from "@/lib/skill-stats";
import { getSkillDetailTrends } from "@/lib/skill-detail-trends";
import { hashContent } from "@/lib/content-hash";
import { fetchLoomOEmbed, extractLoomVideoId } from "@/lib/loom";
import { auth } from "@/auth";
import { RatingForm } from "@/components/rating-form";
import { ReviewsList } from "@/components/reviews-list";
import { SearchInput } from "@/components/search-input";
import { SkillTypeFilter } from "@/components/skill-type-filter";
import { ForkButton } from "@/components/fork-button";
import { InstallButton } from "@/components/install-button";
import { DeleteSkillButton } from "@/components/delete-skill-button";
import { ForksSection } from "@/components/forks-section";
import { findSimilarSkillsByName } from "@/lib/similar-skills";
import { isAdmin } from "@/lib/admin";
import Link from "next/link";

interface SkillPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function SkillPage(props: SkillPageProps) {
  const [params, searchParams] = await Promise.all([props.params, props.searchParams]);
  const autoImprove = searchParams.improve === "1";

  // Handle null db case
  if (!db) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <p className="text-gray-600">Database not configured</p>
      </div>
    );
  }

  // Fetch skill and session in parallel for access control
  const [skill, session] = await Promise.all([
    db.query.skills.findFirst({
      where: eq(skills.slug, params.slug),
      with: {
        author: {
          columns: { id: true, name: true, image: true },
        },
      },
    }),
    auth(),
  ]);

  if (!skill) {
    notFound();
  }

  // Access control: non-published skills only visible to author or admin
  const isPublished = skill.status === "published";
  const isAuthorOfSkill = session?.user?.id === skill.authorId;
  const userIsAdmin = isAdmin(session);

  if (!isPublished && !isAuthorOfSkill && !userIsAdmin) {
    notFound();
  }

  // Visibility check: personal skills only visible to author and admins
  if (skill.visibility === "personal" && !isAuthorOfSkill && !userIsAdmin) {
    notFound();
  }

  // Get usage statistics, trends, similar skills, review, content hash, fork data, Loom oEmbed, and site settings in parallel
  const [
    stats,
    trends,
    similarSkills,
    existingReview,
    currentContentHash,
    forkCount,
    topForks,
    parentSkill,
    loomEmbed,
    siteSettings,
  ] = await Promise.all([
    getSkillStats(skill.id),
    getSkillDetailTrends(skill.id),
    findSimilarSkillsByName(skill.id, skill.name, session?.user?.id),
    getSkillReview(skill.id),
    hashContent(skill.content),
    getForkCount(skill.id),
    getTopForks(skill.id, 5),
    skill.forkedFromId ? getParentSkill(skill.forkedFromId) : Promise.resolve(null),
    skill.loomUrl ? fetchLoomOEmbed(skill.loomUrl) : Promise.resolve(null),
    getSiteSettings(),
  ]);

  const allowDownload = siteSettings?.allowSkillDownload ?? true;

  // Extract Loom video ID for embed component
  const loomVideoId = skill.loomUrl ? extractLoomVideoId(skill.loomUrl) : null;

  // Fetch parent content for fork differentiation (only when skill is a fork)
  const parentContent = skill.forkedFromId
    ? await db.query.skills
        .findFirst({
          where: eq(skills.id, skill.forkedFromId),
          columns: { content: true },
        })
        .then((p) => p?.content ?? null)
    : null;

  // Compute drift status for fork skills
  let driftStatus: "diverged" | "current" | "unknown" | undefined;
  if (skill.forkedFromId && skill.forkedAtContentHash) {
    const stripFm = (c: string) => {
      const m = c.match(/^---\n[\s\S]*?\n---\n/);
      return m ? c.slice(m[0].length) : c;
    };
    const currentBodyHash = await hashContent(stripFm(skill.content));
    driftStatus = currentBodyHash === skill.forkedAtContentHash ? "current" : "diverged";
  } else if (skill.forkedFromId && !skill.forkedAtContentHash) {
    driftStatus = "unknown";
  }

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

  // Determine if current user is the skill author (reuse from access control)
  const isAuthor = isAuthorOfSkill;

  // Map review to props shape for AiReviewTab (serialize Date to string for client component)
  const reviewProps = existingReview
    ? {
        categories: existingReview.categories,
        summary: existingReview.summary,
        suggestedTitle: existingReview.suggestedTitle ?? undefined,
        suggestedDescription: existingReview.suggestedDescription ?? undefined,
        createdAt: existingReview.createdAt.toISOString(),
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
              autoImprove={autoImprove}
              forkedFromId={skill.forkedFromId ?? undefined}
              parentContent={parentContent ?? undefined}
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
            driftStatus={driftStatus}
            compareSlug={skill.forkedFromId ? skill.slug : undefined}
            loomVideoId={loomVideoId}
            loomEmbed={loomEmbed}
            currentUserId={session?.user?.id}
          />

          {/* Install, Fork, and Delete buttons */}
          <div className="mt-4 flex items-center gap-3">
            <InstallButton
              variant="full"
              skill={{ id: skill.id, name: skill.name, slug: skill.slug, category: skill.category }}
              allowDownload={allowDownload}
            />
            {session?.user && (
              <ForkButton
                skillId={skill.id}
                skillName={skill.name}
                forkCount={forkCount}
                isAuthor={isAuthor}
              />
            )}
            {session?.user && (isAuthor || isAdmin(session)) && (
              <DeleteSkillButton
                skillId={skill.id}
                skillName={skill.name}
                totalUses={skill.totalUses}
                forkCount={forkCount}
              />
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
