import { getVersionNumber, countFeedbackSince } from "@everyskill/db/services";

/**
 * A single change detected since the user's last view of a skill.
 */
export interface ChangeItem {
  type: "version_bump" | "description_updated" | "new_feedback";
  label: string;
  detail?: string;
}

/**
 * Detect changes to a skill since the user's last view.
 *
 * Must be called BEFORE recording the new view — otherwise the comparison
 * baseline is lost (pitfall TEMP-03).
 *
 * @param skillId - The skill to check
 * @param lastViewedAt - When the user last viewed this skill
 * @param lastViewedVersion - The version number at last view (may be null for legacy views)
 * @param currentVersionId - The skill's current publishedVersionId (may be null if unpublished)
 */
export async function detectChanges(
  skillId: string,
  lastViewedAt: Date,
  lastViewedVersion: number | null,
  currentVersionId: string | null
): Promise<ChangeItem[]> {
  const changes: ChangeItem[] = [];

  // Version bump detection
  if (lastViewedVersion !== null && currentVersionId !== null) {
    const currentVersion = await getVersionNumber(currentVersionId);
    if (currentVersion !== null && currentVersion > lastViewedVersion) {
      changes.push({
        type: "version_bump",
        label: "New version published",
        detail: `v${lastViewedVersion} \u2192 v${currentVersion}`,
      });
    }
  }

  // New feedback detection
  const feedbackCount = await countFeedbackSince(skillId, lastViewedAt);
  if (feedbackCount > 0) {
    changes.push({
      type: "new_feedback",
      label: `${feedbackCount} new feedback item${feedbackCount > 1 ? "s" : ""}`,
    });
  }

  return changes;
}
