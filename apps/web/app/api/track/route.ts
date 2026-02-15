import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@everyskill/db/services/api-keys";
import { insertTrackingEvent } from "@everyskill/db/services/usage-tracking";
import { insertTokenMeasurement } from "@everyskill/db/services/token-measurements";
import { getSiteSettings } from "@everyskill/db/services/site-settings";
import { getOrCreateUserPreferences } from "@everyskill/db/services/user-preferences";
import { createTrainingExample } from "@everyskill/db/services/skill-feedback";
import { checkRateLimit } from "@/lib/rate-limiter";
import { verifyHmac } from "@/lib/hmac";
import { sanitizePayload } from "@/lib/sanitize-payload";
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

/**
 * Capture usage data as a training example when both tenant and user consent.
 * Fire-and-forget: logs errors in dev but never throws.
 */
async function captureUsageAsTraining(params: {
  tenantId: string;
  userId: string;
  skillId: string;
  inputSnippet: string;
  outputSnippet: string;
}): Promise<void> {
  try {
    // 1. Check tenant-level setting
    const settings = await getSiteSettings(params.tenantId);
    if (!settings?.trainingDataCaptureEnabled) return;

    // 2. Check per-user consent
    const prefs = await getOrCreateUserPreferences(params.userId, params.tenantId);
    if (!prefs?.trainingDataConsent) return;

    // 3. Sanitize input and output
    const sanitizedInput = sanitizePayload(params.inputSnippet).sanitized;
    const sanitizedOutput = sanitizePayload(params.outputSnippet).sanitized;

    // 4. Insert training example
    await createTrainingExample({
      tenantId: params.tenantId,
      skillId: params.skillId,
      userId: params.userId,
      exampleInput: sanitizedInput,
      exampleOutput: sanitizedOutput,
      source: "usage_capture",
      status: "pending", // captured examples start as pending for author review
    });
  } catch (err) {
    // Fire-and-forget: log but don't throw
    if (process.env.NODE_ENV === "development") {
      console.error("Failed to capture usage as training data:", err);
    }
  }
}

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

  // 7c. Capture usage as training example if consent given (fire-and-forget)
  if (parsed.data.tool_input_snippet && parsed.data.tool_output_snippet) {
    void captureUsageAsTraining({
      tenantId: keyResult.tenantId,
      userId: keyResult.userId,
      skillId: parsed.data.skill_id,
      inputSnippet: parsed.data.tool_input_snippet,
      outputSnippet: parsed.data.tool_output_snippet,
    });
  }

  // 8. Return success
  return new NextResponse(null, { status: 200 });
}
