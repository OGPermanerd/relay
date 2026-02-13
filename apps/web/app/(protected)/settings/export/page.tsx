import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { generateClaudeMd } from "@/app/actions/export-claude-md";
import { ClaudeMdPreview } from "./claude-md-preview";

export default async function ExportPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/api/auth/signin");
  }

  const result = await generateClaudeMd();

  if ("error" in result) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        {result.error}
      </div>
    );
  }

  return (
    <div>
      <ClaudeMdPreview markdown={result.markdown} />

      <p className="mt-3 text-center text-sm text-gray-500">
        Updated your preferences?{" "}
        <a href="/settings/export" className="text-blue-600 hover:underline">
          Regenerate
        </a>
      </p>
    </div>
  );
}
