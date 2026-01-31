/**
 * Database seed script for populating test data
 *
 * Run with: pnpm --filter @relay/db db:seed
 */

import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { skills, type NewSkill } from "./schema/skills";

// Verify DATABASE_URL is set
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("Error: DATABASE_URL environment variable is not set");
  console.error("");
  console.error("Please ensure your .env file contains:");
  console.error('  DATABASE_URL="postgres://postgres:postgres@localhost:5432/relay"');
  console.error("");
  console.error("Or start the database with: docker compose up -d");
  process.exit(1);
}

// Create database connection for seeding
const client = postgres(connectionString);
const db = drizzle(client);

// Test skills data per Plan 03-01 specification
const testSkills: NewSkill[] = [
  {
    name: "Code Review Assistant",
    slug: "code-review-assistant",
    description:
      "AI-powered code review assistant that analyzes pull requests for bugs, security issues, and best practices.",
    category: "prompt",
    hoursSaved: 2,
    content: `# Code Review Assistant

An AI-powered assistant for thorough code reviews.

## Usage

Provide your code diff or pull request, and this skill will:

1. Identify potential bugs and logic errors
2. Flag security vulnerabilities
3. Suggest performance improvements
4. Check adherence to best practices

## Example

\`\`\`
Review the following changes:
[paste your diff here]
\`\`\`

The assistant will provide detailed feedback on each issue found.
`,
  },
  {
    name: "API Documentation Generator",
    slug: "api-documentation-generator",
    description:
      "Generates comprehensive API documentation from code, including endpoints, parameters, and example requests.",
    category: "workflow",
    hoursSaved: 4,
    content: `# API Documentation Generator

Automatically generate comprehensive API documentation.

## Usage

Point this skill at your API routes or handlers, and it will generate:

1. Endpoint descriptions
2. Request/response schemas
3. Parameter documentation
4. Example requests with curl
5. Error response documentation

## Example

\`\`\`
Generate documentation for:
[paste your API route file here]
\`\`\`

The generator will create markdown documentation ready for your docs site.
`,
  },
  {
    name: "Test Writer",
    slug: "test-writer",
    description:
      "Generates unit and integration tests for your code with high coverage and edge case handling.",
    category: "prompt",
    hoursSaved: 3,
    content: `# Test Writer

AI assistant for generating comprehensive test suites.

## Usage

Provide your function or module, and this skill will generate:

1. Unit tests for all public methods
2. Edge case coverage
3. Mock setup for dependencies
4. Integration test scaffolding

## Example

\`\`\`
Write tests for this function:
[paste your code here]
\`\`\`

The test writer will generate tests using your project's testing framework.
`,
  },
];

async function seed() {
  console.log("Seeding database with test skills...");
  console.log("");

  try {
    for (const skill of testSkills) {
      // Upsert pattern: insert or update on slug conflict
      await db
        .insert(skills)
        .values(skill)
        .onConflictDoUpdate({
          target: skills.slug,
          set: {
            name: skill.name,
            description: skill.description,
            category: skill.category,
            content: skill.content,
            hoursSaved: skill.hoursSaved,
            updatedAt: new Date(),
          },
        });

      console.log(`  [+] ${skill.name} (${skill.slug})`);
    }

    console.log("");
    console.log(`Successfully seeded ${testSkills.length} skills`);
  } catch (error) {
    console.error("Failed to seed database:", error);
    process.exit(1);
  } finally {
    // Close the connection
    await client.end();
  }
}

// Run the seed function
seed();
