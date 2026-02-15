import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@everyskill/db/services/api-keys";
import { insertTrackingEvent } from "@everyskill/db/services/usage-tracking";
import { insertTokenMeasurement } from "@everyskill/db/services/token-measurements";
import { checkRateLimit } from "@/lib/rate-limiter";
import { verifyHmac } from "@/lib/hmac";
import { z } from "zod";

const trackingPayloadSchema = z.object({
  skill_id: z.string().min(1, "skill_id required"),
  tool_name: z.string().min(1).max(200),
  ts: z.string().refine((val) => !isNaN(Date.parse(val)), "Invalid timestamp"),
  hook_event: z.string().optional(),
  tool_input_snippet: z.string().max(1000).optional(),
  tool_output_snippet: z.string().max(1000).optional(),
  // Token measurement fields (optional -- backward compatible)
  model_name: z.string().max(100).optional(),
  input_tokens: z.number().int().min(0).optional(),
  output_tokens: z.number().int().min(0).optional(),
  latency_ms: z.number().int().min(0).optional(),
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
  const parsed = trackingPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  // 6. HMAC verification (optional -- graceful degradation)
  const signature = request.headers.get("x-everyskill-signature");
  if (signature) {
    const isValid = verifyHmac(JSON.stringify(body), signature, apiKey);
    if (!isValid) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
    }
  }

  // 7. Insert tracking event
  await insertTrackingEvent({
    tenantId: keyResult.tenantId,
    userId: keyResult.userId,
    skillId: parsed.data.skill_id,
    toolName: parsed.data.tool_name,
    clientTimestamp: parsed.data.ts,
    hookEvent: parsed.data.hook_event,
    metadata: {
      tool_input_snippet: parsed.data.tool_input_snippet,
      tool_output_snippet: parsed.data.tool_output_snippet,
      isExpiredKey: keyResult.isExpired,
    },
  });

  // 7b. Insert token measurement if model data is present (fire-and-forget)
  if (
    parsed.data.model_name &&
    (parsed.data.input_tokens !== undefined || parsed.data.output_tokens !== undefined)
  ) {
    void insertTokenMeasurement({
      tenantId: keyResult.tenantId,
      userId: keyResult.userId,
      skillId: parsed.data.skill_id,
      modelName: parsed.data.model_name,
      inputTokens: parsed.data.input_tokens ?? 0,
      outputTokens: parsed.data.output_tokens ?? 0,
      latencyMs: parsed.data.latency_ms,
    });
  }

  // 8. Return success
  return new NextResponse(null, { status: 200 });
}
