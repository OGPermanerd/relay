/**
 * Database seed script for populating test data
 *
 * Run with: pnpm --filter @everyskill/db db:seed
 *
 * Creates:
 * - 20 users
 * - 45 skills
 * - Ratings and usage events
 */

import { config } from "dotenv";
config({ path: "../../.env.local" });
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq } from "drizzle-orm";
import { skills, type NewSkill } from "./schema/skills";
import { skillVersions, type NewSkillVersion } from "./schema/skill-versions";
import { ratings } from "./schema/ratings";
import { usageEvents } from "./schema/usage-events";
import { users, type NewUser } from "./schema/users";
import { tenants } from "./schema/tenants";

// Default tenant for seed data
const DEFAULT_TENANT_ID = "tenant-seed-001";

// Verify DATABASE_URL is set
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("Error: DATABASE_URL environment variable is not set");
  process.exit(1);
}

// Create database connection for seeding
const client = postgres(connectionString);
const db = drizzle(client);

// 20 test users with realistic names
const testUsers: NewUser[] = [
  {
    id: "user-001",
    tenantId: DEFAULT_TENANT_ID,
    email: "sarah.chen@company.com",
    name: "Sarah Chen",
  },
  {
    id: "user-002",
    tenantId: DEFAULT_TENANT_ID,
    email: "marcus.johnson@company.com",
    name: "Marcus Johnson",
  },
  {
    id: "user-003",
    tenantId: DEFAULT_TENANT_ID,
    email: "emily.rodriguez@company.com",
    name: "Emily Rodriguez",
  },
  {
    id: "user-004",
    tenantId: DEFAULT_TENANT_ID,
    email: "david.kim@company.com",
    name: "David Kim",
  },
  {
    id: "user-005",
    tenantId: DEFAULT_TENANT_ID,
    email: "jessica.patel@company.com",
    name: "Jessica Patel",
  },
  {
    id: "user-006",
    tenantId: DEFAULT_TENANT_ID,
    email: "michael.oconnor@company.com",
    name: "Michael O'Connor",
  },
  {
    id: "user-007",
    tenantId: DEFAULT_TENANT_ID,
    email: "amanda.wright@company.com",
    name: "Amanda Wright",
  },
  {
    id: "user-008",
    tenantId: DEFAULT_TENANT_ID,
    email: "james.thompson@company.com",
    name: "James Thompson",
  },
  {
    id: "user-009",
    tenantId: DEFAULT_TENANT_ID,
    email: "olivia.martinez@company.com",
    name: "Olivia Martinez",
  },
  {
    id: "user-010",
    tenantId: DEFAULT_TENANT_ID,
    email: "william.garcia@company.com",
    name: "William Garcia",
  },
  {
    id: "user-011",
    tenantId: DEFAULT_TENANT_ID,
    email: "sophia.lee@company.com",
    name: "Sophia Lee",
  },
  {
    id: "user-012",
    tenantId: DEFAULT_TENANT_ID,
    email: "benjamin.clark@company.com",
    name: "Benjamin Clark",
  },
  {
    id: "user-013",
    tenantId: DEFAULT_TENANT_ID,
    email: "isabella.lewis@company.com",
    name: "Isabella Lewis",
  },
  {
    id: "user-014",
    tenantId: DEFAULT_TENANT_ID,
    email: "alexander.hall@company.com",
    name: "Alexander Hall",
  },
  {
    id: "user-015",
    tenantId: DEFAULT_TENANT_ID,
    email: "mia.young@company.com",
    name: "Mia Young",
  },
  {
    id: "user-016",
    tenantId: DEFAULT_TENANT_ID,
    email: "ethan.allen@company.com",
    name: "Ethan Allen",
  },
  {
    id: "user-017",
    tenantId: DEFAULT_TENANT_ID,
    email: "charlotte.king@company.com",
    name: "Charlotte King",
  },
  {
    id: "user-018",
    tenantId: DEFAULT_TENANT_ID,
    email: "daniel.scott@company.com",
    name: "Daniel Scott",
  },
  {
    id: "user-019",
    tenantId: DEFAULT_TENANT_ID,
    email: "ava.green@company.com",
    name: "Ava Green",
  },
  {
    id: "user-020",
    tenantId: DEFAULT_TENANT_ID,
    email: "noah.baker@company.com",
    name: "Noah Baker",
  },
];

