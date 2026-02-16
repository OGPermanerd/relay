/**
 * Pure-function query classifier for adaptive query routing.
 *
 * Classifies search queries into route types based on lexical heuristics:
 * - keyword: short, specific term lookups (1-2 words)
 * - semantic: question-patterned queries requiring meaning understanding
 * - hybrid: natural language queries benefiting from both approaches
 * - browse: empty queries indicating a browsing intent
 *
 * Zero external dependencies. All rules are deterministic.
 */

export type RouteType = "keyword" | "semantic" | "hybrid" | "browse";

export interface ClassificationResult {
  routeType: RouteType;
  confidence: number;
  reason: string;
}

const QUESTION_WORDS = new Set([
  "how",
  "what",
  "why",
  "when",
  "where",
  "which",
  "can",
  "does",
  "is",
  "are",
  "should",
]);

const NL_MARKERS = new Set(["for", "to", "with", "in", "a", "the", "that", "and", "or", "of"]);

/**
 * Classify a search query into a route type.
 *
 * Rules (evaluated in order):
 * 1. Empty/whitespace => browse (1.0)
 * 2. 1 word => keyword (0.95)
 * 3. 2 words, no question word => keyword (0.85)
 * 4. Has question word or ends with "?" => semantic (0.8)
 * 5. 3+ words with NL markers => hybrid (0.8)
 * 6. 3 words or fewer, no NL markers => keyword (0.7)
 * 7. Default (4+ words, no NL markers) => hybrid (0.6)
 */
export function classifyQuery(query: string): ClassificationResult {
  const trimmed = query.trim();

  // Rule 1: Empty query => browse
  if (!trimmed) {
    return {
      routeType: "browse",
      confidence: 1.0,
      reason: "Empty query indicates browse intent",
    };
  }

  const words = trimmed.toLowerCase().split(/\s+/);
  const wordCount = words.length;
  const firstWord = words[0];
  const hasQuestionWord = QUESTION_WORDS.has(firstWord);
  const endsWithQuestion = trimmed.endsWith("?");
  const hasNLMarkers = words.some((w) => NL_MARKERS.has(w));

  // Rule 2: Single word => keyword
  if (wordCount === 1) {
    return {
      routeType: "keyword",
      confidence: 0.95,
      reason: "Single word query best served by keyword search",
    };
  }

  // Rule 3: Two words, no question word => keyword
  if (wordCount === 2 && !hasQuestionWord && !endsWithQuestion) {
    return {
      routeType: "keyword",
      confidence: 0.85,
      reason: "Two-word query without question pattern",
    };
  }

  // Rule 4: Question pattern => semantic
  if (hasQuestionWord || endsWithQuestion) {
    return {
      routeType: "semantic",
      confidence: 0.8,
      reason: "Question pattern detected — semantic understanding needed",
    };
  }

  // Rule 5: 3+ words with NL markers => hybrid
  if (wordCount >= 3 && hasNLMarkers) {
    return {
      routeType: "hybrid",
      confidence: 0.8,
      reason: "Natural language query with connective markers",
    };
  }

  // Rule 6: 3 words or fewer, no NL markers => keyword
  if (wordCount <= 3) {
    return {
      routeType: "keyword",
      confidence: 0.7,
      reason: "Short query without natural language markers",
    };
  }

  // Rule 7: Default (4+ words, no NL markers) => hybrid
  return {
    routeType: "hybrid",
    confidence: 0.6,
    reason: "Multi-word query defaults to hybrid search",
  };
}
