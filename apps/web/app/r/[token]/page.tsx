import { getResumeByToken } from "@/lib/resume-queries";
import { ResumeView } from "@/components/resume-view";
import { ResumePdfButton } from "@/components/resume-pdf-button";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

// ---------------------------------------------------------------------------
// Dynamic Metadata
// ---------------------------------------------------------------------------

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const data = await getResumeByToken(token);

  if (!data) {
    return { title: "Skills Resume" };
  }

  return {
    title: `${data.userName}'s Skills Resume`,
  };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function PublicResumePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const resumeData = await getResumeByToken(token);

  if (!resumeData) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-3xl px-4">
        <div className="mb-4 flex justify-end">
          <ResumePdfButton data={resumeData} />
        </div>
        <ResumeView data={resumeData} isPublic />
      </div>
    </div>
  );
}
