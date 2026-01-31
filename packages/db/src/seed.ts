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
import { ratings } from "./schema/ratings";
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

    // 2. Insert skills with upsert pattern and collect actual IDs
    console.log("");
    console.log("Creating skills...");
    const insertedSkills: { id: string; slug: string; name: string; description: string }[] = [];
    for (const skill of testSkills) {
      // Use RETURNING to get the actual ID (whether inserted or existing)
      const [result] = await db
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
        })
        .returning({
          id: skills.id,
          slug: skills.slug,
          name: skills.name,
          description: skills.description,
        });
      insertedSkills.push(result);
      console.log(`  [+] ${skill.name} (${skill.slug}) -> ${result.id}`);
    }

    // 3. Insert skill versions using actual skill IDs from step 2
    console.log("");
    console.log("Creating skill versions...");
    const insertedVersions: { id: string; skillId: string }[] = [];
    for (const skill of insertedSkills) {
      const versionId = `version-${skill.slug}-v1`;
      const version: NewSkillVersion = {
        id: versionId,
        skillId: skill.id, // Use actual ID from database
        version: 1,
        contentUrl: `skills/${skill.id}/v1/content`,
        contentHash: `sha256-placeholder-${skill.slug}-v1`,
        contentType: "text/markdown",
        name: skill.name,
        description: skill.description,
        createdBy: testUser.id,
        metadata: { format: "markdown" },
      };
      await db.insert(skillVersions).values(version).onConflictDoNothing();
      insertedVersions.push({ id: versionId, skillId: skill.id });
      console.log(`  [+] ${skill.name} v1`);
    }

    // 4. Update skills with publishedVersionId
    console.log("");
    console.log("Linking published versions...");
    for (const version of insertedVersions) {
      await db
        .update(skills)
        .set({ publishedVersionId: version.id })
        .where(eq(skills.id, version.skillId));
      console.log(`  [+] ${version.skillId} -> ${version.id}`);
    }

    // 5. Insert ratings using actual skill IDs
    console.log("");
    console.log("Creating ratings...");
    const ratingValues = [5, 4, 5]; // Rating values for each skill
    const ratingComments = [
      "Excellent prompt, saved me hours on code reviews!",
      "Great for generating initial docs, needs minor tweaks.",
      "Perfect for generating test boilerplate.",
    ];
    const ratingHours = [2, 3, 2];

    for (let i = 0; i < insertedSkills.length; i++) {
      const skill = insertedSkills[i];
      // Check if rating already exists for this skill/user combo
      const existing = await db
        .select()
        .from(ratings)
        .where(eq(ratings.skillId, skill.id))
        .limit(1);

      if (existing.length === 0) {
        await db.insert(ratings).values({
          skillId: skill.id,
          userId: testUser.id!,
          rating: ratingValues[i],
          comment: ratingComments[i],
          hoursSavedEstimate: ratingHours[i],
        });
        console.log(`  [+] Rating for ${skill.name}: ${ratingValues[i]}/5`);
      } else {
        console.log(`  [~] Rating for ${skill.name} already exists, skipping`);
      }
    }

    // 6. Update skill metrics based on ratings
    console.log("");
    console.log("Updating skill metrics...");
    const useCounts = [42, 28, 35]; // Sample use counts
    for (let i = 0; i < insertedSkills.length; i++) {
      const skill = insertedSkills[i];
      await db
        .update(skills)
        .set({
          totalUses: useCounts[i],
          averageRating: ratingValues[i] * 100,
        })
        .where(eq(skills.id, skill.id));
      console.log(`  [+] ${skill.name}: ${useCounts[i]} uses`);
    }

    console.log("");
    console.log("Seed complete:");
    console.log(`  - ${insertedSkills.length} skills`);
    console.log(`  - ${insertedVersions.length} skill versions`);
    console.log(`  - ${insertedSkills.length} ratings`);
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
