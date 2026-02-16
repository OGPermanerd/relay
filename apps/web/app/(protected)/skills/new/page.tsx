import { SkillUploadForm } from "@/components/skill-upload-form";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/admin";

export default async function NewSkillPage() {
  const session = await auth();
  const admin = isAdmin(session);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900">Share a New Skill</h1>
      <p className="mt-2 text-gray-600">
        Contribute to the skill marketplace by sharing your expertise.
      </p>
      <div className="mt-8">
        <SkillUploadForm isAdmin={admin} />
      </div>
    </div>
  );
}
