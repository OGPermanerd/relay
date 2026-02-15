/**
 * Payload sanitization utility for detecting and stripping known secret patterns.
 *
 * Prevents API keys, passwords, tokens, and connection strings from accidentally
 * entering the skill_feedback and token_measurements tables via user-submitted content.
 *
 * Required by SCHEMA-06.
 */

export interface SanitizeResult {
  sanitized: string;
  secretsFound: string[];
}

interface SecretPattern {
  name: string;
  pattern: RegExp;
}

/**
 * Secret patterns ordered by specificity (most specific first).
 * Patterns require assignment context (key=value) or known prefixes
 * to avoid false positives on legitimate text.
 *
 * All patterns use the global flag for replacement.
 */
const SECRET_PATTERNS: SecretPattern[] = [
  // PEM private keys (multiline, must come early)
  {
    name: "pem_private_key",
    pattern:
      /-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----[\s\S]*?-----END\s+(?:RSA\s+)?PRIVATE\s+KEY-----/g,
  },

  // AWS access key (starts with AKIA, 20 chars total)
  {
    name: "aws_access_key",
    pattern: /AKIA[0-9A-Z]{16}/g,
  },

  // AWS secret key (assignment context required)
  {
    name: "aws_secret_key",
    pattern: /(?:aws_secret_access_key|secret_key)\s*[=:]\s*["']?[A-Za-z0-9/+=]{40}["']?/g,
  },

  // GitHub fine-grained PAT (github_pat_ prefix)
  {
    name: "github_token",
    pattern: /github_pat_[A-Za-z0-9_]{36,}/g,
  },

  // GitHub tokens (ghp_, gho_, ghu_, ghs_, ghr_ prefixes)
  {
    name: "github_token",
    pattern: /gh[pousr]_[A-Za-z0-9_]{36,}/g,
  },

  // Anthropic key (sk-ant- prefix, must come before OpenAI to avoid double-matching)
  {
    name: "anthropic_key",
    pattern: /sk-ant-[A-Za-z0-9_-]{20,}/g,
  },

  // OpenAI key (sk- prefix with sufficient length)
  {
    name: "openai_key",
    pattern: /sk-(?:proj-)?[A-Za-z0-9]{20,}/g,
  },

  // Bearer tokens
  {
    name: "bearer_token",
    pattern: /Bearer\s+[A-Za-z0-9._~+/=-]{20,}/g,
  },

  // Connection strings (postgres://, mysql://, mongodb://, redis://)
  {
    name: "connection_string",
    pattern: /(?:postgres|mysql|mongodb|redis):\/\/[^:\s]+:[^@\s]+@[^\s]+/g,
  },

  // Generic API key (assignment context required)
  {
    name: "generic_api_key",
    pattern:
      /(?:api[_-]?key|apikey|api[_-]?secret|auth[_-]?token|access[_-]?token)\s*[=:]\s*["']?[A-Za-z0-9_\-.]{16,}["']?/g,
  },

  // Password assignment (assignment context required, 8+ char value)
  {
    name: "password",
    pattern: /(?:password|passwd|pwd)\s*[=:]\s*["']?[^\s"']{8,}["']?/g,
  },

  // Long base64 strings (100+ alphanumeric chars with optional padding)
  {
    name: "long_base64",
    pattern: /[A-Za-z0-9+/]{100,}={0,2}/g,
  },
];

/**
 * Sanitize a string input by detecting and replacing known secret patterns
 * with "[REDACTED]".
 *
 * Returns the sanitized string and a deduplicated list of which secret
 * pattern types were found.
 */
export function sanitizePayload(input: string): SanitizeResult {
  if (!input) {
    return { sanitized: "", secretsFound: [] };
  }

  let sanitized = input;
  const secretsFoundSet = new Set<string>();

  for (const { name, pattern } of SECRET_PATTERNS) {
    // Reset lastIndex before testing (global regexes maintain state)
    pattern.lastIndex = 0;

    if (pattern.test(sanitized)) {
      secretsFoundSet.add(name);
      // Reset lastIndex again before replace (test() advances it)
      pattern.lastIndex = 0;
      sanitized = sanitized.replace(pattern, "[REDACTED]");
    }
  }

  return {
    sanitized,
    secretsFound: Array.from(secretsFoundSet),
  };
}

/**
 * Recursively sanitize all string values in a nested object or array.
 *
 * - Strings: run through sanitizePayload()
 * - Arrays: each element is recursively sanitized
 * - Objects: each value is recursively sanitized
 * - Primitives (number, boolean, null): pass through unchanged
 *
 * Returns the sanitized structure and a deduplicated list of all secret
 * pattern types found across all string values.
 */
export function sanitizeObject(
  obj: Record<string, unknown>
): SanitizeResult & { sanitized: Record<string, unknown> } {
  const secretsFoundSet = new Set<string>();

  function recurse(value: unknown): unknown {
    if (value === null || value === undefined) {
      return value;
    }

    if (typeof value === "string") {
      const result = sanitizePayload(value);
      for (const secret of result.secretsFound) {
        secretsFoundSet.add(secret);
      }
      return result.sanitized;
    }

    if (Array.isArray(value)) {
      return value.map((item) => recurse(item));
    }

    if (typeof value === "object") {
      const sanitized: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
        sanitized[key] = recurse(val);
      }
      return sanitized;
    }

    // Primitives (number, boolean) pass through
    return value;
  }

  const sanitized = recurse(obj) as Record<string, unknown>;

  return {
    sanitized,
    secretsFound: Array.from(secretsFoundSet),
  };
}
