import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { getCommunityDetail } from "@everyskill/db";
import Link from "next/link";
import type { Metadata } from "next";

interface CommunityDetailPageProps {
  params: Promise<{ communityId: string }>;
}

export async function generateMetadata({ params }: CommunityDetailPageProps): Promise<Metadata> {
  const { communityId: cid } = await params;
  const communityId = parseInt(cid, 10);
  if (isNaN(communityId)) return { title: "Community Not Found" };

  const session = await auth();
  if (!session?.user?.tenantId) return { title: "Skill Community" };

  const community = await getCommunityDetail(session.user.tenantId, communityId);
  const label = community?.label || `Community ${communityId + 1}`;
  return { title: label };
}

function similarityColor(pct: number): string {
  if (pct >= 80) return "text-green-600";
  if (pct >= 60) return "text-yellow-600";
  return "text-gray-500";
}

export default async function CommunityDetailPage({ params }: CommunityDetailPageProps) {
  const { communityId: cid } = await params;
  const communityId = parseInt(cid, 10);
  if (isNaN(communityId)) notFound();

  const session = await auth();
  if (!session?.user?.tenantId) {
    redirect("/login");
  }

  const community = await getCommunityDetail(session.user.tenantId, communityId);
  if (!community) notFound();

  const label = community.label || `Community ${communityId + 1}`;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Back link */}
      <Link
        href="/communities"
        className="mb-4 inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
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
        Back to Communities
      </Link>

      {/* Header */}
      <h1 className="text-2xl font-bold text-gray-900">{label}</h1>

      {community.description && <p className="mt-1 text-gray-600 mb-6">{community.description}</p>}

      {/* Stats bar */}
      <div className="mb-6 flex items-center gap-4 text-sm text-gray-500">
        <span>
          {community.skills.length} {community.skills.length === 1 ? "skill" : "skills"}
        </span>
        <span>Modularity: {community.modularity.toFixed(2)}</span>
      </div>

      {/* Skill list */}
      <div className="space-y-3">
        {community.skills.map((skill) => (
          <div key={skill.id} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Link
                    href={`/skills/${skill.slug}`}
                    className="font-medium text-blue-600 hover:text-blue-800"
                  >
                    {skill.name}
                  </Link>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                    {skill.category}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-gray-600">{skill.description}</p>
              </div>
              <div className="flex items-center gap-4 text-sm shrink-0">
                <span className={`font-medium ${similarityColor(skill.similarityPct)}`}>
                  {skill.similarityPct}% match
                </span>
                <span className="text-gray-400">{skill.totalUses} uses</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
