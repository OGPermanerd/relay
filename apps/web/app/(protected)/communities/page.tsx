import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getCommunities } from "@everyskill/db";
import { CommunityCard } from "@/components/community-card";
import { CommunitiesViewToggle } from "@/components/communities-view-toggle";

export const metadata = { title: "Skill Communities" };

export default async function CommunitiesPage() {
  const session = await auth();
  if (!session?.user?.tenantId) {
    redirect("/login");
  }

  const communities = await getCommunities(session.user.tenantId);

  const cardsContent =
    communities.length === 0 ? (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 py-16 px-4 text-center">
        <p className="text-gray-500">
          No communities detected yet. Communities are generated automatically when enough skills
          are published.
        </p>
      </div>
    ) : (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {communities.map((community) => (
          <CommunityCard key={community.communityId} community={community} />
        ))}
      </div>
    );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Skill Communities</h1>
      <p className="text-gray-600 mb-6">
        Discover related skills grouped by thematic similarity. Communities update periodically.
      </p>

      <CommunitiesViewToggle cardsContent={cardsContent} />
    </div>
  );
}
