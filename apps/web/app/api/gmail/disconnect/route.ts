import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getGmailTokenDecrypted, deleteGmailTokens } from "@everyskill/db";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Attempt to revoke the token with Google (best-effort)
  const token = await getGmailTokenDecrypted(session.user.id);
  if (token) {
    try {
      await fetch(
        `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token.accessToken)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        }
      );
    } catch {
      // Non-fatal: Google revocation failure doesn't block disconnect
      console.warn("Gmail token revocation with Google failed (non-fatal)");
    }
  }

  // Delete tokens from the database regardless of revocation outcome
  await deleteGmailTokens(session.user.id);

  return NextResponse.json({ disconnected: true });
}
