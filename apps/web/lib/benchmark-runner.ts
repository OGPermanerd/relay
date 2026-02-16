import Anthropic from "@anthropic-ai/sdk";
import {
  createBenchmarkRun,
  completeBenchmarkRun,
  insertBenchmarkResult,
} from "@everyskill/db/services";
import { estimateCostMicrocents } from "@everyskill/db/services/pricing";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BENCHMARK_MODELS = ["claude-sonnet-4-5-20250929", "claude-haiku-4-5-20251001"];

const JUDGE_MODEL = "claude-sonnet-4-5-20250929";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RunBenchmarkParams {
  tenantId: string;
  skillId: string;
  triggeredBy: string;
  skillContent: string;
  skillName: string;
  testCases: { input: string; expectedOutput: string | null }[];
  models?: string[];
}

export interface RunBenchmarkResult {
  runId: string;
  status: "completed" | "failed";
  resultCount: number;
  error?: string;
}

interface JudgeOutput {
  qualityScore: number;
  qualityNotes: string;
  matchesExpected: boolean;
  faithfulnessScore: number; // 0-100
  relevancyScore: number; // 0-100
  precisionScore: number; // 0-100
  recallScore: number; // 0-100
}

// ---------------------------------------------------------------------------
// Anthropic client
// ---------------------------------------------------------------------------

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY environment variable is not set. " +
        "Get an API key from https://console.anthropic.com/settings/keys " +
        "and add it to .env.local."
    );
  }
  return new Anthropic({ apiKey });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildPrompt(skillContent: string, testInput: string): string {
  return `You are using the following skill/prompt:\n\n<skill>\n${skillContent}\n</skill>\n\nApply this skill to the following input:\n\n<input>\n${testInput}\n</input>`;
}

// JSON schema for structured judge output
const JUDGE_JSON_SCHEMA = {
  type: "object" as const,
  properties: {
    qualityScore: { type: "number" as const },
    qualityNotes: { type: "string" as const },
    matchesExpected: { type: "boolean" as const },
    faithfulnessScore: { type: "number" as const },
    relevancyScore: { type: "number" as const },
    precisionScore: { type: "number" as const },
    recallScore: { type: "number" as const },
  },
  required: [
    "qualityScore",
    "qualityNotes",
    "matchesExpected",
    "faithfulnessScore",
    "relevancyScore",
    "precisionScore",
    "recallScore",
  ],
  additionalProperties: false,
};

/**
 * Judge the quality of a model output using a blinded evaluation.
 * The judge does NOT know which model produced the output (anti-bias per BENCH-07).
 * Scores 5 dimensions: overall quality + 4 RAGAS dimensions (faithfulness, relevancy, precision, recall).
 */
