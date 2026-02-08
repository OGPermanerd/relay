import { notFound } from "next/navigation";
import { db, skills } from "@everyskill/db";
import { eq } from "drizzle-orm";
import { ReviewDiffView } from "@/components/review-diff-view";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/admin";
import Link from "next/link";

interface ComparePageProps {
  params: Promise<{ slug: string }>;
}

export default async function ComparePage(props: ComparePageProps) {
  const params = await props.params;

  if (!db) {
    return <p className="mx-auto max-w-4xl px-4 py-8 text-gray-600">Database not configured</p>;
  }

  // Fetch fork and session in parallel
  const [fork, session] = await Promise.all([
    db.query.skills.findFirst({ where: eq(skills.slug, params.slug) }),
    auth(),
  ]);

  if (!fork) notFound();

  // Access control: non-published requires author or admin
  const isPublished = fork.status === "published";
  const isAuthor = session?.user?.id === fork.authorId;
  if (!isPublished && !isAuthor && !isAdmin(session)) notFound();

  // Non-fork guard
  if (!fork.forkedFromId) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <p className="text-gray-600">
          This skill is not a fork. Comparison is only available for forked skills.
        </p>
        <Link
          href={`/skills/${params.slug}`}
          className="mt-4 inline-block text-blue-600 hover:underline"
        >
          Back to skill
        </Link>
      </div>
    );
  }

  // Fetch parent skill
  const parent = await db.query.skills.findFirst({
    where: eq(skills.id, fork.forkedFromId),
    columns: { id: true, name: true, slug: true, content: true },
  });

  // Deleted parent guard
  if (!parent) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="mb-4 text-2xl font-bold">Compare: {fork.name}</h1>
        <div className="rounded-lg border border-gray-200 p-6 text-center">
          <p className="text-gray-500">Parent skill is no longer available.</p>
        </div>
        <Link
          href={`/skills/${params.slug}`}
          className="mt-4 inline-block text-blue-600 hover:underline"
        >
          Back to skill
        </Link>
      </div>
    );
  }

  // Strip frontmatter from both for clean diff
  const stripFm = (c: string) => {
    const m = c.match(/^---\n[\s\S]*?\n---\n/);
    return m ? c.slice(m[0].length) : c;
  };
  const parentContent = stripFm(parent.content);
  const forkContent = stripFm(fork.content);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6">
        <Link href={`/skills/${params.slug}`} className="text-sm text-gray-600 hover:text-blue-600">
          &larr; Back to {fork.name}
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Content Comparison</h1>
        <p className="mt-1 text-sm text-gray-500">
          Comparing <span className="font-medium">{fork.name}</span> against parent{" "}
          <Link
            href={`/skills/${parent.slug}`}
            className="font-medium text-blue-600 hover:underline"
          >
            {parent.name}
          </Link>
        </p>
      </div>
      <ReviewDiffView
        oldContent={parentContent}
        newContent={forkContent}
        oldLabel={`Parent: ${parent.name}`}
        newLabel={`Fork: ${fork.name}`}
      />
    </div>
  );
}
