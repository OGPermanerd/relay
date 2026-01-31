/**
 * Database seed script for populating test data
 *
 * Run with: pnpm --filter @relay/db db:seed
 */

import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq } from "drizzle-orm";
import { skills, type NewSkill } from "./schema/skills";
import { skillVersions, type NewSkillVersion } from "./schema/skill-versions";
import { ratings, type NewRating } from "./schema/ratings";
import { users, type NewUser } from "./schema/users";

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

// Test user for seeding (used as author and rater)
const testUser: NewUser = {
  id: "seed-user-001",
  email: "seed@relay.local",
  name: "Seed User",
};

// Test skills data per Plan 03-01 specification
const testSkills: NewSkill[] = [
  {
    id: "skill-code-review",
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
    authorId: testUser.id,
  },
  {
    id: "skill-api-docs",
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
    authorId: testUser.id,
  },
  {
    id: "skill-test-writer",
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
    authorId: testUser.id,
  },
];

// Skill versions for each skill (initial versions)
const testSkillVersions: NewSkillVersion[] = [
  {
    id: "version-code-review-v1",
    skillId: "skill-code-review",
    version: 1,
    contentUrl: "skills/skill-code-review/v1/content",
    contentHash: "sha256-placeholder-code-review-v1",
    contentType: "text/markdown",
    name: "Code Review Assistant",
    description:
      "AI-powered code review assistant that analyzes pull requests for bugs, security issues, and best practices.",
    createdBy: testUser.id,
    metadata: { format: "markdown", tags: ["code-review", "ai"] },
  },
  {
    id: "version-api-docs-v1",
    skillId: "skill-api-docs",
    version: 1,
    contentUrl: "skills/skill-api-docs/v1/content",
    contentHash: "sha256-placeholder-api-docs-v1",
    contentType: "text/markdown",
    name: "API Documentation Generator",
    description:
      "Generates comprehensive API documentation from code, including endpoints, parameters, and example requests.",
    createdBy: testUser.id,
    metadata: { format: "markdown", tags: ["documentation", "api"] },
  },
  {
    id: "version-test-writer-v1",
    skillId: "skill-test-writer",
    version: 1,
    contentUrl: "skills/skill-test-writer/v1/content",
    contentHash: "sha256-placeholder-test-writer-v1",
    contentType: "text/markdown",
    name: "Test Writer",
    description:
      "Generates unit and integration tests for your code with high coverage and edge case handling.",
    createdBy: testUser.id,
    metadata: { format: "markdown", tags: ["testing", "unit-tests"] },
  },
];

// Sample ratings (using explicit skill IDs matching testSkills)
const testRatings: NewRating[] = [
  {
    skillId: testSkills[0].id!,
    userId: testUser.id!,
    rating: 5,
    comment: "Excellent prompt, saved me hours on code reviews!",
    hoursSavedEstimate: 2,
  },
  {
    skillId: testSkills[1].id!,
    userId: testUser.id!,
    rating: 4,
    comment: "Great for generating initial docs, needs minor tweaks.",
    hoursSavedEstimate: 3,
  },
  {
    skillId: testSkills[2].id!,
    userId: testUser.id!,
    rating: 5,
    comment: "Perfect for generating test boilerplate.",
    hoursSavedEstimate: 2,
  },
];

async function seed() {
  console.log("Seeding database...");
  console.log("");

  try {
    // 1. Upsert test user
    console.log("Creating test user...");
    await db
      .insert(users)
      .values(testUser)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          name: testUser.name,
          updatedAt: new Date(),
        },
      });
    console.log(`  [+] ${testUser.name} (${testUser.email})`);

    // 2. Insert skills with upsert pattern
    console.log("");
    console.log("Creating skills...");
    for (const skill of testSkills) {
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
            authorId: skill.authorId,
            updatedAt: new Date(),
          },
        });
      console.log(`  [+] ${skill.name} (${skill.slug})`);
    }

    // 3. Insert skill versions
    console.log("");
    console.log("Creating skill versions...");
    for (const version of testSkillVersions) {
      await db.insert(skillVersions).values(version).onConflictDoNothing(); // Versions are immutable, skip if exists
      console.log(`  [+] ${version.name} v${version.version}`);
    }

    // 4. Update skills with publishedVersionId
    console.log("");
    console.log("Linking published versions...");
    for (const version of testSkillVersions) {
      await db
        .update(skills)
        .set({ publishedVersionId: version.id })
        .where(eq(skills.id, version.skillId));
      console.log(`  [+] ${version.skillId} -> ${version.id}`);
    }

    // 5. Insert ratings
    console.log("");
    console.log("Creating ratings...");
    for (const rating of testRatings) {
      // Check if rating already exists for this skill/user combo
      const existing = await db
        .select()
        .from(ratings)
        .where(eq(ratings.skillId, rating.skillId))
        .limit(1);

      if (existing.length === 0) {
        await db.insert(ratings).values(rating);
        console.log(`  [+] Rating for ${rating.skillId}: ${rating.rating}/5`);
      } else {
        console.log(`  [~] Rating for ${rating.skillId} already exists, skipping`);
      }
    }

    // 6. Update skill metrics based on ratings
    console.log("");
    console.log("Updating skill metrics...");
    for (const skill of testSkills) {
      // Set some sample totalUses
      const useCounts: Record<string, number> = {
        "skill-code-review": 42,
        "skill-api-docs": 28,
        "skill-test-writer": 35,
      };
      const useCount = useCounts[skill.id as string] || 0;

      await db
        .update(skills)
        .set({
          totalUses: useCount,
          averageRating: testRatings.find((r) => r.skillId === skill.id)?.rating
            ? testRatings.find((r) => r.skillId === skill.id)!.rating * 100
            : null,
        })
        .where(eq(skills.id, skill.id as string));
      console.log(`  [+] ${skill.name}: ${useCount} uses`);
    }

    console.log("");
    console.log("Seed complete:");
    console.log(`  - ${testSkills.length} skills`);
    console.log(`  - ${testSkillVersions.length} skill versions`);
    console.log(`  - ${testRatings.length} ratings`);
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
