import { describe, it, expect } from "vitest";
import { sanitizePayload, sanitizeObject, type SanitizeResult } from "../sanitize-payload";

describe("sanitizePayload", () => {
  describe("true positive cases - MUST detect and redact", () => {
    it("detects AWS access key (AKIA prefix)", () => {
      const input = "key=AKIAIOSFODNN7EXAMPLE";
      const result = sanitizePayload(input);

      expect(result.sanitized).not.toContain("AKIAIOSFODNN7EXAMPLE");
      expect(result.sanitized).toContain("[REDACTED]");
      expect(result.secretsFound).toContain("aws_access_key");
    });

    it("detects AWS secret access key", () => {
      const input = "aws_secret_access_key=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY";
      const result = sanitizePayload(input);

      expect(result.sanitized).not.toContain("wJalrXUtnFEMI");
      expect(result.sanitized).toContain("[REDACTED]");
      expect(result.secretsFound).toContain("aws_secret_key");
    });

    it("detects GitHub PAT classic (ghp_ prefix)", () => {
      const input = "token: ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij1234";
      const result = sanitizePayload(input);

      expect(result.sanitized).not.toContain("ghp_ABCDEF");
      expect(result.sanitized).toContain("[REDACTED]");
      expect(result.secretsFound).toContain("github_token");
    });

    it("detects GitHub fine-grained PAT (github_pat_ prefix)", () => {
      const input = "github_pat_11ABCDEF0abcdefghijklmnopqrstuvwxyz1234567890";
      const result = sanitizePayload(input);

      expect(result.sanitized).not.toContain("github_pat_11ABCDEF");
      expect(result.sanitized).toContain("[REDACTED]");
      expect(result.secretsFound).toContain("github_token");
    });

    it("detects GitHub tokens with gho_, ghu_, ghs_, ghr_ prefixes", () => {
      for (const prefix of ["gho_", "ghu_", "ghs_", "ghr_"]) {
        const token = `${prefix}${"A".repeat(36)}`;
        const result = sanitizePayload(`token=${token}`);

        expect(result.sanitized).not.toContain(token);
        expect(result.secretsFound).toContain("github_token");
      }
    });

    it("detects Anthropic API key (sk-ant- prefix)", () => {
      const input = "sk-ant-api03-abcdefghijklmnopqrstuvwxyz";
      const result = sanitizePayload(input);

      expect(result.sanitized).not.toContain("sk-ant-api03");
      expect(result.sanitized).toContain("[REDACTED]");
      expect(result.secretsFound).toContain("anthropic_key");
    });

    it("detects OpenAI API key (sk-proj- prefix)", () => {
      const input = "sk-proj-abcdefghijklmnopqrstuvwxyz1234";
      const result = sanitizePayload(input);

      expect(result.sanitized).not.toContain("sk-proj-abcdef");
      expect(result.sanitized).toContain("[REDACTED]");
      expect(result.secretsFound).toContain("openai_key");
    });

    it("detects Bearer token in Authorization header", () => {
      const input = "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.signature";
      const result = sanitizePayload(input);

      expect(result.sanitized).not.toContain("eyJhbGciOiJIUzI1NiI");
      expect(result.sanitized).toContain("[REDACTED]");
      expect(result.secretsFound).toContain("bearer_token");
    });

    it("detects generic API key assignment", () => {
      const input = "api_key=abcdef1234567890abcdef";
      const result = sanitizePayload(input);

      expect(result.sanitized).not.toContain("abcdef1234567890abcdef");
      expect(result.sanitized).toContain("[REDACTED]");
      expect(result.secretsFound).toContain("generic_api_key");
    });

    it("detects password assignment", () => {
      const input = "password=MyS3cur3P@ssw0rd!";
      const result = sanitizePayload(input);

      expect(result.sanitized).not.toContain("MyS3cur3P@ssw0rd!");
      expect(result.sanitized).toContain("[REDACTED]");
      expect(result.secretsFound).toContain("password");
    });

    it("detects PEM private key block", () => {
      const input =
        "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQ\n-----END PRIVATE KEY-----";
      const result = sanitizePayload(input);

      expect(result.sanitized).not.toContain("MIIEvQIBADANBgkqhkiG9w0BAQ");
      expect(result.sanitized).toContain("[REDACTED]");
      expect(result.secretsFound).toContain("pem_private_key");
    });

    it("detects RSA private key block", () => {
      const input =
        "-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA\n-----END RSA PRIVATE KEY-----";
      const result = sanitizePayload(input);

      expect(result.sanitized).not.toContain("MIIEpAIBAAKCAQEA");
      expect(result.sanitized).toContain("[REDACTED]");
      expect(result.secretsFound).toContain("pem_private_key");
    });

    it("detects PostgreSQL connection string", () => {
      const input = "postgres://admin:secret123@db.example.com:5432/mydb";
      const result = sanitizePayload(input);

      expect(result.sanitized).not.toContain("secret123");
      expect(result.sanitized).toContain("[REDACTED]");
      expect(result.secretsFound).toContain("connection_string");
    });

    it("detects MySQL connection string", () => {
      const input = "mysql://root:password@localhost:3306/mydb";
      const result = sanitizePayload(input);

      expect(result.sanitized).not.toContain("password@localhost");
      expect(result.sanitized).toContain("[REDACTED]");
      expect(result.secretsFound).toContain("connection_string");
    });

    it("detects MongoDB connection string", () => {
      const input = "mongodb://user:pass123@cluster.mongodb.net/dbname";
      const result = sanitizePayload(input);

      expect(result.sanitized).not.toContain("pass123");
      expect(result.sanitized).toContain("[REDACTED]");
      expect(result.secretsFound).toContain("connection_string");
    });

    it("detects Redis connection string", () => {
      const input = "redis://default:myredispass@redis.example.com:6379";
      const result = sanitizePayload(input);

      expect(result.sanitized).not.toContain("myredispass");
      expect(result.sanitized).toContain("[REDACTED]");
      expect(result.secretsFound).toContain("connection_string");
    });

    it("detects long base64 encoded secrets (100+ chars)", () => {
      const longBase64 = "A".repeat(120);
      const input = `encoded_secret=${longBase64}`;
      const result = sanitizePayload(input);

      expect(result.sanitized).not.toContain(longBase64);
      expect(result.sanitized).toContain("[REDACTED]");
      expect(result.secretsFound).toContain("long_base64");
    });
  });

  describe("true negative cases - MUST NOT strip", () => {
    it("preserves text about password policy", () => {
      const input = "The password policy requires 12 characters";
      const result = sanitizePayload(input);

      expect(result.sanitized).toBe(input);
      expect(result.secretsFound).toHaveLength(0);
    });

    it("preserves text mentioning strong password", () => {
      const input = "Use a strong password for your account";
      const result = sanitizePayload(input);

      expect(result.sanitized).toBe(input);
      expect(result.secretsFound).toHaveLength(0);
    });

    it("preserves text about tokens as concepts", () => {
      const input = "This token represents a unit of work";
      const result = sanitizePayload(input);

      expect(result.sanitized).toBe(input);
      expect(result.secretsFound).toHaveLength(0);
    });

    it("preserves text about API key management page", () => {
      const input = "The API key management page is at /settings";
      const result = sanitizePayload(input);

      expect(result.sanitized).toBe(input);
      expect(result.secretsFound).toHaveLength(0);
    });

    it("preserves text about GitHub using tokens", () => {
      const input = "GitHub uses personal access tokens for auth";
      const result = sanitizePayload(input);

      expect(result.sanitized).toBe(input);
      expect(result.secretsFound).toHaveLength(0);
    });

    it("preserves normal code", () => {
      const input = "const result = await fetchData();";
      const result = sanitizePayload(input);

      expect(result.sanitized).toBe(input);
      expect(result.secretsFound).toHaveLength(0);
    });

    it("preserves short strings that look like key prefixes", () => {
      const input = "sk-12";
      const result = sanitizePayload(input);

      expect(result.sanitized).toBe(input);
      expect(result.secretsFound).toHaveLength(0);
    });
  });

  describe("edge cases", () => {
    it("handles empty string", () => {
      const result = sanitizePayload("");

      expect(result.sanitized).toBe("");
      expect(result.secretsFound).toHaveLength(0);
    });

    it("detects multiple secret types in same string", () => {
      const input = "AWS key=AKIAIOSFODNN7EXAMPLE and password=SuperSecret123!";
      const result = sanitizePayload(input);

      expect(result.sanitized).not.toContain("AKIAIOSFODNN7EXAMPLE");
      expect(result.sanitized).not.toContain("SuperSecret123!");
      expect(result.secretsFound).toContain("aws_access_key");
      expect(result.secretsFound).toContain("password");
      expect(result.secretsFound.length).toBeGreaterThanOrEqual(2);
    });

    it("does not double-report the same pattern type", () => {
      const input = "password=first123! and also password=second456!";
      const result = sanitizePayload(input);

      const passwordCount = result.secretsFound.filter((s) => s === "password").length;
      expect(passwordCount).toBe(1);
    });

    it("preserves surrounding text while redacting secrets", () => {
      const input = "Config: api_key=abcdef1234567890abcdef -- end of config";
      const result = sanitizePayload(input);

      expect(result.sanitized).toContain("Config:");
      expect(result.sanitized).toContain("[REDACTED]");
      expect(result.sanitized).toContain("-- end of config");
    });
  });

  describe("SanitizeResult type", () => {
    it("returns correct shape", () => {
      const result: SanitizeResult = sanitizePayload("test input");

      expect(result).toHaveProperty("sanitized");
      expect(result).toHaveProperty("secretsFound");
      expect(typeof result.sanitized).toBe("string");
      expect(Array.isArray(result.secretsFound)).toBe(true);
    });
  });
});

