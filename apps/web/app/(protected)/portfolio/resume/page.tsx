import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getResumeData } from "@/lib/resume-queries";
import { getActiveShare } from "@/app/actions/resume-share";
import { ResumeView } from "@/components/resume-view";
import { ResumePdfButton } from "@/components/resume-pdf-button";
import { ResumeShareControls } from "@/components/resume-share-controls";

export const metadata = { title: "Skills Resume | EverySkill" };

export default async function ResumePage({
  searchParams,
}: {
  searchParams: Promise<{ include?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const params = await searchParams;
  const includeCompanySkills = params.include === "company";

  const [resumeData, activeShare] = await Promise.all([
    getResumeData(session.user.id, includeCompanySkills),
    getActiveShare(),
  ]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Skills Resume</h1>
          <p className="mt-1 text-sm text-gray-500">
            Preview and share your professional skills summary
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ResumePdfButton data={resumeData} />
          <Link
            href="/portfolio"
            className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
          >
            Back to Portfolio
          </Link>
        </div>
      </div>

      {/* Share Controls */}
      <ResumeShareControls initialShare={activeShare} includeCompany={includeCompanySkills} />

      {/* Resume Preview */}
      <ResumeView data={resumeData} />
    </div>
  );
}