async function judgeQuality(
  client: Anthropic,
  skillContent: string,
  output: string,
  expectedOutput: string | null,
  testInput: string
): Promise<JudgeOutput> {
  const expectedSection = expectedOutput
    ? `\n\n<expected_output>\n${expectedOutput}\n</expected_output>`
    : "\n\nNo expected output is provided. Judge based on helpfulness, correctness, and completeness alone.";

  const userPrompt = `Evaluate the following output produced by an AI skill.

<skill_instructions>
${skillContent}
</skill_instructions>

<input>
${testInput}
</input>

<output>
${output}
</output>${expectedSection}

Score the output on FIVE dimensions (0-100 each). Each dimension MUST be scored independently.

1. OVERALL QUALITY (qualityScore): Holistic assessment of correctness, completeness, and usefulness.

2. FAITHFULNESS (faithfulnessScore): Does the output follow the skill instructions without hallucinating, deviating, or adding unsupported claims? 100 = perfectly faithful to instructions. 0 = completely ignores or contradicts instructions.

3. RELEVANCY (relevancyScore): Is the output relevant to the specific input provided? 100 = directly and completely addresses the input. 0 = output has nothing to do with the input.

4. PRECISION (precisionScore): Did the model use the skill instructions effectively? 100 = every part of the skill was leveraged appropriately. 0 = skill instructions were completely ignored.

5. RECALL (recallScore): Does the output address ALL aspects of the input? 100 = every aspect of the input is covered. 0 = major aspects of the input were missed.

Example of valid divergent scoring:
- An output that perfectly follows instructions (faithfulness=95) but only addresses half the input (recall=50)
- An output that covers everything in the input (recall=90) but ignores the skill format requirements (precision=40)
- A thorough, relevant response (relevancy=90, recall=85) that adds claims not in the skill instructions (faithfulness=55)`;

  const response = await client.messages.create({
    model: JUDGE_MODEL,
    max_tokens: 1024,
    system:
      "You are an impartial quality evaluator for AI skill outputs. Score the output on 5 dimensions (0-100 each). " +
      "Each dimension MUST be scored independently -- it is expected and correct for scores to differ by 20+ points. " +
      "Do not anchor one score on another.",
    messages: [{ role: "user", content: userPrompt }],
    output_config: {
      format: { type: "json_schema", schema: JUDGE_JSON_SCHEMA },
    },
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    return {
      qualityScore: 0,
      qualityNotes: "No judge response",
      matchesExpected: false,
      faithfulnessScore: 0,
      relevancyScore: 0,
      precisionScore: 0,
      recallScore: 0,
    };
  }

  try {
    return JSON.parse(textBlock.text) as JudgeOutput;
  } catch {
    return {
      qualityScore: 0,
      qualityNotes: "Failed to parse judge output",
      matchesExpected: false,
      faithfulnessScore: 0,
      relevancyScore: 0,
      precisionScore: 0,
      recallScore: 0,
    };
  }
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Run a benchmark for a skill across multiple Claude models.
 *
 * Execution flow:
 * 1. Create a benchmark run in the database
 * 2. For each test case (sequential):
 *    a. Execute the skill across all models (parallel via Promise.allSettled)
 *    b. Judge each output quality with a blinded AI evaluator
 *    c. Store results in the database
 * 3. Compute summary stats (best quality model, cheapest model)
 * 4. Complete the run
 */
export async function runBenchmark(params: RunBenchmarkParams): Promise<RunBenchmarkResult> {
  const models = params.models ?? BENCHMARK_MODELS;
  const client = getClient();

  // 1. Create the run
  const run = await createBenchmarkRun({
    tenantId: params.tenantId,
    skillId: params.skillId,
    triggeredBy: params.triggeredBy,
    models,
  });

  try {
    let resultCount = 0;

    // Track per-model aggregate stats for summary
    const modelStats: Record<string, { totalQuality: number; totalCost: number; count: number }> =
      {};
    for (const model of models) {
      modelStats[model] = { totalQuality: 0, totalCost: 0, count: 0 };
    }

    // 2. For each test case (sequential to avoid overwhelming the API)
    for (let caseIdx = 0; caseIdx < params.testCases.length; caseIdx++) {
      const testCase = params.testCases[caseIdx];

      // 2a. Execute across all models in parallel
      const modelResults = await Promise.allSettled(
        models.map(async (model) => {
          const startMs = Date.now();

          const response = await client.messages.create({
            model,
            max_tokens: 2048,
            messages: [{ role: "user", content: buildPrompt(params.skillContent, testCase.input) }],
          });

          const latencyMs = Date.now() - startMs;
          const textBlock = response.content.find((b) => b.type === "text");
          const outputText = textBlock && textBlock.type === "text" ? textBlock.text : "";
          const inputTokens = response.usage.input_tokens;
          const outputTokens = response.usage.output_tokens;
          const totalTokens = inputTokens + outputTokens;
          const costMicrocents = estimateCostMicrocents(model, inputTokens, outputTokens);

          return {
            model,
            outputText,
            inputTokens,
            outputTokens,
            totalTokens,
            latencyMs,
            costMicrocents,
          };
        })
      );

      // 2b. Judge quality and insert results
      for (let i = 0; i < models.length; i++) {
        const model = models[i];
        const settled = modelResults[i];

        if (settled.status === "rejected") {
          // Individual model failure -- store error, don't fail the whole run
          const errorMsg =
            settled.reason instanceof Error ? settled.reason.message : String(settled.reason);

          await insertBenchmarkResult({
            tenantId: params.tenantId,
            benchmarkRunId: run.id,
            modelName: model,
            modelProvider: "anthropic",
            testCaseIndex: caseIdx,
            inputUsed: testCase.input,
            expectedOutput: testCase.expectedOutput,
            errorMessage: errorMsg,
          });
          resultCount++;
          continue;
        }

        const result = settled.value;

        // Judge quality (blinded -- judge doesn't know which model)
        let judge: JudgeOutput;
        try {
          judge = await judgeQuality(
            client,
            params.skillContent,
            result.outputText,
            testCase.expectedOutput,
            testCase.input
          );
        } catch {
          judge = {
            qualityScore: 0,
            qualityNotes: "Judge evaluation failed",
            matchesExpected: false,
            faithfulnessScore: 0,
            relevancyScore: 0,
            precisionScore: 0,
            recallScore: 0,
          };
        }

        await insertBenchmarkResult({
          tenantId: params.tenantId,
          benchmarkRunId: run.id,
          modelName: model,
          modelProvider: "anthropic",
          testCaseIndex: caseIdx,
          inputUsed: testCase.input,
          outputProduced: result.outputText,
          expectedOutput: testCase.expectedOutput,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          totalTokens: result.totalTokens,
          latencyMs: result.latencyMs,
          estimatedCostMicrocents: result.costMicrocents,
          qualityScore: judge.qualityScore,
          qualityNotes: judge.qualityNotes,
          matchesExpected: judge.matchesExpected,
          faithfulnessScore: judge.faithfulnessScore,
          relevancyScore: judge.relevancyScore,
          precisionScore: judge.precisionScore,
          recallScore: judge.recallScore,
        });

        // Track for summary
        modelStats[model].totalQuality += judge.qualityScore;
        modelStats[model].totalCost += result.costMicrocents ?? 0;
        modelStats[model].count++;

        resultCount++;
      }
    }

    // 3. Compute summary stats
    let bestModel: string | undefined;
    let bestQualityScore: number | undefined;
    let cheapestModel: string | undefined;
    let cheapestCost: number | undefined;

    for (const [model, stats] of Object.entries(modelStats)) {
      if (stats.count === 0) continue;

      const avgQuality = Math.round(stats.totalQuality / stats.count);
      const avgCost = Math.round(stats.totalCost / stats.count);

      if (bestQualityScore === undefined || avgQuality > bestQualityScore) {
        bestModel = model;
        bestQualityScore = avgQuality;
      }

      if (cheapestCost === undefined || avgCost < cheapestCost) {
        cheapestModel = model;
        cheapestCost = avgCost;
      }
    }

    // 4. Complete the run
    await completeBenchmarkRun(run.id, {
      status: "completed",
      bestModel,
      bestQualityScore,
      cheapestModel,
      cheapestCostMicrocents: cheapestCost,
    });

    return { runId: run.id, status: "completed", resultCount };
  } catch (error) {
    // Uncaught error -- fail the entire run
    const errorMsg = error instanceof Error ? error.message : String(error);

    await completeBenchmarkRun(run.id, { status: "failed" });

    return { runId: run.id, status: "failed", resultCount: 0, error: errorMsg };
  }
}
