/**
 * Static Anthropic pricing table for token cost estimation.
 *
 * Prices are in microcents per token.
 * Formula: $/MTok / 10 = microcents/token
 *   e.g. $3/MTok input → 3 / 10 = 0.3 microcents/token
 *
 * Source: https://docs.anthropic.com/en/docs/about-claude/pricing
 * Last updated: 2026-02-15
 */

export interface ModelPricing {
  /** Cost per input token in microcents */
  input: number;
  /** Cost per output token in microcents */
  output: number;
}

export const ANTHROPIC_PRICING: Record<string, ModelPricing> = {
  // --- Current models ---

  // Claude Opus 4.6: $5/MTok input, $25/MTok output
  "claude-opus-4-6": { input: 0.5, output: 2.5 },

  // Claude Sonnet 4.5: $3/MTok input, $15/MTok output
  "claude-sonnet-4-5-20250929": { input: 0.3, output: 1.5 },
  "claude-sonnet-4-5": { input: 0.3, output: 1.5 },

  // Claude Haiku 4.5: $1/MTok input, $5/MTok output
  "claude-haiku-4-5-20251001": { input: 0.1, output: 0.5 },
  "claude-haiku-4-5": { input: 0.1, output: 0.5 },

  // --- Legacy models ---

  // Claude Opus 4.5: $15/MTok input, $75/MTok output
  "claude-opus-4-5-20251101": { input: 1.5, output: 7.5 },
  "claude-opus-4-5": { input: 1.5, output: 7.5 },

  // Claude Opus 4.1: $15/MTok input, $75/MTok output (same as 4.5)
  "claude-opus-4-1-20250805": { input: 1.5, output: 7.5 },
  "claude-opus-4-1": { input: 1.5, output: 7.5 },

  // Claude Sonnet 4: $3/MTok input, $15/MTok output
  "claude-sonnet-4-20250514": { input: 0.3, output: 1.5 },
  "claude-sonnet-4": { input: 0.3, output: 1.5 },

  // Claude 3.7 Sonnet: $3/MTok input, $15/MTok output
  "claude-3-7-sonnet-20250219": { input: 0.3, output: 1.5 },
  "claude-3-7-sonnet": { input: 0.3, output: 1.5 },

  // Claude Opus 4: $15/MTok input, $75/MTok output
  "claude-opus-4-20250514": { input: 1.5, output: 7.5 },
  "claude-opus-4": { input: 1.5, output: 7.5 },

  // Claude 3.5 Sonnet: $3/MTok input, $15/MTok output
  "claude-3-5-sonnet-20241022": { input: 0.3, output: 1.5 },
  "claude-3-5-sonnet": { input: 0.3, output: 1.5 },

  // Claude 3 Haiku: $0.25/MTok input, $1.25/MTok output
  "claude-3-haiku-20240307": { input: 0.025, output: 0.125 },
  "claude-3-haiku": { input: 0.025, output: 0.125 },
};

/**
 * Calculate estimated cost in microcents for a given model and token usage.
 * Returns null if the model is not in the pricing table.
 */
export function estimateCostMicrocents(
  modelName: string,
  inputTokens: number,
  outputTokens: number
): number | null {
  const pricing = ANTHROPIC_PRICING[modelName];
  if (!pricing) return null;

  return Math.round(inputTokens * pricing.input + outputTokens * pricing.output);
}
