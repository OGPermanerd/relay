import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@everyskill/db/services/api-keys";
import { insertFeedback } from "@everyskill/db/services/skill-feedback";
import { checkRateLimit } from "@/lib/rate-limiter";
import { sanitizePayload } from "@/lib/sanitize-payload";
import { z } from "zod";

const feedbackSchema = z.object({
  skill_id: z.string().min(1, "skill_id required"),
  feedback_type: z.enum(["thumbs_up", "thumbs_down"]),
  comment: z.string().max(2000).optional(),
});

export async function POST(request: NextRequest) {
  // 1. Extract Bearer token
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Missing authorization" }, { status: 401 });
  }
  const apiKey = authHeader.slice(7);

  // 2. Validate API key
  const keyResult = await validateApiKey(apiKey);
  if (!keyResult) {
    return NextResponse.json({ error: "Invalid key" }, { status: 401 });
  }

  // 3. Rate limit check
  if (!checkRateLimit(keyResult.keyId)) {
    return NextResponse.json({ error: "Rate limited" }, { status: 429 });
  }

  // 4. Parse request body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // 5. Validate payload schema
  const parsed = feedbackSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  // 6. Sanitize comment (strip secrets)
  let sanitizedComment: string | null = null;
  if (parsed.data.comment) {
    const result = sanitizePayload(parsed.data.comment);
    sanitizedComment = result.sanitized;
  }

  // 7. Insert feedback
  await insertFeedback({
    tenantId: keyResult.tenantId,
    skillId: parsed.data.skill_id,
    userId: keyResult.userId,
    feedbackType: parsed.data.feedback_type,
    comment: sanitizedComment,
    source: "api",
  });

  // 8. Return success
  return new NextResponse(null, { status: 200 });
}
