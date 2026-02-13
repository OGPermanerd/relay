import { trackUsage } from "../tracking/events.js";
import { getUserId } from "../auth.js";

export async function handleConfirmInstall({ skillId }: { skillId: string }) {
  const userId = getUserId() ?? undefined;

  await trackUsage({ toolName: "confirm_install", skillId, userId }, { skipIncrement: true });

  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({ success: true, message: "Installation confirmed" }),
      },
    ],
  };
}
