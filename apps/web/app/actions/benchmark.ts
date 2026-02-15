"use server";

import { auth } from "@/auth";
import { db, skills } from "@everyskill/db";
import { getTrainingExamples } from "@everyskill/db/services";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { isAdmin } from "@/lib/admin";
import { runBenchmark } from "@/lib/benchmark-runner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BenchmarkState = {
  error?: string;
  success?: boolean;
  runId?: string;
};

// ---------------------------------------------------------------------------
// Trigger Benchmark
// ---------------------------------------------------------------------------

export async function triggerBenchmark(
  prevState: BenchmarkState,
  formData: FormData
): Promise<BenchmarkState> {
  // Authentication
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "You must be signed in" };
  }

  const tenantId = session.user.tenantId;
  if (!tenantId) {
    return { error: "Tenant not resolved" };
  }

  // Extract skill ID
  const skillId = formData.get("skillId") as string;
  if (!skillId) {
    return { error: "Invalid request" };
  }

  // Extract optional ad-hoc inputs (JSON string of string[])
  const adHocInputsRaw = formData.get("adHocInputs") as string | null;

  if (!db) {
    return { error: "Database not configured" };
  }

  // Fetch skill and verify it exists
  const skill = await db.query.skills.findFirst({
    where: eq(skills.id, skillId),
    columns: {
      id: true,
      name: true,
      content: true,
      slug: true,
      authorId: true,
    },
  });

  if (!skill) {
    return { error: "Skill not found" };
  }

  // Authorization: admin OR author can trigger benchmarks
  if (!isAdmin(session) && skill.authorId !== session.user.id) {
    return { error: "Only the skill author or an admin can trigger benchmarks" };
  }

  // Gather test cases
  let testCases: { input: string; expectedOutput: string | null }[];

  const trainingExamples = await getTrainingExamples(skillId);

  if (trainingExamples.length > 0) {
    // Use training examples as test cases
    testCases = trainingExamples.map((ex) => ({
      input: ex.exampleInput,
      expectedOutput: ex.expectedOutput,
    }));
  } else if (adHocInputsRaw) {
    // Parse ad-hoc inputs
    try {
      const adHocInputs: string[] = JSON.parse(adHocInputsRaw);
      const filtered = adHocInputs.filter((s) => s.trim().length > 0);
      if (filtered.length === 0) {
        return { error: "No valid test inputs provided" };
      }
      testCases = filtered.map((input) => ({
        input: input.trim(),
        expectedOutput: null,
      }));
    } catch {
      return { error: "Invalid ad-hoc inputs format" };
    }
  } else {
    return {
      error: "No test cases available. Add training examples or provide ad-hoc test inputs.",
    };
  }

  // Limit to max 3 test cases
  testCases = testCases.slice(0, 3);

  try {
    const result = await runBenchmark({
      tenantId,
      skillId,
      triggeredBy: session.user.id,
      skillContent: skill.content,
      skillName: skill.name,
      testCases,
    });

    revalidatePath(`/skills/${skill.slug}`);
    return { success: true, runId: result.runId };
  } catch (error) {
    console.error("Benchmark trigger failed:", error);
    return {
      error: "Benchmark service temporarily unavailable. Please try again later.",
    };
  }
}