// 45 skills across different categories
const testSkills: Omit<NewSkill, "authorId">[] = [
  // Development Tools (15)
  {
    id: "skill-001",
    tenantId: DEFAULT_TENANT_ID,
    name: "Code Review Assistant",
    slug: "code-review-assistant",
    description:
      "AI-powered code review that analyzes pull requests for bugs, security issues, and best practices.",
    category: "prompt",
    tags: ["code-review", "best-practices", "security"],
    hoursSaved: 2,
    content:
      "# Code Review Assistant\n\nAnalyze code for bugs, security issues, and best practices.",
  },
  {
    id: "skill-002",
    tenantId: DEFAULT_TENANT_ID,
    name: "API Documentation Generator",
    slug: "api-documentation-generator",
    description:
      "Generates comprehensive API documentation from code, including endpoints, parameters, and examples.",
    category: "workflow",
    tags: ["documentation", "api", "automation"],
    hoursSaved: 4,
    content: "# API Documentation Generator\n\nAutomatically generate API docs from your code.",
  },
  {
    id: "skill-003",
    tenantId: DEFAULT_TENANT_ID,
    name: "Test Writer",
    slug: "test-writer",
    description:
      "Generates unit and integration tests for your code with high coverage and edge case handling.",
    category: "prompt",
    tags: ["testing", "automation", "tdd"],
    hoursSaved: 3,
    content: "# Test Writer\n\nGenerate comprehensive test suites for your code.",
  },
  {
    id: "skill-004",
    tenantId: DEFAULT_TENANT_ID,
    name: "Git Commit Composer",
    slug: "git-commit-composer",
    description: "Creates semantic, well-structured commit messages from your staged changes.",
    category: "prompt",
    tags: ["git", "workflow", "automation"],
    hoursSaved: 1,
    content: "# Git Commit Composer\n\nWrite perfect commit messages every time.",
  },
  {
    id: "skill-005",
    tenantId: DEFAULT_TENANT_ID,
    name: "Refactoring Guide",
    slug: "refactoring-guide",
    description: "Suggests refactoring opportunities and provides step-by-step migration guides.",
    category: "prompt",
    tags: ["refactoring", "clean-code", "architecture"],
    hoursSaved: 3,
    content: "# Refactoring Guide\n\nIdentify and execute refactoring opportunities.",
  },
  {
    id: "skill-006",
    tenantId: DEFAULT_TENANT_ID,
    name: "Debug Detective",
    slug: "debug-detective",
    description: "Analyzes error logs and stack traces to identify root causes and suggest fixes.",
    category: "agent",
    tags: ["debugging", "troubleshooting", "errors"],
    hoursSaved: 2,
    content: "# Debug Detective\n\nFind and fix bugs faster with AI analysis.",
  },
  {
    id: "skill-007",
    tenantId: DEFAULT_TENANT_ID,
    name: "Performance Profiler",
    slug: "performance-profiler",
    description: "Identifies performance bottlenecks and suggests optimizations for your code.",
    category: "prompt",
    tags: ["performance", "optimization", "profiling"],
    hoursSaved: 4,
    content: "# Performance Profiler\n\nOptimize your code for speed and efficiency.",
  },
  {
    id: "skill-008",
    tenantId: DEFAULT_TENANT_ID,
    name: "Database Schema Designer",
    slug: "database-schema-designer",
    description: "Designs normalized database schemas from requirements with migration scripts.",
    category: "workflow",
    tags: ["database", "schema", "sql"],
    hoursSaved: 5,
    content: "# Database Schema Designer\n\nDesign optimal database schemas.",
  },
  {
    id: "skill-009",
    tenantId: DEFAULT_TENANT_ID,
    name: "API Client Generator",
    slug: "api-client-generator",
    description: "Generates typed API clients from OpenAPI specs or API responses.",
    category: "workflow",
    tags: ["api", "typescript", "codegen"],
    hoursSaved: 3,
    content: "# API Client Generator\n\nGenerate type-safe API clients automatically.",
  },
  {
    id: "skill-010",
    tenantId: DEFAULT_TENANT_ID,
    name: "Regex Builder",
    slug: "regex-builder",
    description: "Creates and explains regular expressions from natural language descriptions.",
    category: "prompt",
    tags: ["regex", "text-processing", "validation"],
    hoursSaved: 1,
    content: "# Regex Builder\n\nBuild complex regex patterns with ease.",
  },
  {
    id: "skill-011",
    tenantId: DEFAULT_TENANT_ID,
    name: "Docker Composer",
    slug: "docker-composer",
    description: "Creates optimized Dockerfiles and docker-compose configurations.",
    category: "workflow",
    tags: ["docker", "containers", "devops"],
    hoursSaved: 2,
    content: "# Docker Composer\n\nContainerize your applications efficiently.",
  },
  {
    id: "skill-012",
    tenantId: DEFAULT_TENANT_ID,
    name: "CI/CD Pipeline Builder",
    slug: "cicd-pipeline-builder",
    description: "Generates GitHub Actions, GitLab CI, or Jenkins pipelines from requirements.",
    category: "workflow",
    tags: ["ci-cd", "automation", "devops"],
    hoursSaved: 4,
    content: "# CI/CD Pipeline Builder\n\nAutomate your deployment workflows.",
  },
  {
    id: "skill-013",
    tenantId: DEFAULT_TENANT_ID,
    name: "Security Auditor",
    slug: "security-auditor",
    description: "Scans code for security vulnerabilities and suggests remediations.",
    category: "agent",
    tags: ["security", "vulnerabilities", "audit"],
    hoursSaved: 5,
    content: "# Security Auditor\n\nFind and fix security issues in your code.",
  },
  {
    id: "skill-014",
    tenantId: DEFAULT_TENANT_ID,
    name: "Dependency Updater",
    slug: "dependency-updater",
    description: "Analyzes dependencies for updates and breaking changes with upgrade guides.",
    category: "workflow",
    tags: ["dependencies", "maintenance", "npm"],
    hoursSaved: 2,
    content: "# Dependency Updater\n\nKeep your dependencies up to date safely.",
  },
  {
    id: "skill-015",
    tenantId: DEFAULT_TENANT_ID,
    name: "Code Translator",
    slug: "code-translator",
    description: "Translates code between programming languages while maintaining logic.",
    category: "prompt",
    tags: ["translation", "migration", "languages"],
    hoursSaved: 6,
    content: "# Code Translator\n\nConvert code between languages accurately.",
  },

  // Content & Writing (10)
  {
    id: "skill-016",
    tenantId: DEFAULT_TENANT_ID,
    name: "Technical Writer",
    slug: "technical-writer",
    description: "Creates clear technical documentation, READMEs, and user guides.",
    category: "prompt",
    tags: ["documentation", "technical-writing", "readme"],
    hoursSaved: 3,
    content: "# Technical Writer\n\nCreate professional technical documentation.",
  },
  {
    id: "skill-017",
    tenantId: DEFAULT_TENANT_ID,
    name: "Blog Post Generator",
    slug: "blog-post-generator",
    description: "Generates engaging blog posts from topics or outlines with SEO optimization.",
    category: "prompt",
    tags: ["content", "blog", "seo"],
    hoursSaved: 2,
    content: "# Blog Post Generator\n\nWrite compelling blog content quickly.",
  },
  {
    id: "skill-018",
    tenantId: DEFAULT_TENANT_ID,
    name: "Email Composer",
    slug: "email-composer",
    description: "Drafts professional emails for various contexts with appropriate tone.",
    category: "prompt",
    tags: ["email", "communication", "professional"],
    hoursSaved: 1,
    content: "# Email Composer\n\nCraft perfect professional emails.",
  },
  {
    id: "skill-019",
    tenantId: DEFAULT_TENANT_ID,
    name: "Meeting Notes Summarizer",
    slug: "meeting-notes-summarizer",
    description: "Transforms meeting transcripts into structured notes with action items.",
    category: "prompt",
    tags: ["meetings", "notes", "productivity"],
    hoursSaved: 1,
    content: "# Meeting Notes Summarizer\n\nTurn meetings into actionable summaries.",
  },
  {
    id: "skill-020",
    tenantId: DEFAULT_TENANT_ID,
    name: "Proposal Writer",
    slug: "proposal-writer",
    description: "Creates compelling project proposals and business cases.",
    category: "workflow",
    tags: ["proposals", "business", "writing"],
    hoursSaved: 4,
    content: "# Proposal Writer\n\nCraft winning proposals.",
  },
  {
    id: "skill-021",
    tenantId: DEFAULT_TENANT_ID,
    name: "Release Notes Generator",
    slug: "release-notes-generator",
    description: "Generates user-friendly release notes from commit history and PRs.",
    category: "workflow",
    tags: ["release-notes", "changelog", "communication"],
    hoursSaved: 1,
    content: "# Release Notes Generator\n\nCreate clear release announcements.",
  },
  {
    id: "skill-022",
    tenantId: DEFAULT_TENANT_ID,
    name: "FAQ Builder",
    slug: "faq-builder",
    description: "Creates comprehensive FAQs from product documentation and support tickets.",
    category: "prompt",
    tags: ["faq", "support", "documentation"],
    hoursSaved: 2,
    content: "# FAQ Builder\n\nBuild helpful FAQ sections.",
  },
  {
    id: "skill-023",
    tenantId: DEFAULT_TENANT_ID,
    name: "Changelog Formatter",
    slug: "changelog-formatter",
    description: "Formats and organizes changelogs following Keep a Changelog conventions.",
    category: "prompt",
    tags: ["changelog", "documentation", "versioning"],
    hoursSaved: 1,
    content: "# Changelog Formatter\n\nMaintain clean changelogs.",
  },
  {
    id: "skill-024",
    tenantId: DEFAULT_TENANT_ID,
    name: "Tutorial Creator",
    slug: "tutorial-creator",
    description: "Develops step-by-step tutorials with code examples and screenshots.",
    category: "workflow",
    tags: ["tutorials", "education", "documentation"],
    hoursSaved: 4,
    content: "# Tutorial Creator\n\nCreate engaging tutorials.",
  },
  {
    id: "skill-025",
    tenantId: DEFAULT_TENANT_ID,
    name: "Slide Deck Outliner",
    slug: "slide-deck-outliner",
    description: "Creates presentation outlines with speaker notes and visual suggestions.",
    category: "prompt",
    tags: ["presentations", "slides", "communication"],
    hoursSaved: 2,
    content: "# Slide Deck Outliner\n\nPlan impactful presentations.",
  },

  // Data & Analytics (8)
  {
    id: "skill-026",
    tenantId: DEFAULT_TENANT_ID,
    name: "SQL Query Builder",
    slug: "sql-query-builder",
    description: "Generates complex SQL queries from natural language descriptions.",
    category: "prompt",
    tags: ["sql", "database", "queries"],
    hoursSaved: 1,
    content: "# SQL Query Builder\n\nWrite SQL from plain English.",
  },
  {
    id: "skill-027",
    tenantId: DEFAULT_TENANT_ID,
    name: "Data Analyzer",
    slug: "data-analyzer",
    description: "Analyzes datasets and provides insights with visualization suggestions.",
    category: "agent",
    tags: ["data-analysis", "insights", "visualization"],
    hoursSaved: 3,
    content: "# Data Analyzer\n\nExtract insights from your data.",
  },
  {
    id: "skill-028",
    tenantId: DEFAULT_TENANT_ID,
    name: "CSV Transformer",
    slug: "csv-transformer",
    description: "Transforms and cleans CSV data with complex mapping rules.",
    category: "workflow",
    tags: ["csv", "data", "etl"],
    hoursSaved: 2,
    content: "# CSV Transformer\n\nClean and transform data files.",
  },
  {
    id: "skill-029",
    tenantId: DEFAULT_TENANT_ID,
    name: "Report Generator",
    slug: "report-generator",
    description: "Creates formatted reports from raw data with charts and summaries.",
    category: "workflow",
    tags: ["reports", "analytics", "visualization"],
    hoursSaved: 3,
    content: "# Report Generator\n\nGenerate professional reports.",
  },
  {
    id: "skill-030",
    tenantId: DEFAULT_TENANT_ID,
    name: "Metrics Dashboard Designer",
    slug: "metrics-dashboard-designer",
    description: "Designs metrics dashboards with KPI selection and layout recommendations.",
    category: "prompt",
    tags: ["dashboards", "metrics", "kpis"],
    hoursSaved: 4,
    content: "# Metrics Dashboard Designer\n\nDesign effective dashboards.",
  },
  {
    id: "skill-031",
    tenantId: DEFAULT_TENANT_ID,
    name: "A/B Test Analyzer",
    slug: "ab-test-analyzer",
    description: "Analyzes A/B test results and provides statistical significance assessments.",
    category: "prompt",
    tags: ["ab-testing", "statistics", "experiments"],
    hoursSaved: 2,
    content: "# A/B Test Analyzer\n\nMake data-driven decisions.",
  },
  {
    id: "skill-032",
    tenantId: DEFAULT_TENANT_ID,
    name: "Log Parser",
    slug: "log-parser",
    description: "Parses and analyzes log files to extract patterns and anomalies.",
    category: "agent",
    tags: ["logs", "parsing", "monitoring"],
    hoursSaved: 2,
    content: "# Log Parser\n\nMake sense of your logs.",
  },
  {
    id: "skill-033",
    tenantId: DEFAULT_TENANT_ID,
    name: "Data Model Documenter",
    slug: "data-model-documenter",
    description: "Documents data models with entity relationships and field descriptions.",
    category: "workflow",
    tags: ["data-modeling", "documentation", "schema"],
    hoursSaved: 3,
    content: "# Data Model Documenter\n\nDocument your data structures.",
  },

  // Design & UX (6)
  {
    id: "skill-034",
    tenantId: DEFAULT_TENANT_ID,
    name: "Component Spec Writer",
    slug: "component-spec-writer",
    description: "Creates detailed component specifications with props, states, and behaviors.",
    category: "prompt",
    tags: ["components", "specs", "design-system"],
    hoursSaved: 2,
    content: "# Component Spec Writer\n\nDefine components precisely.",
  },
  {
    id: "skill-035",
    tenantId: DEFAULT_TENANT_ID,
    name: "Accessibility Checker",
    slug: "accessibility-checker",
    description: "Reviews UI code for accessibility issues and WCAG compliance.",
    category: "agent",
    tags: ["accessibility", "a11y", "wcag"],
    hoursSaved: 2,
    content: "# Accessibility Checker\n\nEnsure inclusive designs.",
  },
  {
    id: "skill-036",
    tenantId: DEFAULT_TENANT_ID,
    name: "Color Palette Generator",
    slug: "color-palette-generator",
    description: "Generates harmonious color palettes with accessibility considerations.",
    category: "prompt",
    tags: ["colors", "design", "accessibility"],
    hoursSaved: 1,
    content: "# Color Palette Generator\n\nCreate beautiful color schemes.",
  },
  {
    id: "skill-037",
    tenantId: DEFAULT_TENANT_ID,
    name: "Responsive Design Helper",
    slug: "responsive-design-helper",
    description: "Suggests responsive breakpoints and CSS strategies for layouts.",
    category: "prompt",
    tags: ["responsive", "css", "mobile"],
    hoursSaved: 1,
    content: "# Responsive Design Helper\n\nBuild layouts that work everywhere.",
  },
  {
    id: "skill-038",
    tenantId: DEFAULT_TENANT_ID,
    name: "Animation Scripter",
    slug: "animation-scripter",
    description: "Creates smooth CSS and JavaScript animations from descriptions.",
    category: "prompt",
    tags: ["animations", "css", "ux"],
    hoursSaved: 2,
    content: "# Animation Scripter\n\nBring your UI to life.",
  },
  {
    id: "skill-039",
    tenantId: DEFAULT_TENANT_ID,
    name: "Design Token Generator",
    slug: "design-token-generator",
    description: "Generates design tokens from Figma or design specs for code.",
    category: "workflow",
    tags: ["design-tokens", "design-system", "figma"],
    hoursSaved: 3,
    content: "# Design Token Generator\n\nBridge design and development.",
  },

  // Project Management (6)
  {
    id: "skill-040",
    tenantId: DEFAULT_TENANT_ID,
    name: "User Story Writer",
    slug: "user-story-writer",
    description: "Creates well-structured user stories with acceptance criteria.",
    category: "prompt",
    tags: ["user-stories", "agile", "requirements"],
    hoursSaved: 1,
    content: "# User Story Writer\n\nWrite clear user stories.",
  },
  {
    id: "skill-041",
    tenantId: DEFAULT_TENANT_ID,
    name: "Sprint Planner",
    slug: "sprint-planner",
    description: "Helps plan sprints by estimating effort and identifying dependencies.",
    category: "workflow",
    tags: ["sprints", "agile", "planning"],
    hoursSaved: 2,
    content: "# Sprint Planner\n\nPlan effective sprints.",
  },
  {
    id: "skill-042",
    tenantId: DEFAULT_TENANT_ID,
    name: "Retrospective Facilitator",
    slug: "retrospective-facilitator",
    description: "Generates retrospective templates and synthesizes feedback into actions.",
    category: "prompt",
    tags: ["retrospectives", "agile", "feedback"],
    hoursSaved: 1,
    content: "# Retrospective Facilitator\n\nRun productive retros.",
  },
  {
    id: "skill-043",
    tenantId: DEFAULT_TENANT_ID,
    name: "Risk Assessor",
    slug: "risk-assessor",
    description: "Identifies project risks and suggests mitigation strategies.",
    category: "prompt",
    tags: ["risk", "planning", "management"],
    hoursSaved: 2,
    content: "# Risk Assessor\n\nAnticipate and mitigate risks.",
  },
  {
    id: "skill-044",
    tenantId: DEFAULT_TENANT_ID,
    name: "Stakeholder Update Writer",
    slug: "stakeholder-update-writer",
    description: "Creates clear project updates for different stakeholder audiences.",
    category: "prompt",
    tags: ["communication", "stakeholders", "updates"],
    hoursSaved: 1,
    content: "# Stakeholder Update Writer\n\nKeep everyone informed.",
  },
  {
    id: "skill-045",
    tenantId: DEFAULT_TENANT_ID,
    name: "Estimation Helper",
    slug: "estimation-helper",
    description: "Breaks down tasks and provides effort estimates with confidence levels.",
    category: "agent",
    tags: ["estimation", "planning", "agile"],
    hoursSaved: 1,
    content: "# Estimation Helper\n\nEstimate with confidence.",
  },
];

