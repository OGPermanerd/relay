"use server";

import { auth } from "@/auth";
import { getSkillsUsed } from "@/lib/my-leverage";

/**
 * Load more usage timeline entries for the authenticated user.
 * Called from MyLeverageView client component for pagination.
 *
 * @param offset - Number of items to skip (for pagination)
 * @returns Paginated timeline entries with timestamps serialized as ISO strings
 */
export async function loadMoreUsage(offset: number) {
  const session = await auth();

  if (!session?.user?.id) {
    return { items: [] };
  }

  const result = await getSkillsUsed(session.user.id, 20, offset);

  return {
    items: result.items.map((entry) => ({
      ...entry,
      timestamp: entry.timestamp.toISOString(),
    })),
  };
}