describe("sanitizeObject", () => {
  it("sanitizes string values in a flat object", () => {
    const obj = {
      name: "test",
      secret: "password=MyS3cur3P@ss!",
    };
    const result = sanitizeObject(obj);

    expect(result.sanitized).toHaveProperty("name", "test");
    expect((result.sanitized as Record<string, unknown>).secret).toContain("[REDACTED]");
    expect(result.secretsFound.length).toBeGreaterThan(0);
  });

  it("recursively sanitizes nested objects", () => {
    const obj = {
      config: {
        db: "postgres://user:pass@host/db",
      },
    };
    const result = sanitizeObject(obj);

    const sanitized = result.sanitized as Record<string, Record<string, unknown>>;
    expect(sanitized.config.db).toContain("[REDACTED]");
    expect(result.secretsFound).toContain("connection_string");
  });

  it("sanitizes string values inside arrays", () => {
    const obj = {
      keys: ["AKIAIOSFODNN7EXAMPLE", "safe-value"],
    };
    const result = sanitizeObject(obj);

    const sanitized = result.sanitized as Record<string, unknown[]>;
    expect(sanitized.keys[0]).toContain("[REDACTED]");
    expect(sanitized.keys[1]).toBe("safe-value");
  });

  it("passes through non-string values unchanged", () => {
    const obj = {
      count: 42,
      active: true,
      empty: null,
      name: "safe text",
    };
    const result = sanitizeObject(obj);

    const sanitized = result.sanitized as Record<string, unknown>;
    expect(sanitized.count).toBe(42);
    expect(sanitized.active).toBe(true);
    expect(sanitized.empty).toBeNull();
    expect(sanitized.name).toBe("safe text");
    expect(result.secretsFound).toHaveLength(0);
  });

  it("returns deduplicated secretsFound list", () => {
    const obj = {
      key1: "password=secret1!",
      key2: "password=secret2!",
    };
    const result = sanitizeObject(obj);

    const passwordCount = result.secretsFound.filter((s) => s === "password").length;
    expect(passwordCount).toBe(1);
  });

  it("handles deeply nested structures", () => {
    const obj = {
      level1: {
        level2: {
          level3: {
            secret: "sk-ant-api03-reallylong_secret_key_here",
          },
        },
      },
    };
    const result = sanitizeObject(obj);

    const sanitized = result.sanitized as Record<string, unknown>;
    const level1 = sanitized.level1 as Record<string, unknown>;
    const level2 = level1.level2 as Record<string, unknown>;
    const level3 = level2.level3 as Record<string, unknown>;
    expect(level3.secret).toContain("[REDACTED]");
    expect(result.secretsFound).toContain("anthropic_key");
  });

  it("handles mixed arrays with objects and primitives", () => {
    const obj = {
      items: [{ url: "postgres://admin:pass@db/mydb" }, "normal string", 42, null],
    };
    const result = sanitizeObject(obj);

    const sanitized = result.sanitized as Record<string, unknown[]>;
    const first = sanitized.items[0] as Record<string, unknown>;
    expect(first.url).toContain("[REDACTED]");
    expect(sanitized.items[1]).toBe("normal string");
    expect(sanitized.items[2]).toBe(42);
    expect(sanitized.items[3]).toBeNull();
  });
});