// Assign skills to users (distribute among top contributors)
function assignSkillsToUsers(): NewSkill[] {
  const skillDistribution = [
    6,
    5,
    4,
    4,
    4, // First 5 users: power contributors
    3,
    3,
    3,
    3,
    2, // Next 5: active contributors
    2,
    2,
    2,
    1,
    1, // Next 5: occasional contributors
    1,
    1,
    1,
    1,
    1, // Last 5: single contribution each
  ];

  let skillIndex = 0;
  const assignedSkills: NewSkill[] = [];

  for (let userIdx = 0; userIdx < testUsers.length; userIdx++) {
    const numSkills = skillDistribution[userIdx];
    for (let i = 0; i < numSkills && skillIndex < testSkills.length; i++) {
      assignedSkills.push({
        ...testSkills[skillIndex],
        authorId: testUsers[userIdx].id,
      });
      skillIndex++;
    }
  }

  return assignedSkills;
}

async function seed() {
  console.log("Seeding database with expanded test data...\n");

  try {
    // 1. Clear existing data (in correct order for foreign keys)
    console.log("Clearing existing data...");
    await db.delete(usageEvents);
    await db.delete(ratings);
    await db.delete(skillVersions);
    await db.delete(skills);
    await db.delete(users);
    await db.delete(tenants);
    console.log("  [+] Cleared all existing data\n");

    // 1.5 Create seed tenant
    console.log("Creating seed tenant...");
    await db.insert(tenants).values({
      id: DEFAULT_TENANT_ID,
      name: "Seed Company",
      slug: "seed-company",
      domain: "company.com",
    });
    console.log("  [+] Seed Company tenant created\n");

    // 2. Insert users
    console.log("Creating 20 users...");
    for (const user of testUsers) {
      await db.insert(users).values(user);
      console.log(`  [+] ${user.name}`);
    }

    // 3. Insert skills
    console.log("\nCreating 45 skills...");
    const assignedSkills = assignSkillsToUsers();
    const insertedSkills: { id: string; slug: string; name: string; authorId: string | null }[] =
      [];

    for (const skill of assignedSkills) {
      const [result] = await db.insert(skills).values(skill).returning({
        id: skills.id,
        slug: skills.slug,
        name: skills.name,
        authorId: skills.authorId,
      });
      insertedSkills.push(result);
      const author = testUsers.find((u) => u.id === skill.authorId);
      console.log(`  [+] ${skill.name} (by ${author?.name})`);
    }

    // 4. Create skill versions and set publishedVersionId
    console.log("\nCreating skill versions...");
    for (const skill of insertedSkills) {
      const versionId = `version-${skill.slug}-v1`;
      const version: NewSkillVersion = {
        id: versionId,
        tenantId: DEFAULT_TENANT_ID,
        skillId: skill.id,
        version: 1,
        contentUrl: `skills/${skill.id}/v1/content`,
        contentHash: `sha256-${skill.slug}-v1`,
        contentType: "text/markdown",
        name: skill.name,
        description: "Initial version",
        createdBy: skill.authorId,
        metadata: { format: "markdown" },
      };
      await db.insert(skillVersions).values(version);

      // Set the publishedVersionId on the skill
      await db.update(skills).set({ publishedVersionId: versionId }).where(eq(skills.id, skill.id));
    }
    console.log(`  [+] ${insertedSkills.length} versions created and published`);

    // 5. Generate ratings (3-7 ratings per skill from different users)
    console.log("\nGenerating ratings...");
    let totalRatings = 0;
    for (const skill of insertedSkills) {
      const numRatings = 3 + Math.floor(Math.random() * 5); // 3-7 ratings
      const raters = testUsers
        .filter((u) => u.id !== skill.authorId) // Don't rate own skill
        .sort(() => Math.random() - 0.5) // Shuffle
        .slice(0, numRatings);

      for (const rater of raters) {
        const rating = 3 + Math.floor(Math.random() * 3); // 3-5 stars
        const comments = [
          "Very helpful!",
          "Saved me hours of work.",
          "Great skill, highly recommend.",
          "Works as expected.",
          "Could use some improvements but solid overall.",
          "Excellent quality!",
          "This is exactly what I needed.",
        ];
        await db.insert(ratings).values({
          tenantId: DEFAULT_TENANT_ID,
          skillId: skill.id,
          userId: rater.id!,
          rating,
          comment: comments[Math.floor(Math.random() * comments.length)],
          hoursSavedEstimate: 1 + Math.floor(Math.random() * 4),
        });
        totalRatings++;
      }
    }
    console.log(`  [+] ${totalRatings} ratings created`);

    // 6. Generate usage events (last 14 days)
    console.log("\nGenerating usage events...");
    let totalEvents = 0;
    for (const skill of insertedSkills) {
      // Random usage pattern
      const baseUsage = 2 + Math.floor(Math.random() * 8); // 2-9 base daily usage
      const trend = Math.random() > 0.5 ? 1.1 : 0.95; // Growing or declining

      for (let day = 0; day < 14; day++) {
        const dailyUsage = Math.floor(baseUsage * Math.pow(trend, day) * (0.5 + Math.random()));
        const eventDate = new Date();
        eventDate.setDate(eventDate.getDate() - (13 - day));

        for (let e = 0; e < dailyUsage; e++) {
          const randomUser = testUsers[Math.floor(Math.random() * testUsers.length)];
          const eventTime = new Date(eventDate);
          eventTime.setHours(8 + Math.floor(Math.random() * 10));
          eventTime.setMinutes(Math.floor(Math.random() * 60));

          await db.insert(usageEvents).values({
            tenantId: DEFAULT_TENANT_ID,
            toolName: skill.slug,
            skillId: skill.id,
            userId: randomUser.id,
            metadata: { source: "seed" },
            createdAt: eventTime,
          });
          totalEvents++;
        }
      }
    }
    console.log(`  [+] ${totalEvents} usage events created`);

    // 7. Update skill metrics
    console.log("\nUpdating skill metrics...");
    for (const skill of insertedSkills) {
      // Count actual usage
      const _usageCount = await db
        .select({ count: eq(usageEvents.skillId, skill.id) })
        .from(usageEvents)
        .where(eq(usageEvents.skillId, skill.id));

      // Calculate average rating
      const skillRatings = await db
        .select({ rating: ratings.rating })
        .from(ratings)
        .where(eq(ratings.skillId, skill.id));

      const avgRating =
        skillRatings.length > 0
          ? Math.round(
              (skillRatings.reduce((sum, r) => sum + r.rating, 0) / skillRatings.length) * 100
            )
          : null;

      await db
        .update(skills)
        .set({
          totalUses: skillRatings.length * 10 + Math.floor(Math.random() * 50), // Approximate usage
          averageRating: avgRating,
        })
        .where(eq(skills.id, skill.id));
    }
    console.log(`  [+] Metrics updated for ${insertedSkills.length} skills`);

    console.log("\n========================================");
    console.log("Seed complete!");
    console.log(`  - ${testUsers.length} users`);
    console.log(`  - ${insertedSkills.length} skills`);
    console.log(`  - ${totalRatings} ratings`);
    console.log(`  - ${totalEvents} usage events`);
    console.log("========================================\n");
  } catch (error) {
    console.error("Failed to seed database:", error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

seed();
