import Link from "next/link";

interface ForkAttributionProps {
  parentSkill: {
    id: string;
    name: string;
    slug: string;
    author: { id: string; name: string | null } | null;
  } | null;
}

export function ForkAttribution({ parentSkill }: ForkAttributionProps) {
  if (!parentSkill) return null;

  return (
    <p className="mt-1 text-sm text-gray-500">
      Forked from{" "}
      <Link
        href={`/skills/${parentSkill.slug}`}
        className="font-medium text-blue-600 hover:text-blue-800 transition-colors"
      >
        {parentSkill.name}
      </Link>
      {parentSkill.author && (
        <>
          {" "}
          by{" "}
          <Link
            href={`/users/${parentSkill.author.id}`}
            className="font-medium text-blue-600 hover:text-blue-800 transition-colors"
          >
            {parentSkill.author.name || "Anonymous"}
          </Link>
        </>
      )}
    </p>
  );
}
