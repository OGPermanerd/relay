import Link from "next/link";
import type { CommunityOverview } from "@everyskill/db";

interface CommunityCardProps {
  community: CommunityOverview;
}

export function CommunityCard({ community }: CommunityCardProps) {
  const label = community.label || `Community ${community.communityId + 1}`;

  return (
    <Link
      href={`/communities/${community.communityId}`}
      className="block rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition hover:border-blue-300 hover:shadow-md"
    >
      <h3 className="text-base font-semibold text-gray-900">{label}</h3>

      {community.description && (
        <p className="mt-1 line-clamp-2 text-sm text-gray-600">{community.description}</p>
      )}

      <div className="mt-3 flex items-center gap-3">
        <span className="text-sm text-gray-500">
          {community.memberCount} {community.memberCount === 1 ? "skill" : "skills"}
        </span>
      </div>

      {community.topSkills.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {community.topSkills.slice(0, 3).map((skill) => (
            <span
              key={skill.slug}
              className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700"
            >
              {skill.name}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}
