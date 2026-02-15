import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/admin";
import { SkillsTab } from "@/components/skills-tab";
import { TimeRangeSelector } from "@/components/time-range-selector";
import { getSkillUsage, getStartDate, type TimeRange } from "@/lib/analytics-queries";

export const metadata = { title: "Skills Usage | EverySkill" };

interface SkillsPageProps {
  searchParams: Promise<{ range?: string }>;
}

export default async function LeverageSkillsPage({ searchParams }: SkillsPageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  if (!isAdmin(session)) {
    redirect("/leverage");
  }

  const tenantId = session.user.tenantId;
  if (!tenantId) redirect("/login");

  const params = await searchParams;
  const range = (params.range || "30d") as TimeRange;
  const startDate = getStartDate(range);

  const skillData = await getSkillUsage(tenantId, startDate);

  return (
    <>
      <div className="mb-6 flex items-center justify-end">
        <Suspense fallback={<div className="h-10 w-64 animate-pulse rounded bg-gray-200" />}>
          <TimeRangeSelector />
        </Suspense>
      </div>
      <SkillsTab data={skillData} />
    </>
  );
}
