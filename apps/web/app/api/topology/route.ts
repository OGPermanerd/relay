import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getTopologyGraph } from "@everyskill/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || !session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const data = await getTopologyGraph(session.user.tenantId, session.user.id);

  return NextResponse.json(data, {
    headers: { "Cache-Control": "private, max-age=60" },
  });
}
