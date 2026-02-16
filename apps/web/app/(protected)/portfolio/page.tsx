import { auth } from "@/auth";
import { redirect } from "next/navigation";
import {
  getPortfolioStats,
  getPortfolioSkills,
  getContributionRanking,
} from "@/lib/portfolio-queries";
import { PortfolioView } from "@/components/portfolio-view";

export const metadata = { title: "Portfolio | EverySkill" };

export default async function PortfolioPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const tenantId = session.user.tenantId;
  if (!tenantId) {
    redirect("/login");
  }

  const [stats, skills, ranking] = await Promise.all([
    getPortfolioStats(session.user.id),
    getPortfolioSkills(session.user.id),
    getContributionRanking(session.user.id, tenantId),
  ]);

  return <PortfolioView stats={stats} skills={skills} ranking={ranking} />;
}
