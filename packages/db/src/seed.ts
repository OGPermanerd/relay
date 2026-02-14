/**
 * Avenue One comprehensive seed data
 *
 * Creates a realistic demo dataset for Avenue One (aveone.com):
 * - 1 tenant (Avenue One)
 * - 100 users across 10 departments
 * - 50 skills with full content
 * - ~300 ratings
 * - ~20,000 usage events over 90 days
 * - ~15 AI reviews
 * - ~20 notifications
 *
 * Run with: pnpm --filter @everyskill/db db:seed
 */

import { config } from "dotenv";
config({ path: "../../.env.local" });
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq, sql } from "drizzle-orm";
import { skills } from "./schema/skills";
import { skillVersions } from "./schema/skill-versions";
import { ratings } from "./schema/ratings";
import { usageEvents } from "./schema/usage-events";
import { users } from "./schema/users";
import { tenants } from "./schema/tenants";
import { skillReviews } from "./schema/skill-reviews";
import { notifications } from "./schema/notifications";

// ============================================================================
// Database Connection
// ============================================================================

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("Error: DATABASE_URL environment variable is not set");
  process.exit(1);
}
const client = postgres(connectionString);
const db = drizzle(client);

// ============================================================================
// Constants
// ============================================================================

const TENANT_ID = "avo-tenant-avenue-one";
const TENANT = {
  id: TENANT_ID,
  name: "Avenue One",
  slug: "aveone",
  domain: "aveone.com",
};
const NOW = new Date();

// Deterministic RNG for reproducible seeds
let rngState = 42;
function rand(): number {
  rngState = (rngState * 1664525 + 1013904223) & 0x7fffffff;
  return rngState / 0x7fffffff;
}

// ============================================================================
// Types
// ============================================================================

type QualityTier = "winner" | "solid" | "average" | "new";
type UsagePattern = "hockey-stick" | "steady-growth" | "tail-off" | "flat" | "new-arrival";

interface UserDef {
  id: string;
  name: string;
  email: string;
  dept: string;
}

interface SkillDef {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: "productivity" | "wiring" | "doc-production" | "data-viz" | "code";
  tags: string[];
  hoursSaved: number;
  authorId: string;
  tier: QualityTier;
  usagePattern: UsagePattern;
  content: string;
}

// ============================================================================
// Users (100 across 10 departments)
// ============================================================================

const USERS: UserDef[] = [
  // Engineering (20) — power: u-001, u-003, u-005
  { id: "avo-u-001", name: "Priya Sharma", email: "priya.sharma@aveone.com", dept: "Engineering" },
  {
    id: "avo-u-002",
    name: "Liam O'Sullivan",
    email: "liam.osullivan@aveone.com",
    dept: "Engineering",
  },
  { id: "avo-u-003", name: "Marcus Chen", email: "marcus.chen@aveone.com", dept: "Engineering" },
  {
    id: "avo-u-004",
    name: "Zara Williams",
    email: "zara.williams@aveone.com",
    dept: "Engineering",
  },
  { id: "avo-u-005", name: "Jordan Blake", email: "jordan.blake@aveone.com", dept: "Engineering" },
  { id: "avo-u-006", name: "Amara Osei", email: "amara.osei@aveone.com", dept: "Engineering" },
  {
    id: "avo-u-007",
    name: "Ryan Kowalski",
    email: "ryan.kowalski@aveone.com",
    dept: "Engineering",
  },
  { id: "avo-u-008", name: "Sofia Petrov", email: "sofia.petrov@aveone.com", dept: "Engineering" },
  { id: "avo-u-009", name: "Derek Huang", email: "derek.huang@aveone.com", dept: "Engineering" },
  {
    id: "avo-u-010",
    name: "Nina Johansson",
    email: "nina.johansson@aveone.com",
    dept: "Engineering",
  },
  {
    id: "avo-u-011",
    name: "Carlos Mendoza",
    email: "carlos.mendoza@aveone.com",
    dept: "Engineering",
  },
  {
    id: "avo-u-012",
    name: "Fatima Hassan",
    email: "fatima.hassan@aveone.com",
    dept: "Engineering",
  },
  {
    id: "avo-u-013",
    name: "Ben Carpenter",
    email: "ben.carpenter@aveone.com",
    dept: "Engineering",
  },
  { id: "avo-u-014", name: "Yuki Tanaka", email: "yuki.tanaka@aveone.com", dept: "Engineering" },
  { id: "avo-u-015", name: "Alex Rivera", email: "alex.rivera@aveone.com", dept: "Engineering" },
  {
    id: "avo-u-016",
    name: "Emma Fitzgerald",
    email: "emma.fitzgerald@aveone.com",
    dept: "Engineering",
  },
  { id: "avo-u-017", name: "Raj Gupta", email: "raj.gupta@aveone.com", dept: "Engineering" },
  { id: "avo-u-018", name: "Chloe Dumont", email: "chloe.dumont@aveone.com", dept: "Engineering" },
  { id: "avo-u-019", name: "Owen Murphy", email: "owen.murphy@aveone.com", dept: "Engineering" },
  { id: "avo-u-020", name: "Ling Zhang", email: "ling.zhang@aveone.com", dept: "Engineering" },
  // Sales (15) — power: u-021
  { id: "avo-u-021", name: "Tyler Russo", email: "tyler.russo@aveone.com", dept: "Sales" },
  { id: "avo-u-022", name: "Morgan Kelly", email: "morgan.kelly@aveone.com", dept: "Sales" },
  { id: "avo-u-023", name: "Dante Rossi", email: "dante.rossi@aveone.com", dept: "Sales" },
  { id: "avo-u-024", name: "Alyssa Park", email: "alyssa.park@aveone.com", dept: "Sales" },
  { id: "avo-u-025", name: "Jake Morrison", email: "jake.morrison@aveone.com", dept: "Sales" },
  { id: "avo-u-026", name: "Camille Dubois", email: "camille.dubois@aveone.com", dept: "Sales" },
  { id: "avo-u-027", name: "Nate Brennan", email: "nate.brennan@aveone.com", dept: "Sales" },
  { id: "avo-u-028", name: "Isabella Cruz", email: "isabella.cruz@aveone.com", dept: "Sales" },
  { id: "avo-u-029", name: "Trevor Walsh", email: "trevor.walsh@aveone.com", dept: "Sales" },
  { id: "avo-u-030", name: "Preet Kaur", email: "preet.kaur@aveone.com", dept: "Sales" },
  { id: "avo-u-031", name: "Sam Goldstein", email: "sam.goldstein@aveone.com", dept: "Sales" },
  { id: "avo-u-032", name: "Hana Nguyen", email: "hana.nguyen@aveone.com", dept: "Sales" },
  { id: "avo-u-033", name: "Patrick Doyle", email: "patrick.doyle@aveone.com", dept: "Sales" },
  { id: "avo-u-034", name: "Elena Vasquez", email: "elena.vasquez@aveone.com", dept: "Sales" },
  { id: "avo-u-035", name: "Corey Adams", email: "corey.adams@aveone.com", dept: "Sales" },
  // Marketing (12) — power: u-036, u-038
  { id: "avo-u-036", name: "Rachel Torres", email: "rachel.torres@aveone.com", dept: "Marketing" },
  { id: "avo-u-037", name: "Brandon Lee", email: "brandon.lee@aveone.com", dept: "Marketing" },
  { id: "avo-u-038", name: "Nadia Okafor", email: "nadia.okafor@aveone.com", dept: "Marketing" },
  { id: "avo-u-039", name: "Dylan Foster", email: "dylan.foster@aveone.com", dept: "Marketing" },
  { id: "avo-u-040", name: "Megan Singh", email: "megan.singh@aveone.com", dept: "Marketing" },
  { id: "avo-u-041", name: "Jason Park", email: "jason.park@aveone.com", dept: "Marketing" },
  { id: "avo-u-042", name: "Layla Ahmed", email: "layla.ahmed@aveone.com", dept: "Marketing" },
  { id: "avo-u-043", name: "Evan Mitchell", email: "evan.mitchell@aveone.com", dept: "Marketing" },
  { id: "avo-u-044", name: "Tessa Romano", email: "tessa.romano@aveone.com", dept: "Marketing" },
  { id: "avo-u-045", name: "Kevin O'Brien", email: "kevin.obrien@aveone.com", dept: "Marketing" },
  { id: "avo-u-046", name: "Jada Thompson", email: "jada.thompson@aveone.com", dept: "Marketing" },
  { id: "avo-u-047", name: "Simon Keller", email: "simon.keller@aveone.com", dept: "Marketing" },
  // Operations (10) — power: u-048
  { id: "avo-u-048", name: "Diana Reeves", email: "diana.reeves@aveone.com", dept: "Operations" },
  {
    id: "avo-u-049",
    name: "Martin Schultz",
    email: "martin.schultz@aveone.com",
    dept: "Operations",
  },
  { id: "avo-u-050", name: "Grace Okonkwo", email: "grace.okonkwo@aveone.com", dept: "Operations" },
  {
    id: "avo-u-051",
    name: "Peter Lindgren",
    email: "peter.lindgren@aveone.com",
    dept: "Operations",
  },
  { id: "avo-u-052", name: "Rosa Delgado", email: "rosa.delgado@aveone.com", dept: "Operations" },
  { id: "avo-u-053", name: "Victor Popov", email: "victor.popov@aveone.com", dept: "Operations" },
  { id: "avo-u-054", name: "Hannah Byrne", email: "hannah.byrne@aveone.com", dept: "Operations" },
  {
    id: "avo-u-055",
    name: "Oscar Fernandez",
    email: "oscar.fernandez@aveone.com",
    dept: "Operations",
  },
  { id: "avo-u-056", name: "Ivy Chang", email: "ivy.chang@aveone.com", dept: "Operations" },
  { id: "avo-u-057", name: "Kurt Andersen", email: "kurt.andersen@aveone.com", dept: "Operations" },
  // Customer Success (10) — power: u-058
  {
    id: "avo-u-058",
    name: "Chris Donovan",
    email: "chris.donovan@aveone.com",
    dept: "Customer Success",
  },
  {
    id: "avo-u-059",
    name: "Maya Krishnan",
    email: "maya.krishnan@aveone.com",
    dept: "Customer Success",
  },
  {
    id: "avo-u-060",
    name: "Leo Santini",
    email: "leo.santini@aveone.com",
    dept: "Customer Success",
  },
  {
    id: "avo-u-061",
    name: "Abby Lawson",
    email: "abby.lawson@aveone.com",
    dept: "Customer Success",
  },
  {
    id: "avo-u-062",
    name: "Tariq Malik",
    email: "tariq.malik@aveone.com",
    dept: "Customer Success",
  },
  {
    id: "avo-u-063",
    name: "Julia Svensson",
    email: "julia.svensson@aveone.com",
    dept: "Customer Success",
  },
  {
    id: "avo-u-064",
    name: "Rory Gallagher",
    email: "rory.gallagher@aveone.com",
    dept: "Customer Success",
  },
  {
    id: "avo-u-065",
    name: "Fiona MacLeod",
    email: "fiona.macleod@aveone.com",
    dept: "Customer Success",
  },
  {
    id: "avo-u-066",
    name: "Andre Baptiste",
    email: "andre.baptiste@aveone.com",
    dept: "Customer Success",
  },
  {
    id: "avo-u-067",
    name: "Selena Ruiz",
    email: "selena.ruiz@aveone.com",
    dept: "Customer Success",
  },
  // HR/People (8) — power: u-068
  { id: "avo-u-068", name: "Kenji Nakamura", email: "kenji.nakamura@aveone.com", dept: "HR" },
  { id: "avo-u-069", name: "Lauren Cooper", email: "lauren.cooper@aveone.com", dept: "HR" },
  { id: "avo-u-070", name: "David Oyelaran", email: "david.oyelaran@aveone.com", dept: "HR" },
  { id: "avo-u-071", name: "Sarah Bergstrom", email: "sarah.bergstrom@aveone.com", dept: "HR" },
  { id: "avo-u-072", name: "Miguel Santos", email: "miguel.santos@aveone.com", dept: "HR" },
  { id: "avo-u-073", name: "Annika Holm", email: "annika.holm@aveone.com", dept: "HR" },
  { id: "avo-u-074", name: "Troy Jefferson", email: "troy.jefferson@aveone.com", dept: "HR" },
  { id: "avo-u-075", name: "Rebecca Stone", email: "rebecca.stone@aveone.com", dept: "HR" },
  // Finance (8) — power: u-076
  {
    id: "avo-u-076",
    name: "Samira Al-Rashid",
    email: "samira.alrashid@aveone.com",
    dept: "Finance",
  },
  { id: "avo-u-077", name: "Greg Novak", email: "greg.novak@aveone.com", dept: "Finance" },
  { id: "avo-u-078", name: "Wendy Hsu", email: "wendy.hsu@aveone.com", dept: "Finance" },
  { id: "avo-u-079", name: "Paul Barrett", email: "paul.barrett@aveone.com", dept: "Finance" },
  { id: "avo-u-080", name: "Naomi Ito", email: "naomi.ito@aveone.com", dept: "Finance" },
  { id: "avo-u-081", name: "Frank Morrison", email: "frank.morrison@aveone.com", dept: "Finance" },
  { id: "avo-u-082", name: "Deepa Reddy", email: "deepa.reddy@aveone.com", dept: "Finance" },
  { id: "avo-u-083", name: "Lucas Weber", email: "lucas.weber@aveone.com", dept: "Finance" },
  // Legal/Compliance (7)
  { id: "avo-u-084", name: "Catherine Li", email: "catherine.li@aveone.com", dept: "Legal" },
  { id: "avo-u-085", name: "James Whitfield", email: "james.whitfield@aveone.com", dept: "Legal" },
  { id: "avo-u-086", name: "Sonia Ramirez", email: "sonia.ramirez@aveone.com", dept: "Legal" },
  { id: "avo-u-087", name: "Thomas Eriksen", email: "thomas.eriksen@aveone.com", dept: "Legal" },
  { id: "avo-u-088", name: "Aaliya Khan", email: "aaliya.khan@aveone.com", dept: "Legal" },
  { id: "avo-u-089", name: "Daniel Frost", email: "daniel.frost@aveone.com", dept: "Legal" },
  { id: "avo-u-090", name: "Michelle Tan", email: "michelle.tan@aveone.com", dept: "Legal" },
  // Management (5)
  {
    id: "avo-u-091",
    name: "Victoria Ashford",
    email: "victoria.ashford@aveone.com",
    dept: "Management",
  },
  { id: "avo-u-092", name: "Robert Kim", email: "robert.kim@aveone.com", dept: "Management" },
  {
    id: "avo-u-093",
    name: "Patricia Mueller",
    email: "patricia.mueller@aveone.com",
    dept: "Management",
  },
  { id: "avo-u-094", name: "Steven Clarke", email: "steven.clarke@aveone.com", dept: "Management" },
  { id: "avo-u-095", name: "Jennifer Wu", email: "jennifer.wu@aveone.com", dept: "Management" },
  // Procurement (5)
  { id: "avo-u-096", name: "Brian Kofi", email: "brian.kofi@aveone.com", dept: "Procurement" },
  { id: "avo-u-097", name: "Lisa Harada", email: "lisa.harada@aveone.com", dept: "Procurement" },
  {
    id: "avo-u-098",
    name: "Mark Petersen",
    email: "mark.petersen@aveone.com",
    dept: "Procurement",
  },
  { id: "avo-u-099", name: "Angela Russo", email: "angela.russo@aveone.com", dept: "Procurement" },
  { id: "avo-u-100", name: "Darius Obi", email: "darius.obi@aveone.com", dept: "Procurement" },
];

// ============================================================================
// Skills (50 across departments)
// ============================================================================
// Tiers: winner(10), solid(15), average(15), new(10)
// Usage: hockey-stick(10), steady-growth(10), tail-off(5), flat(15), new-arrival(10)
// Categories: productivity(30), wiring(14), code(6)

const SKILLS: SkillDef[] = [
  // ===== WINNER TIER (10) — hockey-stick usage =====
  {
    id: "avo-s-001",
    name: "Code Review Assistant",
    slug: "code-review-assistant",
    description:
      "AI-powered code review that analyzes pull requests for bugs, security issues, performance problems, and best practice violations with actionable fix suggestions.",
    category: "productivity",
    tags: ["code-review", "security", "best-practices", "engineering"],
    hoursSaved: 3,
    authorId: "avo-u-001",
    tier: "winner",
    usagePattern: "hockey-stick",
    content: `# Code Review Assistant

You are a senior code reviewer at Avenue One. Analyze the provided code changes thoroughly and provide actionable feedback.

## Context
- **Language/Framework**: {{language}} (auto-detected if not specified)
- **PR Title**: {{pr_title}}
- **PR Description**: {{pr_description}}

## Code to Review
\`\`\`
{{code_diff}}
\`\`\`

## Review Checklist
1. **Correctness**: Logic errors, off-by-one, null/undefined handling, race conditions
2. **Security**: SQL injection, XSS, CSRF, secrets in code, insecure deserialization
3. **Performance**: N+1 queries, unnecessary re-renders, missing indexes, memory leaks
4. **Maintainability**: Naming clarity, function length, single responsibility, DRY violations
5. **Error Handling**: Missing try/catch, swallowed errors, unhelpful error messages
6. **Testing**: Untested edge cases, missing assertions, flaky test patterns
7. **API Design**: Breaking changes, backwards compatibility, consistent naming

## Output Format
For each finding:
- **Severity**: CRITICAL | WARNING | SUGGESTION | NITPICK
- **File**: filename:line_number
- **Issue**: Clear description of what's wrong
- **Fix**: Specific code suggestion or approach
- **Why**: Brief explanation of impact if not fixed

## Guidelines
- Be specific — reference exact lines and variable names
- Provide fix suggestions, not just complaints
- Acknowledge good patterns when you see them
- Prioritize findings by severity
- Flag any breaking API changes prominently
- If the code is clean, say so briefly — don't invent issues`,
  },
  {
    id: "avo-s-002",
    name: "Email Drafter",
    slug: "email-drafter",
    description:
      "Drafts professional emails for any business context — client communications, internal updates, follow-ups, and executive summaries — with appropriate tone and structure.",
    category: "productivity",
    tags: ["email", "communication", "writing", "cross-functional"],
    hoursSaved: 1,
    authorId: "avo-u-005",
    tier: "winner",
    usagePattern: "hockey-stick",
    content: `# Email Drafter

Draft a professional email based on the context provided.

## Inputs
- **To**: {{recipient}} (name and role/relationship)
- **Context**: {{context}} (what this is about)
- **Tone**: {{tone}} (formal / friendly / urgent / diplomatic — default: professional)
- **Goal**: {{goal}} (what you want the recipient to do or know)
- **Key Points**: {{key_points}} (bullet points to include)
- **Constraints**: {{constraints}} (word limit, things to avoid, required inclusions)

## Instructions
1. Write a clear subject line that summarizes the email's purpose
2. Open with appropriate greeting based on relationship
3. Lead with the most important information or ask
4. Include all key points naturally — don't just list them
5. End with a clear call to action or next step
6. Match the tone throughout — no jarring shifts
7. Keep it concise: aim for 100-200 words unless complexity requires more

## Output
Subject: [subject line]

[email body]

## Rules
- Never use "I hope this email finds you well" or similar filler
- Avoid jargon the recipient wouldn't know
- One idea per paragraph
- Bold or highlight action items if the email has multiple asks
- For follow-ups, reference the previous conversation briefly
- For bad news, lead with context before the news itself`,
  },
  {
    id: "avo-s-003",
    name: "Meeting Agenda Generator",
    slug: "meeting-agenda-generator",
    description:
      "Creates structured meeting agendas with time allocations, discussion points, pre-read materials, and clear outcomes for any meeting type.",
    category: "productivity",
    tags: ["meetings", "productivity", "planning", "cross-functional"],
    hoursSaved: 1,
    authorId: "avo-u-005",
    tier: "winner",
    usagePattern: "hockey-stick",
    content: `# Meeting Agenda Generator

Create a structured meeting agenda that keeps discussions focused and productive.

## Inputs
- **Meeting Type**: {{type}} (standup / planning / retrospective / decision / brainstorm / status update / 1:1)
- **Duration**: {{duration}} minutes
- **Attendees**: {{attendees}}
- **Topics**: {{topics}} (key items to cover)
- **Previous Action Items**: {{action_items}} (optional — items from last meeting)

## Agenda Structure

### Header
- Meeting title, date/time, duration
- Attendees and roles (facilitator, note-taker, decision-maker)

### Pre-Read (if applicable)
- Links or documents to review before the meeting
- Expected preparation time

### Agenda Items
For each item:
- Topic name and owner
- Time allocation (be realistic — leave buffer)
- Goal: INFORM / DISCUSS / DECIDE / BRAINSTORM
- Key questions to answer

### Wrap-Up (last 5 minutes)
- Decisions made
- Action items with owners and deadlines
- Parking lot items for future meetings

## Rules
- Total time allocations must equal meeting duration
- Every item needs an owner
- Decision items need clear options listed
- No item should exceed 40% of total meeting time
- Include 5-minute buffer for transitions`,
  },
  {
    id: "avo-s-004",
    name: "Campaign Brief Generator",
    slug: "campaign-brief-generator",
    description:
      "Generates comprehensive marketing campaign briefs with target audience, messaging, channel strategy, KPIs, and timeline for any campaign type.",
    category: "productivity",
    tags: ["marketing", "campaigns", "strategy", "briefs"],
    hoursSaved: 4,
    authorId: "avo-u-036",
    tier: "winner",
    usagePattern: "hockey-stick",
    content: `# Campaign Brief Generator

Create a comprehensive marketing campaign brief that aligns all stakeholders.

## Inputs
- **Campaign Name**: {{name}}
- **Product/Feature**: {{product}} — what we're promoting
- **Objective**: {{objective}} (awareness / lead gen / activation / retention / launch)
- **Target Audience**: {{audience}}
- **Budget Range**: {{budget}}
- **Timeline**: {{timeline}}
- **Key Message**: {{message}} — the one thing we want people to remember

## Brief Structure

### 1. Executive Summary
One paragraph capturing campaign goal, audience, and expected impact.

### 2. Target Audience
- Primary persona: demographics, pain points, motivations
- Secondary persona (if applicable)
- Where they spend time (channels, communities, events)

### 3. Campaign Messaging
- **Hero Message**: The primary headline/tagline
- **Supporting Messages**: 3-4 proof points or value props
- **Tone**: How it should feel (bold, empathetic, technical, playful)
- **Competitive Differentiation**: Why us over alternatives

### 4. Channel Strategy
For each channel: purpose, content type, frequency, and estimated reach.
Channels: email, social (specify platforms), paid ads, content marketing, events, PR, partnerships.

### 5. Creative Requirements
- Assets needed (landing page, emails, social posts, ads, videos)
- Brand guidelines to follow
- Any existing assets to leverage

### 6. KPIs & Success Metrics
- Primary KPI with target number
- Secondary metrics
- Measurement methodology

### 7. Timeline & Milestones
Week-by-week breakdown with key deliverables and owners.

### 8. Budget Allocation
By channel and by phase (pre-launch, launch, sustain).`,
  },
  {
    id: "avo-s-005",
    name: "Sales Discovery Call Prep",
    slug: "sales-discovery-call-prep",
    description:
      "Prepares comprehensive briefings for sales discovery calls including prospect research, tailored questions, objection prep, and talking points.",
    category: "productivity",
    tags: ["sales", "discovery", "preparation", "research"],
    hoursSaved: 2,
    authorId: "avo-u-021",
    tier: "winner",
    usagePattern: "hockey-stick",
    content: `# Sales Discovery Call Prep

Prepare a comprehensive briefing for an upcoming discovery call.

## Inputs
- **Prospect Company**: {{company}}
- **Contact Name & Title**: {{contact}}
- **Industry**: {{industry}}
- **Company Size**: {{size}} (employees / revenue range)
- **How They Found Us**: {{source}}
- **Initial Interest**: {{interest}} — what they asked about or clicked on
- **Our Solution Fit**: {{solution}} — which of our products/services are relevant

## Briefing Structure

### Company Snapshot
- What they do (2-3 sentences)
- Recent news, funding, or leadership changes
- Key competitors in their space
- Likely tech stack and tools

### Stakeholder Profile
- Contact's role and likely priorities
- Potential decision-making authority
- Other stakeholders who may be involved

### Discovery Questions (prioritized)
**Situation**: Current state and context
1. "Can you walk me through how your team currently handles {{relevant_process}}?"
2. "What tools are you using today for {{area}}?"

**Problem**: Pain points and challenges
3. "What's the biggest challenge you're facing with {{area}}?"
4. "How is that impacting {{business_metric}}?"

**Implication**: Cost of inaction
5. "If this doesn't get solved in the next 6 months, what happens?"

**Need-Payoff**: Value of solving
6. "If you could wave a magic wand, what would the ideal solution look like?"

### Talking Points
- 2-3 relevant case studies or proof points
- ROI data points for their industry
- Differentiators vs. their likely alternatives

### Objection Prep
Top 3 likely objections with response frameworks.

### Call Outcome Goals
- Information to gather (BANT: Budget, Authority, Need, Timeline)
- Ideal next step to propose
- Red flags to watch for`,
  },
  {
    id: "avo-s-006",
    name: "Process Documentation Writer",
    slug: "process-documentation-writer",
    description:
      "Creates clear, step-by-step process documentation with roles, decision points, exceptions, and quality checkpoints for any business process.",
    category: "wiring",
    tags: ["documentation", "processes", "operations", "sop"],
    hoursSaved: 3,
    authorId: "avo-u-048",
    tier: "winner",
    usagePattern: "hockey-stick",
    content: `# Process Documentation Writer

Create comprehensive process documentation that anyone can follow.

## Inputs
- **Process Name**: {{name}}
- **Purpose**: {{purpose}} — why this process exists
- **Owner**: {{owner}} — who maintains this process
- **Trigger**: {{trigger}} — what starts this process
- **End State**: {{end_state}} — what "done" looks like
- **Stakeholders**: {{stakeholders}}

## Document Structure

### 1. Overview
- Process name, version, last updated
- Purpose and scope (what's included and excluded)
- Process owner and approver
- Estimated time to complete

### 2. Prerequisites
- Required access, tools, or permissions
- Information needed before starting
- Dependencies on other processes

### 3. Step-by-Step Instructions
For each step:
- **Step N**: [Action verb] + [specific task]
- **Who**: Role responsible
- **How**: Detailed instructions with screenshots/examples where helpful
- **Decision Point**: If applicable — criteria for each path
- **Quality Check**: How to verify this step was done correctly
- **Common Mistakes**: What to watch out for

### 4. Exception Handling
- Known edge cases and how to handle them
- Escalation path when something goes wrong
- Rollback procedures if needed

### 5. Metrics & SLAs
- How long each step should take
- Quality thresholds
- Reporting requirements

## Rules
- Use active voice and imperative mood ("Click the button" not "The button should be clicked")
- Number every step — no sub-bullets deeper than 2 levels
- Include a quick-reference checklist at the end
- Flag any steps that require approval or sign-off`,
  },
  {
    id: "avo-s-007",
    name: "Job Description Writer",
    slug: "job-description-writer",
    description:
      "Writes compelling, inclusive job descriptions with clear requirements, growth opportunities, and team context that attract diverse qualified candidates.",
    category: "productivity",
    tags: ["hiring", "recruiting", "hr", "job-descriptions"],
    hoursSaved: 2,
    authorId: "avo-u-068",
    tier: "winner",
    usagePattern: "hockey-stick",
    content: `# Job Description Writer

Write a compelling job description that attracts qualified, diverse candidates.

## Inputs
- **Job Title**: {{title}}
- **Department**: {{department}}
- **Level**: {{level}} (junior / mid / senior / lead / director)
- **Location**: {{location}} (remote / hybrid / on-site + city)
- **Hiring Manager**: {{manager}}
- **Team Size**: {{team_size}}
- **Key Responsibilities**: {{responsibilities}}
- **Must-Have Skills**: {{required_skills}}
- **Nice-to-Have Skills**: {{preferred_skills}}
- **Salary Range**: {{salary}} (if shareable)

## Structure

### Opening Hook (2-3 sentences)
What makes this role exciting and impactful — not a company boilerplate.

### What You'll Do
- 5-7 key responsibilities using action verbs
- Focus on outcomes and impact, not just tasks
- Include cross-functional collaboration aspects

### What You'll Bring
- Must-haves: 4-6 genuinely required skills/experiences
- Nice-to-haves: 3-4 preferred but not required
- Use "experience with" not "X years of"

### What We Offer
- Growth and learning opportunities specific to this role
- Team culture and working style
- Benefits highlights (if available)

### About the Team
2-3 sentences about the team, what they're working on, and why it matters.

## Rules
- Avoid gendered language (he/she, rockstar, ninja, guru)
- Don't inflate requirements — list only genuine must-haves
- Remove "X+ years" requirements — focus on skills and demonstrated ability
- Use "you" language to help candidates see themselves in the role
- Include salary range if possible — it increases qualified applications by 30%
- Keep total length under 700 words`,
  },
  {
    id: "avo-s-008",
    name: "Financial Report Summarizer",
    slug: "financial-report-summarizer",
    description:
      "Transforms complex financial reports into executive summaries with key metrics, trend analysis, variance explanations, and actionable recommendations.",
    category: "productivity",
    tags: ["finance", "reporting", "analysis", "executive-summary"],
    hoursSaved: 3,
    authorId: "avo-u-076",
    tier: "winner",
    usagePattern: "hockey-stick",
    content: `# Financial Report Summarizer

Transform financial data into a clear executive summary with insights and recommendations.

## Inputs
- **Report Type**: {{type}} (monthly P&L / quarterly review / budget vs actual / cash flow / board deck)
- **Period**: {{period}}
- **Raw Data**: {{data}} (paste financial figures, tables, or report text)
- **Audience**: {{audience}} (board / exec team / department heads / all-hands)
- **Key Concerns**: {{concerns}} (specific areas to highlight)

## Output Structure

### Executive Summary (3-4 sentences)
The most important takeaway — lead with the headline number and trend.

### Key Metrics Dashboard
| Metric | Actual | Target | Variance | Trend |
|--------|--------|--------|----------|-------|
Format key metrics as a comparison table with red/green indicators.

### Revenue Analysis
- Total revenue vs. plan with percentage variance
- Revenue by segment/product — highlight movers
- MRR/ARR trends if applicable
- Pipeline health indicators

### Expense Analysis
- Total expenses vs. budget
- Top 3 over-budget line items with explanations
- Top 3 under-budget items and whether that's good or concerning
- Headcount spend vs. plan

### Cash Position
- Current cash balance and runway
- Burn rate trend (improving / stable / concerning)
- Working capital changes

### Variance Explanations
For each material variance (>5%):
- What happened
- Is it one-time or recurring?
- Action needed

### Recommendations
3-5 specific, actionable recommendations based on the data.

## Rules
- Always express variances as both absolute numbers and percentages
- Use plain language — avoid jargon the audience wouldn't know
- Highlight risks in a separate callout
- Compare to prior period AND budget/plan
- Round to appropriate precision (thousands for small, millions for large)`,
  },
  {
    id: "avo-s-009",
    name: "Customer Health Score Calculator",
    slug: "customer-health-score-calculator",
    description:
      "Calculates and explains customer health scores using product usage, engagement, support, and financial signals with risk mitigation recommendations.",
    category: "code",
    tags: ["customer-success", "health-score", "churn-prevention", "analytics"],
    hoursSaved: 2,
    authorId: "avo-u-058",
    tier: "winner",
    usagePattern: "hockey-stick",
    content: `# Customer Health Score Calculator

Analyze customer signals and produce a comprehensive health assessment.

## Inputs
- **Customer Name**: {{customer}}
- **Contract Value**: {{acv}} (annual contract value)
- **Contract Renewal Date**: {{renewal_date}}
- **Product Usage Data**: {{usage}} (DAU/MAU, feature adoption, login frequency)
- **Support Tickets**: {{tickets}} (count, severity, resolution time, CSAT)
- **Engagement**: {{engagement}} (QBR attendance, executive sponsor access, NPS score)
- **Financial**: {{financial}} (payment history, expansion/contraction, open invoices)
- **Relationship Notes**: {{notes}} (CSM observations, recent conversations)

## Health Score Framework

### Scoring Categories (100 points total)
1. **Product Usage** (30 pts): DAU/MAU ratio, feature breadth, trend direction
2. **Engagement** (25 pts): QBR participation, champion responsiveness, NPS
3. **Support** (20 pts): Ticket volume trend, severity mix, CSAT scores
4. **Financial** (15 pts): Payment timeliness, expansion signals, contract growth
5. **Relationship** (10 pts): Executive sponsor access, multi-threading depth

### Health Bands
- **90-100**: Thriving — expansion candidate
- **70-89**: Healthy — maintain and grow
- **50-69**: Needs Attention — proactive outreach required
- **30-49**: At Risk — intervention plan needed
- **0-29**: Critical — executive escalation

## Output
### Health Score: [X]/100 — [BAND]
Breakdown by category with specific signals driving each score.

### Trend
Improving / Stable / Declining — based on 30/60/90 day comparison.

### Top Risks
Specific risks ranked by likelihood and impact.

### Recommended Actions
Prioritized list of 3-5 actions with owner suggestions and timelines.

### Renewal Forecast
Likely outcome (renew / renew with expansion / renew with contraction / at risk of churn) with confidence level.`,
  },
  {
    id: "avo-s-010",
    name: "Contract Clause Analyzer",
    slug: "contract-clause-analyzer",
    description:
      "Reviews contract clauses for risk, compliance, and business impact — flags concerning language and suggests protective amendments.",
    category: "productivity",
    tags: ["legal", "contracts", "risk-analysis", "compliance"],
    hoursSaved: 4,
    authorId: "avo-u-084",
    tier: "winner",
    usagePattern: "hockey-stick",
    content: `# Contract Clause Analyzer

Analyze contract clauses for legal risk, business impact, and compliance concerns.

## Inputs
- **Contract Type**: {{type}} (SaaS agreement / NDA / MSA / SOW / employment / vendor)
- **Our Role**: {{role}} (vendor / customer / partner)
- **Contract Text**: {{contract_text}}
- **Specific Concerns**: {{concerns}} (areas to focus on)
- **Jurisdiction**: {{jurisdiction}}

## Analysis Framework

### For Each Clause, Assess:
1. **Risk Level**: HIGH / MEDIUM / LOW
2. **Business Impact**: How this affects operations, liability, or finances
3. **Market Standard**: Is this typical for this contract type?
4. **Compliance**: Any regulatory concerns (GDPR, SOC2, CCPA, etc.)
5. **Recommendation**: ACCEPT / NEGOTIATE / REJECT

### Priority Clauses to Flag
- Indemnification and liability caps
- Termination and exit provisions
- Data ownership and privacy
- IP assignment and work-for-hire
- Non-compete and non-solicitation scope
- Auto-renewal and price escalation
- Audit rights and SLA commitments
- Force majeure and governing law
- Assignment and change of control

## Output Format
For each flagged clause:
- **Clause**: Quote the relevant language
- **Risk**: HIGH / MEDIUM / LOW with explanation
- **Issue**: What's concerning and why
- **Suggested Amendment**: Specific language to propose
- **Negotiation Notes**: Likely pushback and counter-arguments

### Summary
- Overall risk assessment
- Top 3 must-negotiate items
- Recommended red lines (deal-breakers if not resolved)

## Disclaimer
This analysis is for review assistance only and does not constitute legal advice. All flagged items should be reviewed by qualified legal counsel.`,
  },

  // ===== SOLID TIER — STEADY GROWTH (10) =====
  {
    id: "avo-s-011",
    name: "API Documentation Generator",
    slug: "api-documentation-generator",
    description:
      "Generates comprehensive API documentation from code, endpoints, or OpenAPI specs — including examples, error codes, and authentication details.",
    category: "wiring",
    tags: ["documentation", "api", "engineering", "developer-experience"],
    hoursSaved: 4,
    authorId: "avo-u-001",
    tier: "solid",
    usagePattern: "steady-growth",
    content: `# API Documentation Generator

Generate clear, comprehensive API documentation from source material.

## Inputs
- **API Source**: {{source}} (OpenAPI spec / code / endpoint list / Postman collection)
- **Base URL**: {{base_url}}
- **Auth Method**: {{auth}} (Bearer token / API key / OAuth2 / none)

## For Each Endpoint, Document:
1. **Method + Path**: \`GET /api/v1/resource\`
2. **Description**: What it does in one sentence
3. **Authentication**: Required auth and scopes
4. **Parameters**: Path params, query params, headers — with types and required/optional
5. **Request Body**: JSON schema with field descriptions
6. **Response**: Success response with example JSON
7. **Error Codes**: 4xx/5xx responses with error message format
8. **Rate Limits**: If applicable

## Output Format
Use standard API doc markdown with code blocks for examples. Group endpoints by resource. Include a quick-start section at the top with auth setup and a basic request example.`,
  },
  {
    id: "avo-s-012",
    name: "Social Media Content Calendar",
    slug: "social-media-content-calendar",
    description:
      "Creates a structured content calendar for social media with post ideas, copy drafts, hashtags, and optimal posting times across platforms.",
    category: "wiring",
    tags: ["social-media", "content", "marketing", "planning"],
    hoursSaved: 3,
    authorId: "avo-u-036",
    tier: "solid",
    usagePattern: "steady-growth",
    content: `# Social Media Content Calendar

Create a structured content calendar with ready-to-post content.

## Inputs
- **Brand**: {{brand}} and voice guidelines
- **Platforms**: {{platforms}} (LinkedIn / Twitter / Instagram / TikTok)
- **Time Period**: {{period}} (1 week / 2 weeks / 1 month)
- **Key Themes**: {{themes}} — topics or campaigns to promote
- **Content Pillars**: {{pillars}} (thought leadership / product / culture / industry news)
- **Posting Frequency**: {{frequency}} per platform per week

## For Each Post:
- **Date & Time**: Optimal posting time for the platform
- **Platform**: Where it goes
- **Content Pillar**: Which pillar this serves
- **Copy**: Ready-to-publish text (platform-appropriate length)
- **Visual Direction**: What image/video to pair with it
- **Hashtags**: 3-5 relevant hashtags
- **CTA**: What we want people to do
- **Internal Notes**: Why this post, what it ties to

## Rules
- Mix content pillars — no more than 2 consecutive posts from same pillar
- Platform-appropriate length (LinkedIn: 150-300 words, Twitter: <280 chars)
- Include engagement hooks (questions, polls, hot takes)
- Balance promotional vs. value-add content (80/20 rule)`,
  },
  {
    id: "avo-s-013",
    name: "SEO Content Optimizer",
    slug: "seo-content-optimizer",
    description:
      "Analyzes and optimizes content for search engine visibility — keyword placement, meta descriptions, heading structure, and readability improvements.",
    category: "productivity",
    tags: ["seo", "content", "marketing", "optimization"],
    hoursSaved: 2,
    authorId: "avo-u-036",
    tier: "solid",
    usagePattern: "steady-growth",
    content: `# SEO Content Optimizer

Analyze content for SEO effectiveness and provide specific optimization recommendations.

## Inputs
- **Content**: {{content}} (article, blog post, or page copy)
- **Target Keyword**: {{primary_keyword}}
- **Secondary Keywords**: {{secondary_keywords}}
- **Target URL**: {{url}} (if existing page)

## Analysis & Recommendations

### Title Tag
- Current title analysis
- Optimized title suggestion (50-60 chars, keyword-forward)

### Meta Description
- Optimized meta description (150-160 chars, includes CTA)

### Heading Structure
- H1 analysis (should contain primary keyword)
- H2/H3 structure recommendations with keyword variations

### Content Optimization
- Keyword density check (target: 1-2% for primary)
- Semantic keyword suggestions (LSI keywords)
- Content length recommendation based on SERP competition
- Internal linking opportunities
- Readability score and simplification suggestions

### Technical SEO Checklist
- Image alt text suggestions
- Schema markup recommendations
- URL slug optimization`,
  },
  {
    id: "avo-s-014",
    name: "Proposal Generator",
    slug: "proposal-generator",
    description:
      "Creates persuasive business proposals with executive summary, solution design, pricing, timeline, and social proof tailored to the prospect.",
    category: "wiring",
    tags: ["sales", "proposals", "business-development", "writing"],
    hoursSaved: 5,
    authorId: "avo-u-021",
    tier: "solid",
    usagePattern: "steady-growth",
    content: `# Proposal Generator

Create a persuasive, professional proposal tailored to the prospect.

## Inputs
- **Prospect**: {{prospect}} — company name and key contact
- **Opportunity**: {{opportunity}} — what they need
- **Our Solution**: {{solution}} — what we're proposing
- **Pricing**: {{pricing}} — pricing structure
- **Timeline**: {{timeline}} — implementation timeline
- **Competitors**: {{competitors}} — who else they're evaluating

## Proposal Sections

### 1. Executive Summary
2-3 paragraphs: their challenge, our solution, expected outcomes. Mirror their language.

### 2. Understanding Your Needs
Demonstrate we listened — restate their situation, goals, and constraints.

### 3. Proposed Solution
- Solution overview with clear scope
- How it addresses each stated need
- Technical approach (appropriate detail level)
- What's included and explicitly excluded

### 4. Why Avenue One
- Relevant case studies (2-3)
- Key differentiators vs. alternatives
- Team qualifications

### 5. Timeline & Milestones
Phase-by-phase breakdown with key deliverables and dependencies.

### 6. Investment
- Pricing table with clear line items
- Payment terms
- What triggers additional costs

### 7. Next Steps
Clear call to action with proposed timeline for decision.`,
  },
  {
    id: "avo-s-015",
    name: "Performance Review Assistant",
    slug: "performance-review-assistant",
    description:
      "Helps managers write balanced, specific performance reviews with concrete examples, growth areas, and development goals.",
    category: "productivity",
    tags: ["hr", "performance", "management", "feedback"],
    hoursSaved: 2,
    authorId: "avo-u-068",
    tier: "solid",
    usagePattern: "steady-growth",
    content: `# Performance Review Assistant

Write a balanced, specific performance review that supports employee growth.

## Inputs
- **Employee Name**: {{name}}
- **Role**: {{role}}
- **Review Period**: {{period}}
- **Key Accomplishments**: {{accomplishments}} — what they achieved
- **Areas for Growth**: {{growth_areas}} — where they can improve
- **Goals from Last Review**: {{prior_goals}} — progress on previous goals
- **Peer Feedback**: {{peer_feedback}} (optional)
- **Overall Rating**: {{rating}} (exceeds / meets / developing / below expectations)

## Review Structure

### Overall Assessment (2-3 sentences)
Summary of performance — specific, balanced, forward-looking.

### Key Accomplishments
For each accomplishment:
- What they did (specific action)
- Impact on the team/company (measurable where possible)
- Skills demonstrated

### Areas for Development
For each area:
- Specific observation (not personality judgment)
- Impact on their effectiveness
- Concrete suggestion for improvement
- Resources or support available

### Goal Progress
Review each prior goal — met / partially met / not met — with context.

### Goals for Next Period
3-5 SMART goals aligned with their role and development areas.

## Rules
- Use specific examples, not generalizations
- Focus on behaviors and outcomes, not personality traits
- Balance positive and constructive feedback (don't sandwich)
- Avoid recency bias — cover the full review period
- No surprises — reviews should confirm ongoing feedback conversations`,
  },
  // ===== SOLID TIER — STEADY GROWTH continued (5 more) =====
  {
    id: "avo-s-016",
    name: "Budget Variance Analyzer",
    slug: "budget-variance-analyzer",
    description:
      "Compares actual spending against budget across departments, identifies material variances, and generates explanations with recommended corrective actions.",
    category: "wiring",
    tags: ["finance", "budgeting", "variance-analysis", "reporting"],
    hoursSaved: 3,
    authorId: "avo-u-076",
    tier: "solid",
    usagePattern: "steady-growth",
    content: `# Budget Variance Analyzer

Analyze actual vs. budget figures and produce a variance report with explanations.

## Inputs
- **Budget Data**: {{budget}} (planned figures by line item)
- **Actual Data**: {{actuals}} (actual spending by line item)
- **Period**: {{period}}
- **Department**: {{department}} (or "all" for company-wide)
- **Materiality Threshold**: {{threshold}} (default: 5% or $5,000)

## Analysis Steps
1. Calculate variance for each line item (absolute and percentage)
2. Flag items exceeding materiality threshold
3. Categorize as favorable/unfavorable
4. Identify trends (is variance growing or shrinking month over month?)
5. Group by department and cost category

## Output
### Variance Summary Table
| Line Item | Budget | Actual | Variance ($) | Variance (%) | Status |

### Material Variances (detail)
For each material variance:
- Root cause analysis
- Is this a timing difference or a true variance?
- One-time vs. recurring
- Recommended action

### Forecast Impact
How these variances affect full-year projections.`,
  },
  {
    id: "avo-s-017",
    name: "Privacy Policy Reviewer",
    slug: "privacy-policy-reviewer",
    description:
      "Reviews privacy policies and data processing agreements for GDPR, CCPA, and SOC2 compliance — flags gaps and suggests required language.",
    category: "wiring",
    tags: ["legal", "privacy", "compliance", "gdpr"],
    hoursSaved: 3,
    authorId: "avo-u-085",
    tier: "solid",
    usagePattern: "steady-growth",
    content: `# Privacy Policy Reviewer

Review privacy policy text for regulatory compliance and completeness.

## Inputs
- **Policy Text**: {{policy}}
- **Applicable Regulations**: {{regulations}} (GDPR / CCPA / SOC2 / HIPAA / all)
- **Data Types Collected**: {{data_types}}
- **Third-Party Processors**: {{processors}} (analytics, hosting, payment, etc.)

## Compliance Checklist

### GDPR Requirements
- Lawful basis for processing stated
- Data subject rights clearly explained (access, deletion, portability)
- Data retention periods specified
- International transfer mechanisms documented
- DPO contact information provided
- Cookie consent mechanism described

### CCPA Requirements
- Categories of personal information collected
- Right to opt-out of sale clearly stated
- "Do Not Sell My Personal Information" link requirement
- Financial incentive disclosures

### General Best Practices
- Plain language (readable at 8th grade level)
- Last updated date
- Contact information for privacy questions
- Version history or changelog

## Output
For each requirement: COMPLIANT / NON-COMPLIANT / PARTIALLY COMPLIANT with specific language suggestions for gaps.`,
  },
  {
    id: "avo-s-018",
    name: "QBR Presentation Builder",
    slug: "qbr-presentation-builder",
    description:
      "Builds quarterly business review presentations with value delivered, usage metrics, roadmap alignment, and strategic recommendations for customer meetings.",
    category: "wiring",
    tags: ["customer-success", "qbr", "presentations", "account-management"],
    hoursSaved: 4,
    authorId: "avo-u-058",
    tier: "solid",
    usagePattern: "steady-growth",
    content: `# QBR Presentation Builder

Create a compelling Quarterly Business Review presentation for a customer meeting.

## Inputs
- **Customer**: {{customer}}
- **Quarter**: {{quarter}}
- **Usage Metrics**: {{metrics}} (adoption rates, feature usage, active users)
- **Support Summary**: {{support}} (tickets, resolution times, CSAT)
- **Value Delivered**: {{value}} (time saved, cost reduction, efficiency gains)
- **Upcoming Roadmap**: {{roadmap}} (features relevant to this customer)
- **Customer Goals**: {{goals}} (their stated objectives for this quarter)

## Slide Structure

### 1. Executive Summary (1 slide)
Key wins, headline metric, overall health status.

### 2. Goals Review (1 slide)
Last quarter's goals — status and progress for each.

### 3. Usage & Adoption (2 slides)
- Key metrics with trend arrows
- Feature adoption heatmap
- User growth and engagement trends
- Benchmark vs. similar customers

### 4. Value Delivered (1-2 slides)
- Quantified ROI (hours saved, cost avoided, revenue impact)
- Success stories from their team
- Before/after comparisons

### 5. Support Review (1 slide)
- Ticket trends and CSAT scores
- Resolution time improvements
- Open items status

### 6. Roadmap Preview (1 slide)
Features coming that align with their needs.

### 7. Recommendations & Next Steps (1 slide)
- 3 strategic recommendations
- Action items with owners
- Goals for next quarter`,
  },
  {
    id: "avo-s-019",
    name: "Knowledge Base Article Writer",
    slug: "knowledge-base-article-writer",
    description:
      "Creates clear, searchable knowledge base articles with proper structure, troubleshooting steps, and related article links for internal or customer-facing use.",
    category: "productivity",
    tags: ["documentation", "knowledge-base", "support", "cross-functional"],
    hoursSaved: 2,
    authorId: "avo-u-059",
    tier: "solid",
    usagePattern: "steady-growth",
    content: `# Knowledge Base Article Writer

Write a clear, searchable knowledge base article.

## Inputs
- **Topic**: {{topic}}
- **Audience**: {{audience}} (internal team / customers / both)
- **Problem Statement**: {{problem}} — what question does this article answer?
- **Solution**: {{solution}} — the answer or process
- **Related Articles**: {{related}} (optional)

## Article Structure

### Title
Clear, search-friendly title that matches how people would search for this topic.

### Summary
1-2 sentence overview that answers the question immediately.

### Prerequisites (if applicable)
What the reader needs before following these steps.

### Step-by-Step Solution
Numbered steps with:
- Clear action for each step
- Expected result after each step
- Screenshots or code examples where helpful

### Troubleshooting
Common issues and their fixes in "If X, then Y" format.

### Related Articles
Links to related topics.

## Rules
- Lead with the answer, not the background
- Use headers and bullet points for scannability
- Include search keywords naturally
- Test that steps actually work before publishing`,
  },
  {
    id: "avo-s-020",
    name: "Presentation Outline Creator",
    slug: "presentation-outline-creator",
    description:
      "Creates structured presentation outlines with slide-by-slide content, speaker notes, visual suggestions, and timing for any presentation type.",
    category: "productivity",
    tags: ["presentations", "communication", "planning", "cross-functional"],
    hoursSaved: 2,
    authorId: "avo-u-091",
    tier: "solid",
    usagePattern: "steady-growth",
    content: `# Presentation Outline Creator

Create a structured presentation outline with content and speaker notes.

## Inputs
- **Topic**: {{topic}}
- **Audience**: {{audience}} (executives / team / customers / conference)
- **Duration**: {{duration}} minutes
- **Goal**: {{goal}} — what should the audience do/feel/know after?
- **Key Messages**: {{messages}} — 3-5 points to convey
- **Format**: {{format}} (keynote / workshop / sales pitch / internal update)

## Outline Structure

For each slide:
- **Slide Title**: Concise, action-oriented
- **Key Point**: The one thing this slide communicates
- **Content**: Bullet points or talking points
- **Visual**: Suggested chart, image, or diagram type
- **Speaker Notes**: What to say (not what's on the slide)
- **Time**: Minutes allocated

## Structure Guidelines
- Open with a hook (story, statistic, question)
- One idea per slide
- Data slides need a "so what" headline
- End with a clear call to action
- Include transition phrases between sections
- Total slides: roughly 1 per 2 minutes of talk time`,
  },

  // ===== SOLID TIER — TAIL-OFF (5) =====
  {
    id: "avo-s-021",
    name: "Incident Response Runbook",
    slug: "incident-response-runbook",
    description:
      "Generates structured incident response runbooks with severity classification, escalation procedures, communication templates, and post-mortem triggers.",
    category: "wiring",
    tags: ["engineering", "incidents", "devops", "runbooks"],
    hoursSaved: 3,
    authorId: "avo-u-003",
    tier: "solid",
    usagePattern: "tail-off",
    content: `# Incident Response Runbook

Create a structured incident response runbook for a specific system or failure mode.

## Inputs
- **System/Service**: {{system}}
- **Incident Type**: {{type}} (outage / degradation / security / data loss)
- **Symptoms**: {{symptoms}} — how this incident manifests
- **Impact**: {{impact}} — what's affected (users, revenue, data)

## Runbook Structure

### 1. Severity Classification
- SEV1: Complete outage, >50% users affected → page on-call + engineering lead
- SEV2: Major degradation, 10-50% users → page on-call
- SEV3: Minor degradation, <10% users → Slack alert
- SEV4: No user impact, monitoring alert → next business day

### 2. Immediate Response (first 5 minutes)
- Verify the incident is real (not a false alarm)
- Assess blast radius and severity
- Open incident channel in Slack
- Assign roles: Incident Commander, Communications, Technical Lead

### 3. Investigation & Mitigation
Step-by-step diagnostic procedures specific to this incident type.
- What to check first
- Common root causes and their fixes
- Rollback procedures if applicable
- When to escalate vs. continue investigating

### 4. Communication Templates
- Internal status update template
- Customer-facing status page update
- Executive escalation message

### 5. Resolution & Recovery
- Verification steps to confirm resolution
- Post-mortem trigger criteria
- Follow-up action items template`,
  },
  {
    id: "avo-s-022",
    name: "Objection Handler",
    slug: "objection-handler",
    description:
      "Provides structured responses to common sales objections using the feel-felt-found framework with evidence, case studies, and pivot strategies.",
    category: "productivity",
    tags: ["sales", "objections", "negotiation", "training"],
    hoursSaved: 1,
    authorId: "avo-u-021",
    tier: "solid",
    usagePattern: "tail-off",
    content: `# Objection Handler

Prepare thoughtful responses to sales objections.

## Inputs
- **Objection**: {{objection}} — what the prospect said
- **Context**: {{context}} — where in the sales cycle, what product
- **Prospect Profile**: {{prospect}} — company size, industry, decision-maker level

## Response Framework

### 1. Acknowledge (don't dismiss)
"I understand your concern about {{objection}}. That's a fair point."

### 2. Clarify (understand the real concern)
Ask a follow-up question to understand the root concern behind the stated objection.

### 3. Respond with Evidence
- Relevant data point or statistic
- Customer story that addresses this exact concern
- Comparison or analogy that reframes the objection

### 4. Pivot to Value
Redirect to a key value proposition that outweighs the concern.

### 5. Check
"Does that address your concern, or is there another aspect I should dig into?"

## Common Objection Patterns
- **Price**: Reframe as ROI, show cost of inaction
- **Timing**: Create urgency, show quick wins
- **Competition**: Differentiate on what matters to them
- **Authority**: Help them build the internal business case
- **Need**: Quantify the problem they may be underestimating`,
  },
  {
    id: "avo-s-023",
    name: "SOP Template Generator",
    slug: "sop-template-generator",
    description:
      "Generates standard operating procedure templates with role assignments, approval workflows, revision tracking, and compliance requirements.",
    category: "wiring",
    tags: ["operations", "sop", "procedures", "compliance"],
    hoursSaved: 2,
    authorId: "avo-u-048",
    tier: "solid",
    usagePattern: "tail-off",
    content: `# SOP Template Generator

Create a Standard Operating Procedure document from process description.

## Inputs
- **Process Name**: {{name}}
- **Department**: {{department}}
- **Frequency**: {{frequency}} (daily / weekly / monthly / as-needed)
- **Roles Involved**: {{roles}}
- **Regulatory Requirements**: {{regulations}} (if any)

## SOP Structure

### Header
- SOP Number, Version, Effective Date
- Department, Owner, Approver
- Review Frequency (annual minimum)

### 1. Purpose & Scope
Why this SOP exists and what it covers/excludes.

### 2. Definitions
Key terms and abbreviations used.

### 3. Responsibilities
RACI matrix: Responsible, Accountable, Consulted, Informed for each step.

### 4. Procedure
Numbered steps with decision points, quality checks, and exception handling.

### 5. Records & Documentation
What records to keep, where to store them, retention period.

### 6. Revision History
| Version | Date | Author | Changes |`,
  },
  {
    id: "avo-s-024",
    name: "Onboarding Checklist Creator",
    slug: "onboarding-checklist-creator",
    description:
      "Creates comprehensive onboarding checklists for new hires with day-by-day activities, tool access setup, training schedule, and buddy assignments.",
    category: "wiring",
    tags: ["hr", "onboarding", "new-hire", "checklist"],
    hoursSaved: 2,
    authorId: "avo-u-068",
    tier: "solid",
    usagePattern: "tail-off",
    content: `# Onboarding Checklist Creator

Create a comprehensive onboarding plan for a new hire.

## Inputs
- **New Hire Name**: {{name}}
- **Role**: {{role}}
- **Department**: {{department}}
- **Start Date**: {{start_date}}
- **Manager**: {{manager}}
- **Buddy/Mentor**: {{buddy}}
- **Tools Needed**: {{tools}} (Slack, GitHub, Figma, etc.)

## Checklist Structure

### Pre-Day 1 (Manager + IT)
- [ ] Laptop and equipment ordered
- [ ] Accounts created (email, Slack, tool-specific)
- [ ] Welcome email sent with first-day logistics
- [ ] Buddy assigned and notified
- [ ] First week calendar pre-populated

### Day 1: Welcome & Setup
- [ ] Office tour / virtual onboarding session
- [ ] IT setup verification
- [ ] Benefits enrollment overview
- [ ] Meet the team lunch/coffee
- [ ] Review team norms and communication preferences

### Week 1: Learn & Observe
- [ ] 1:1 with manager (expectations, 30-60-90 goals)
- [ ] Shadow key meetings
- [ ] Complete required compliance training
- [ ] Review team documentation and wikis
- [ ] First small task assignment

### Month 1: Contribute
- [ ] Complete all required training
- [ ] First project or deliverable
- [ ] 1:1s with key cross-functional partners
- [ ] 30-day check-in with manager

### Month 2-3: Ramp
- [ ] Increasing responsibility and ownership
- [ ] 60-day and 90-day check-ins
- [ ] Feedback survey for onboarding improvement`,
  },
  {
    id: "avo-s-025",
    name: "Account Research Brief",
    slug: "account-research-brief",
    description:
      "Compiles comprehensive account research briefs with company overview, tech stack analysis, key stakeholders, and engagement recommendations.",
    category: "productivity",
    tags: ["sales", "research", "account-management", "preparation"],
    hoursSaved: 2,
    authorId: "avo-u-021",
    tier: "solid",
    usagePattern: "tail-off",
    content: `# Account Research Brief

Compile a comprehensive research brief for a target account.

## Inputs
- **Company**: {{company}}
- **Industry**: {{industry}}
- **Our Objective**: {{objective}} (new business / expansion / renewal / win-back)

## Brief Sections

### Company Overview
- What they do, founded when, HQ location
- Revenue, employee count, funding stage
- Recent news (last 6 months): acquisitions, leadership changes, product launches

### Market Position
- Key competitors and differentiation
- Market share and growth trajectory
- Industry trends affecting them

### Technology Landscape
- Known tech stack (from job postings, press releases, BuiltWith)
- Current solutions in our space
- Integration requirements

### Key Stakeholders
- Decision makers (title, LinkedIn, background)
- Champions and influencers
- Potential blockers

### Engagement Strategy
- Recommended entry point
- Value proposition tailored to their situation
- Relevant case studies from similar companies
- Potential objections and responses`,
  },

  // ===== AVERAGE TIER (15) — flat usage =====
  {
    id: "avo-s-026",
    name: "Database Query Optimizer",
    slug: "database-query-optimizer",
    description:
      "Analyzes SQL queries for performance issues and suggests optimizations including indexing strategies, query rewrites, and execution plan improvements.",
    category: "productivity",
    tags: ["database", "sql", "performance", "engineering"],
    hoursSaved: 2,
    authorId: "avo-u-001",
    tier: "average",
    usagePattern: "flat",
    content: `# Database Query Optimizer

Analyze SQL queries and suggest performance optimizations.

## Inputs
- **Query**: {{query}} (the SQL to optimize)
- **Database**: {{database}} (PostgreSQL / MySQL / SQL Server)
- **Table Sizes**: {{sizes}} (approximate row counts)
- **Current Indexes**: {{indexes}} (existing index definitions)

## Analysis
1. Identify full table scans and missing index opportunities
2. Check for N+1 query patterns
3. Evaluate JOIN order and type
4. Assess subquery vs. CTE vs. JOIN alternatives
5. Review WHERE clause sargability
6. Check for implicit type conversions

## Output
- Optimized query with explanation of changes
- Recommended indexes with CREATE INDEX statements
- Expected performance improvement estimate
- Trade-offs (storage, write performance)`,
  },
  {
    id: "avo-s-027",
    name: "Competitive Analysis Framework",
    slug: "competitive-analysis-framework",
    description:
      "Creates structured competitive analysis comparing features, pricing, positioning, and market perception across competitors.",
    category: "productivity",
    tags: ["marketing", "competitive-intelligence", "strategy", "analysis"],
    hoursSaved: 3,
    authorId: "avo-u-038",
    tier: "average",
    usagePattern: "flat",
    content: `# Competitive Analysis Framework

Create a structured competitive analysis.

## Inputs
- **Our Product**: {{product}}
- **Competitors**: {{competitors}} (2-5 competitors to analyze)
- **Analysis Focus**: {{focus}} (features / pricing / positioning / all)

## Analysis Structure

### Feature Comparison Matrix
| Feature | Us | Competitor A | Competitor B |
Rate: Strong / Adequate / Weak / Missing

### Pricing Comparison
- Pricing model (per seat, usage, flat)
- Entry price point and enterprise pricing
- Free tier availability

### Positioning Analysis
- Target audience for each
- Key messaging and value propositions
- Strengths to leverage, weaknesses to exploit

### Win/Loss Insights
- When we win against each competitor and why
- When we lose and common patterns
- Recommended battle cards for sales team`,
  },
  {
    id: "avo-s-028",
    name: "Win/Loss Analysis Template",
    slug: "win-loss-analysis-template",
    description:
      "Structures win/loss analysis interviews and reports to identify patterns in why deals are won or lost.",
    category: "productivity",
    tags: ["sales", "analysis", "strategy", "pipeline"],
    hoursSaved: 2,
    authorId: "avo-u-022",
    tier: "average",
    usagePattern: "flat",
    content: `# Win/Loss Analysis Template

Structure a win/loss analysis for a closed opportunity.

## Inputs
- **Deal**: {{deal_name}} — customer and deal size
- **Outcome**: {{outcome}} (won / lost / no decision)
- **Competitors**: {{competitors}} (if any)
- **Sales Cycle Length**: {{cycle_length}}
- **Decision Makers**: {{stakeholders}}

## Analysis Sections

### Deal Summary
Key facts: size, timeline, product fit, competitive landscape.

### Decision Factors
What drove the decision? Rank by importance:
- Product capabilities
- Price/value perception
- Relationships and trust
- Implementation timeline
- Risk perception

### What Worked / What Didn't
Specific moments that helped or hurt the deal.

### Patterns & Recommendations
How this informs future deals of similar profile.`,
  },
  {
    id: "avo-s-029",
    name: "Regulatory Change Monitor",
    slug: "regulatory-change-monitor",
    description:
      "Summarizes regulatory changes and assesses their impact on business operations, compliance requirements, and necessary policy updates.",
    category: "productivity",
    tags: ["legal", "compliance", "regulatory", "risk"],
    hoursSaved: 2,
    authorId: "avo-u-086",
    tier: "average",
    usagePattern: "flat",
    content: `# Regulatory Change Monitor

Analyze a regulatory change and assess business impact.

## Inputs
- **Regulation**: {{regulation}} (name, jurisdiction, effective date)
- **Change Summary**: {{change}} — what changed
- **Our Business Areas**: {{areas}} — which parts of the business are affected

## Assessment

### Change Overview
Plain-language summary of what changed and why it matters.

### Impact Assessment
- **Affected Operations**: Which processes, products, or services are impacted
- **Compliance Gap**: What we currently do vs. what's now required
- **Timeline**: When we need to be compliant
- **Risk Level**: HIGH / MEDIUM / LOW

### Required Actions
Prioritized list of changes needed with owners and deadlines.

### Cost Estimate
Rough estimate of compliance costs (legal, technical, process changes).`,
  },
  {
    id: "avo-s-030",
    name: "Vendor Evaluation Matrix",
    slug: "vendor-evaluation-matrix",
    description:
      "Creates weighted evaluation matrices for vendor selection with scoring criteria, cost analysis, and risk assessment across candidates.",
    category: "productivity",
    tags: ["operations", "procurement", "vendor-management", "evaluation"],
    hoursSaved: 2,
    authorId: "avo-u-048",
    tier: "average",
    usagePattern: "flat",
    content: `# Vendor Evaluation Matrix

Create a structured vendor evaluation and comparison.

## Inputs
- **Category**: {{category}} — what we're buying
- **Vendors**: {{vendors}} (2-5 vendors to evaluate)
- **Requirements**: {{requirements}} — must-have and nice-to-have features
- **Budget**: {{budget}}
- **Decision Timeline**: {{timeline}}

## Evaluation Framework

### Scoring Criteria (weighted)
| Criteria | Weight | Vendor A | Vendor B | Vendor C |
- Functionality fit (30%)
- Price/TCO (25%)
- Integration capability (15%)
- Support & SLA (15%)
- Security & compliance (10%)
- Vendor stability (5%)

### Cost Comparison
- Upfront costs, recurring costs, implementation costs
- Total cost of ownership over 3 years
- Hidden costs (training, migration, customization)

### Risk Assessment
For each vendor: key risks and mitigation strategies.

### Recommendation
Top choice with justification and negotiation strategy.`,
  },

  // ===== AVERAGE TIER continued (10 more) — flat usage =====
  {
    id: "avo-s-031",
    name: "Interview Question Generator",
    slug: "interview-question-generator",
    description:
      "Generates role-specific interview questions with evaluation criteria, follow-up probes, and scoring rubrics for consistent hiring.",
    category: "productivity",
    tags: ["hr", "hiring", "interviews", "assessment"],
    hoursSaved: 1,
    authorId: "avo-u-068",
    tier: "average",
    usagePattern: "flat",
    content: `# Interview Question Generator

Generate structured interview questions for a specific role.

## Inputs
- **Role**: {{role}}
- **Level**: {{level}} (junior / mid / senior / lead)
- **Interview Stage**: {{stage}} (phone screen / technical / behavioral / final)
- **Key Competencies**: {{competencies}} — what to assess

## Question Categories
1. **Behavioral**: Past experience using STAR format prompts
2. **Situational**: Hypothetical scenarios relevant to the role
3. **Technical**: Skills-based questions with assessment criteria
4. **Culture Fit**: Values alignment questions

## For Each Question
- The question itself
- What good/great/concerning answers look like
- Follow-up probes to dig deeper
- Red flags to watch for`,
  },
  {
    id: "avo-s-032",
    name: "Compensation Benchmarking Tool",
    slug: "compensation-benchmarking-tool",
    description:
      "Analyzes compensation data against market benchmarks, identifies pay equity gaps, and recommends adjustments with budget impact analysis.",
    category: "productivity",
    tags: ["finance", "compensation", "benchmarking", "hr"],
    hoursSaved: 2,
    authorId: "avo-u-076",
    tier: "average",
    usagePattern: "flat",
    content: `# Compensation Benchmarking Tool

Analyze compensation against market data and identify adjustments needed.

## Inputs
- **Role**: {{role}}
- **Level**: {{level}}
- **Location**: {{location}}
- **Current Compensation**: {{current}} (base, bonus, equity)
- **Market Data Source**: {{source}} (Levels.fyi, Glassdoor, Radford, etc.)

## Analysis
- Market positioning (percentile ranking)
- Peer comparison within the company
- Pay equity analysis across demographics
- Total compensation package comparison (not just base)
- Recommended adjustment with budget impact
- Retention risk assessment based on market gap`,
  },
  {
    id: "avo-s-033",
    name: "Churn Risk Analyzer",
    slug: "churn-risk-analyzer",
    description:
      "Analyzes customer behavior signals to predict churn risk and recommends proactive retention strategies.",
    category: "productivity",
    tags: ["customer-success", "churn", "retention", "analytics"],
    hoursSaved: 2,
    authorId: "avo-u-058",
    tier: "average",
    usagePattern: "flat",
    content: `# Churn Risk Analyzer

Analyze customer signals and predict churn risk.

## Inputs
- **Customer**: {{customer}}
- **Usage Trends**: {{usage}} (declining / stable / growing)
- **Support History**: {{support}} (recent tickets, escalations)
- **Engagement**: {{engagement}} (meeting attendance, response times)
- **Contract Details**: {{contract}} (renewal date, terms)

## Risk Assessment
- Overall risk score: LOW / MEDIUM / HIGH / CRITICAL
- Contributing factors ranked by impact
- Timeline: when churn is most likely
- Revenue at risk

## Retention Strategy
- Immediate actions (this week)
- Short-term plan (this month)
- Long-term relationship investment
- Escalation triggers`,
  },
  {
    id: "avo-s-034",
    name: "Architecture Decision Record Writer",
    slug: "architecture-decision-record-writer",
    description:
      "Creates structured Architecture Decision Records (ADRs) documenting technical decisions with context, options considered, and trade-offs.",
    category: "productivity",
    tags: ["engineering", "architecture", "documentation", "decisions"],
    hoursSaved: 2,
    authorId: "avo-u-001",
    tier: "average",
    usagePattern: "flat",
    content: `# Architecture Decision Record Writer

Create a structured ADR for a technical decision.

## Inputs
- **Decision Title**: {{title}}
- **Context**: {{context}} — why this decision is needed
- **Options Considered**: {{options}} — alternatives evaluated
- **Decision**: {{decision}} — what was chosen and why

## ADR Template
### Status: {{status}} (proposed / accepted / deprecated / superseded)
### Context
What forces are at play? What problem are we solving?
### Decision
What is the change we're proposing or have agreed to?
### Options Considered
For each option: description, pros, cons, estimated effort.
### Consequences
What becomes easier or harder as a result of this decision?
### Follow-up Actions
What needs to happen to implement this decision?`,
  },
  {
    id: "avo-s-035",
    name: "Brand Voice Style Guide",
    slug: "brand-voice-style-guide",
    description:
      "Defines brand voice characteristics, tone variations, do's and don'ts, and provides before/after examples for consistent brand communication.",
    category: "productivity",
    tags: ["marketing", "branding", "content", "style-guide"],
    hoursSaved: 2,
    authorId: "avo-u-036",
    tier: "average",
    usagePattern: "flat",
    content: `# Brand Voice Style Guide

Define or refine a brand voice with actionable guidelines.

## Inputs
- **Brand**: {{brand}}
- **Target Audience**: {{audience}}
- **Brand Values**: {{values}}
- **Current Voice Issues**: {{issues}} (inconsistencies, tone problems)

## Guide Structure
### Voice Characteristics
3-4 defining traits (e.g., "confident but not arrogant", "helpful but not hand-holding").

### Tone Variations
How voice shifts across contexts: marketing, support, internal, social media.

### Do's and Don'ts
Specific examples of what to write and what to avoid.

### Vocabulary
- Preferred terms vs. terms to avoid
- Industry jargon policy
- Inclusive language guidelines

### Before/After Examples
5-6 real-world rewrites showing the voice in action.`,
  },
  {
    id: "avo-s-036",
    name: "Email Campaign A/B Tester",
    slug: "email-campaign-ab-tester",
    description:
      "Designs A/B test variants for email campaigns with hypothesis, test variables, sample size requirements, and analysis framework.",
    category: "productivity",
    tags: ["marketing", "email", "ab-testing", "optimization"],
    hoursSaved: 1,
    authorId: "avo-u-038",
    tier: "average",
    usagePattern: "flat",
    content: `# Email Campaign A/B Tester

Design an A/B test for an email campaign.

## Inputs
- **Campaign**: {{campaign}}
- **Current Performance**: {{metrics}} (open rate, CTR, conversion rate)
- **Hypothesis**: {{hypothesis}} — what you think will improve performance
- **Test Variable**: {{variable}} (subject line / CTA / send time / content / design)

## Test Design
- Control (A) and variant (B) descriptions
- Minimum sample size for statistical significance
- Test duration recommendation
- Success metric and target improvement
- Variant copy/content for both versions

## Analysis Framework
- Statistical significance threshold (95%)
- Expected lift to justify implementation
- Segments to analyze (by role, engagement level, etc.)
- Next test recommendation based on results`,
  },
  {
    id: "avo-s-037",
    name: "NDA Generator",
    slug: "nda-generator",
    description:
      "Generates customized non-disclosure agreements with appropriate scope, duration, exclusions, and remedies based on the business context.",
    category: "productivity",
    tags: ["legal", "nda", "contracts", "confidentiality"],
    hoursSaved: 1,
    authorId: "avo-u-087",
    tier: "average",
    usagePattern: "flat",
    content: `# NDA Generator

Generate a customized NDA based on business context.

## Inputs
- **Type**: {{type}} (mutual / one-way)
- **Parties**: {{parties}}
- **Purpose**: {{purpose}} — why confidential info is being shared
- **Duration**: {{duration}} (1 year / 2 years / perpetual for trade secrets)
- **Jurisdiction**: {{jurisdiction}}

## NDA Sections
1. Definition of Confidential Information (broad but clear)
2. Obligations of Receiving Party
3. Exclusions (public info, independent development, prior knowledge)
4. Term and Termination
5. Return/Destruction of Materials
6. Remedies (injunctive relief clause)
7. General Provisions (governing law, entire agreement, assignment)

## Output
Complete NDA draft ready for legal review, with bracketed notes where customization is needed.`,
  },
  {
    id: "avo-s-038",
    name: "Capacity Planning Calculator",
    slug: "capacity-planning-calculator",
    description:
      "Calculates team capacity for sprint or project planning based on team size, availability, velocity, and planned time off.",
    category: "productivity",
    tags: ["operations", "planning", "capacity", "resource-management"],
    hoursSaved: 1,
    authorId: "avo-u-049",
    tier: "average",
    usagePattern: "flat",
    content: `# Capacity Planning Calculator

Calculate team capacity for upcoming work period.

## Inputs
- **Team Members**: {{team}} (names and roles)
- **Period**: {{period}} (sprint dates or project timeline)
- **Planned Time Off**: {{pto}} (vacations, holidays, training)
- **Historical Velocity**: {{velocity}} (story points or tasks per sprint)
- **Recurring Commitments**: {{commitments}} (meetings, on-call, support rotation)

## Calculations
- Available person-days per team member
- Total team capacity (accounting for meetings, PTO, on-call)
- Recommended sprint commitment (80% of theoretical capacity)
- Risk buffer for unplanned work (15-20%)
- Comparison to last 3 sprints' actual throughput

## Output
- Capacity summary table
- Recommended commitment level
- Risk factors and mitigation suggestions`,
  },
  {
    id: "avo-s-039",
    name: "Employee Survey Analyzer",
    slug: "employee-survey-analyzer",
    description:
      "Analyzes employee engagement survey results, identifies themes in open-ended responses, and recommends action items.",
    category: "productivity",
    tags: ["hr", "engagement", "surveys", "analysis"],
    hoursSaved: 2,
    authorId: "avo-u-069",
    tier: "average",
    usagePattern: "flat",
    content: `# Employee Survey Analyzer

Analyze survey results and extract actionable insights.

## Inputs
- **Survey Data**: {{data}} (scores and open-ended responses)
- **Previous Survey**: {{previous}} (for trend comparison)
- **Response Rate**: {{rate}}
- **Department Breakdown**: {{departments}} (optional)

## Analysis
- Overall engagement score and trend
- Category scores with benchmarks
- Top 3 strengths and top 3 areas for improvement
- Theme analysis from open-ended responses
- Department-level comparisons
- Correlation analysis (what drives engagement most?)

## Recommendations
- Quick wins (address this quarter)
- Strategic initiatives (address this half)
- Communication plan for sharing results with the team`,
  },
  {
    id: "avo-s-040",
    name: "Invoice Processing Assistant",
    slug: "invoice-processing-assistant",
    description:
      "Extracts key information from invoices, validates against PO data, flags discrepancies, and prepares approval routing.",
    category: "productivity",
    tags: ["finance", "invoices", "accounts-payable", "automation"],
    hoursSaved: 1,
    authorId: "avo-u-077",
    tier: "average",
    usagePattern: "flat",
    content: `# Invoice Processing Assistant

Extract and validate invoice information for processing.

## Inputs
- **Invoice**: {{invoice}} (text or image of invoice)
- **Purchase Order**: {{po}} (associated PO if available)
- **Vendor Record**: {{vendor}} (expected vendor details)

## Processing Steps
1. Extract: vendor name, invoice number, date, line items, amounts, tax, total
2. Validate: match against PO (quantities, unit prices, totals)
3. Flag discrepancies: price variances, quantity mismatches, missing PO
4. Calculate: tax verification, payment terms, early payment discount eligibility
5. Route: determine approval authority based on amount thresholds

## Output
- Structured invoice data (JSON)
- Validation status: APPROVED / NEEDS REVIEW / REJECTED
- Discrepancies with details
- Recommended approval routing`,
  },

  // ===== NEW/NICHE TIER (10) — new-arrival usage =====
  {
    id: "avo-s-041",
    name: "CI/CD Pipeline Debugger",
    slug: "cicd-pipeline-debugger",
    description:
      "Analyzes CI/CD pipeline failures from logs and configuration, identifies root causes, and suggests fixes for common build and deployment issues.",
    category: "code",
    tags: ["engineering", "ci-cd", "devops", "debugging"],
    hoursSaved: 2,
    authorId: "avo-u-001",
    tier: "new",
    usagePattern: "new-arrival",
    content: `# CI/CD Pipeline Debugger

Analyze pipeline failure logs and suggest fixes.

## Inputs
- **Pipeline**: {{pipeline}} (GitHub Actions / GitLab CI / Jenkins / CircleCI)
- **Error Log**: {{logs}} — paste the failure output
- **Pipeline Config**: {{config}} (workflow YAML or Jenkinsfile)

## Analysis
1. Parse error messages and exit codes
2. Identify failure stage (build / test / deploy / post-deploy)
3. Check for common causes: dependency issues, env vars, permissions, resource limits
4. Suggest specific fix with code changes
5. Recommend preventive measures`,
  },
  {
    id: "avo-s-042",
    name: "Security Vulnerability Scanner",
    slug: "security-vulnerability-scanner",
    description:
      "Reviews code for OWASP Top 10 vulnerabilities, identifies insecure patterns, and provides remediation guidance with severity ratings.",
    category: "code",
    tags: ["engineering", "security", "owasp", "code-review"],
    hoursSaved: 3,
    authorId: "avo-u-001",
    tier: "new",
    usagePattern: "new-arrival",
    content: `# Security Vulnerability Scanner

Scan code for security vulnerabilities and suggest fixes.

## Inputs
- **Code**: {{code}} — code to analyze
- **Language**: {{language}}
- **Framework**: {{framework}}
- **Focus Areas**: {{focus}} (auth / input validation / data exposure / all)

## Scan Checklist (OWASP Top 10)
1. Injection (SQL, NoSQL, OS command, LDAP)
2. Broken Authentication
3. Sensitive Data Exposure
4. XML External Entities (XXE)
5. Broken Access Control
6. Security Misconfiguration
7. Cross-Site Scripting (XSS)
8. Insecure Deserialization
9. Using Components with Known Vulnerabilities
10. Insufficient Logging & Monitoring

## Output
For each finding: severity (CRITICAL/HIGH/MEDIUM/LOW), vulnerable code, fix, and CWE reference.`,
  },
  {
    id: "avo-s-043",
    name: "Test Coverage Analyzer",
    slug: "test-coverage-analyzer",
    description:
      "Analyzes test suites for coverage gaps, identifies untested code paths, and generates test case suggestions for critical business logic.",
    category: "code",
    tags: ["engineering", "testing", "coverage", "quality"],
    hoursSaved: 2,
    authorId: "avo-u-003",
    tier: "new",
    usagePattern: "new-arrival",
    content: `# Test Coverage Analyzer

Analyze test coverage and suggest missing test cases.

## Inputs
- **Source Code**: {{code}} — the code under test
- **Existing Tests**: {{tests}} — current test suite
- **Coverage Report**: {{coverage}} (optional — lcov or similar)

## Analysis
1. Identify untested functions and branches
2. Find edge cases not covered (null, empty, boundary values)
3. Check error path coverage
4. Assess integration test gaps
5. Prioritize missing tests by risk (business logic > utility functions)

## Output
- Coverage gap summary
- Prioritized list of suggested test cases with example code
- Estimated effort to reach target coverage`,
  },
  {
    id: "avo-s-044",
    name: "Migration Script Generator",
    slug: "migration-script-generator",
    description:
      "Generates database migration scripts with rollback procedures, data transformation logic, and safety checks for schema changes.",
    category: "code",
    tags: ["engineering", "database", "migrations", "devops"],
    hoursSaved: 3,
    authorId: "avo-u-003",
    tier: "new",
    usagePattern: "new-arrival",
    content: `# Migration Script Generator

Generate safe database migration scripts.

## Inputs
- **Database**: {{database}} (PostgreSQL / MySQL / SQLite)
- **Current Schema**: {{current}} — current table definitions
- **Target Schema**: {{target}} — desired table definitions
- **Data Considerations**: {{data}} — any data transformations needed

## Output
### Up Migration
- DDL statements in safe order (create before alter, alter before drop)
- Data migration DML if needed
- Index creation (concurrent where possible)

### Down Migration (Rollback)
- Reverse operations in correct order
- Data restoration approach

### Safety Checks
- Will this lock tables? For how long?
- Is this backwards compatible?
- Can this run without downtime?
- Recommended deployment strategy (blue-green, rolling, maintenance window)`,
  },
  {
    id: "avo-s-045",
    name: "Performance Budget Monitor",
    slug: "performance-budget-monitor",
    description:
      "Monitors web performance budgets by analyzing bundle sizes, load times, and Core Web Vitals against defined thresholds.",
    category: "wiring",
    tags: ["engineering", "performance", "web-vitals", "monitoring"],
    hoursSaved: 1,
    authorId: "avo-u-003",
    tier: "new",
    usagePattern: "new-arrival",
    content: `# Performance Budget Monitor

Check web performance against defined budgets.

## Inputs
- **URL**: {{url}} — page to analyze
- **Budgets**: {{budgets}} — performance thresholds
  - Total bundle size: {{max_bundle}} KB
  - LCP: {{max_lcp}} ms
  - FID: {{max_fid}} ms
  - CLS: {{max_cls}}
  - Time to Interactive: {{max_tti}} ms

## Checks
1. Bundle size analysis (JS, CSS, images, fonts)
2. Core Web Vitals measurement
3. Comparison against budget thresholds
4. Trend vs. previous measurements
5. Specific recommendations for violations

## Output
PASS / WARN / FAIL for each metric with specific optimization suggestions.`,
  },
  {
    id: "avo-s-046",
    name: "Market Research Synthesizer",
    slug: "market-research-synthesizer",
    description:
      "Synthesizes market research data from multiple sources into a cohesive report with key findings, trends, and strategic implications.",
    category: "wiring",
    tags: ["marketing", "research", "analysis", "strategy"],
    hoursSaved: 3,
    authorId: "avo-u-038",
    tier: "new",
    usagePattern: "new-arrival",
    content: `# Market Research Synthesizer

Synthesize research from multiple sources into a cohesive report.

## Inputs
- **Research Topic**: {{topic}}
- **Sources**: {{sources}} — data, reports, surveys, interviews to synthesize
- **Business Questions**: {{questions}} — what decisions this research should inform

## Report Structure
1. Executive Summary (key findings in 3-4 bullets)
2. Market Size & Growth (TAM, SAM, SOM with sources)
3. Key Trends (3-5 trends with supporting data)
4. Customer Insights (segments, needs, behaviors)
5. Competitive Landscape (map and positioning)
6. Strategic Implications (what this means for us)
7. Recommended Next Steps

## Rules
- Cite sources for all data points
- Flag conflicting data and explain which source is more reliable
- Distinguish between facts and inferences`,
  },
  {
    id: "avo-s-047",
    name: "Pipeline Forecast Assistant",
    slug: "pipeline-forecast-assistant",
    description:
      "Analyzes sales pipeline data to generate weighted forecasts, identify deal risks, and recommend pipeline health improvements.",
    category: "wiring",
    tags: ["sales", "forecasting", "pipeline", "analytics"],
    hoursSaved: 2,
    authorId: "avo-u-023",
    tier: "new",
    usagePattern: "new-arrival",
    content: `# Pipeline Forecast Assistant

Analyze pipeline and generate a weighted forecast.

## Inputs
- **Pipeline Data**: {{pipeline}} — deals with stage, amount, close date, probability
- **Historical Win Rates**: {{win_rates}} — by stage, by rep, by deal size
- **Quarter Target**: {{target}}

## Analysis
1. Weighted pipeline by stage probability
2. Deals at risk (stale, pushed, no next steps)
3. Coverage ratio (pipeline / target)
4. Best case / commit / worst case scenarios
5. Gap analysis and recommended actions

## Output
- Forecast summary with confidence level
- Deal-by-deal risk assessment
- Pipeline health scorecard
- Recommended actions to close the gap`,
  },
  {
    id: "avo-s-048",
    name: "Compliance Checklist Builder",
    slug: "compliance-checklist-builder",
    description:
      "Generates compliance checklists for specific regulatory frameworks with control descriptions, evidence requirements, and audit preparation guidance.",
    category: "wiring",
    tags: ["legal", "compliance", "audit", "checklist"],
    hoursSaved: 2,
    authorId: "avo-u-088",
    tier: "new",
    usagePattern: "new-arrival",
    content: `# Compliance Checklist Builder

Generate a compliance checklist for a specific framework.

## Inputs
- **Framework**: {{framework}} (SOC2 / ISO 27001 / GDPR / HIPAA / PCI-DSS)
- **Scope**: {{scope}} — which parts of the business are in scope
- **Current State**: {{current}} — what controls are already in place

## Checklist Structure
For each control:
- Control ID and name
- Requirement description
- Current status: IN PLACE / PARTIAL / MISSING
- Evidence needed for audit
- Owner and deadline
- Implementation notes

## Output
Prioritized checklist sorted by risk level, with estimated effort for missing controls.`,
  },
  {
    id: "avo-s-049",
    name: "Incident Post-Mortem Writer",
    slug: "incident-post-mortem-writer",
    description:
      "Creates blameless post-mortem documents from incident details with timeline reconstruction, root cause analysis, and preventive action items.",
    category: "code",
    tags: ["engineering", "incidents", "post-mortem", "reliability"],
    hoursSaved: 2,
    authorId: "avo-u-005",
    tier: "new",
    usagePattern: "new-arrival",
    content: `# Incident Post-Mortem Writer

Create a blameless post-mortem document.

## Inputs
- **Incident**: {{incident}} — title and severity
- **Timeline**: {{timeline}} — key events with timestamps
- **Impact**: {{impact}} — users affected, duration, revenue impact
- **Root Cause**: {{root_cause}} — what caused the incident
- **Resolution**: {{resolution}} — how it was fixed

## Post-Mortem Structure
1. **Summary**: One paragraph overview
2. **Impact**: Quantified impact on users, revenue, SLAs
3. **Timeline**: Chronological event log
4. **Root Cause Analysis**: 5 Whys or fishbone analysis
5. **What Went Well**: Things that helped during response
6. **What Went Wrong**: Things that hindered response
7. **Action Items**: Preventive and detective controls with owners and deadlines
8. **Lessons Learned**: Key takeaways for the team

## Rules
- Blameless language — focus on systems, not individuals
- Every action item needs an owner and due date
- Include both technical fixes and process improvements`,
  },
  {
    id: "avo-s-050",
    name: "Customer Feedback Synthesizer",
    slug: "customer-feedback-synthesizer",
    description:
      "Aggregates and synthesizes customer feedback from multiple channels into themed insights with sentiment analysis and priority recommendations.",
    category: "productivity",
    tags: ["customer-success", "feedback", "analysis", "product"],
    hoursSaved: 2,
    authorId: "avo-u-061",
    tier: "new",
    usagePattern: "new-arrival",
    content: `# Customer Feedback Synthesizer

Synthesize customer feedback from multiple sources.

## Inputs
- **Feedback Sources**: {{sources}} (support tickets, NPS comments, reviews, interviews, social)
- **Time Period**: {{period}}
- **Product Area**: {{area}} (specific feature or "all")

## Analysis
1. Theme identification — group feedback into 5-8 major themes
2. Sentiment analysis per theme (positive / neutral / negative)
3. Frequency and volume per theme
4. Customer segment patterns (enterprise vs SMB, new vs tenured)
5. Trend direction (growing concern or improving)

## Output
- Top 5 themes ranked by impact and frequency
- Representative quotes for each theme
- Recommended product/process actions
- Metrics to track improvement`,
  },
];

// ============================================================================
// Helper Functions
// ============================================================================

function getSkillCreatedDate(skill: SkillDef): Date {
  switch (skill.usagePattern) {
    case "new-arrival":
      return new Date(NOW.getTime() - (14 + Math.floor(rand() * 7)) * 86400000);
    case "hockey-stick":
    case "steady-growth":
      return new Date(NOW.getTime() - (80 + Math.floor(rand() * 10)) * 86400000);
    case "tail-off":
      return new Date(NOW.getTime() - (70 + Math.floor(rand() * 15)) * 86400000);
    case "flat":
    default:
      return new Date(NOW.getTime() - (60 + Math.floor(rand() * 20)) * 86400000);
  }
}

function generateDailyUsage(pattern: UsagePattern): (dayIndex: number) => number {
  // dayIndex: 0 = 90 days ago, 89 = today
  switch (pattern) {
    case "hockey-stick":
      return (d) =>
        Math.max(0, Math.round((1 + Math.pow(d / 89, 2.5) * 30) * (0.6 + rand() * 0.8)));
    case "steady-growth":
      return (d) => Math.max(0, Math.round((3 + (d / 89) * 8) * (0.5 + rand())));
    case "tail-off":
      return (d) => Math.max(0, Math.round((10 - (d / 89) * 7) * (0.5 + rand())));
    case "flat":
      return () => Math.max(0, Math.round(3 * (0.3 + rand() * 1.4)));
    case "new-arrival":
      return (d) => (d < 70 ? 0 : Math.max(0, Math.round((3 + rand() * 4) * (0.5 + rand()))));
  }
}

function pickRandomUser(): UserDef {
  return USERS[Math.floor(rand() * USERS.length)];
}

function getRatingConfig(tier: QualityTier): { numRatings: number; ratingRange: [number, number] } {
  switch (tier) {
    case "winner":
      return { numRatings: 8 + Math.floor(rand() * 8), ratingRange: [4, 5] };
    case "solid":
      return { numRatings: 5 + Math.floor(rand() * 4), ratingRange: [3, 5] };
    case "average":
      return { numRatings: 2 + Math.floor(rand() * 3), ratingRange: [3, 4] };
    case "new":
      return { numRatings: Math.floor(rand() * 3), ratingRange: [3, 5] };
  }
}

const RATING_COMMENTS: Record<QualityTier, string[]> = {
  winner: [
    "This saved our team hours every sprint. Absolutely essential.",
    "Best skill on the platform. I use it daily.",
    "Game changer for our workflow. Highly recommend to everyone.",
    "Incredibly well-designed. The output quality is outstanding.",
    "Our entire team adopted this within a week. That says it all.",
    "This has become part of our standard process now.",
    "The attention to detail in the output format is perfect for our needs.",
    "Wish I had this years ago. Massive time saver.",
  ],
  solid: [
    "Really helpful tool. Gets the job done well.",
    "Solid skill, saves me about an hour each time I use it.",
    "Good output quality. A few tweaks needed sometimes but overall great.",
    "Reliable and consistent. I use it regularly.",
    "Nice work. Covers most of my use cases.",
    "Very practical. I'd recommend it to colleagues.",
  ],
  average: [
    "Works as expected. Does what it says.",
    "Decent tool for basic tasks.",
    "Useful for getting started quickly.",
    "Gets the job done. Nothing fancy but reliable.",
  ],
  new: [
    "Promising! Looking forward to seeing this develop.",
    "Interesting approach. Will try it more.",
  ],
};

function generateReviewCategories(tier: QualityTier) {
  const base = tier === "winner" ? 8 : tier === "solid" ? 7 : 5;
  return {
    quality: {
      score: Math.min(10, base + Math.floor(rand() * 3)),
      suggestions:
        tier === "winner"
          ? ["Consider adding error handling examples for edge cases"]
          : ["Add more detailed usage examples", "Include edge case handling"],
    },
    clarity: {
      score: Math.min(10, base + Math.floor(rand() * 3)),
      suggestions: ["Consider restructuring for progressive complexity"],
    },
    completeness: {
      score: Math.min(10, base + Math.floor(rand() * 2)),
      suggestions:
        tier === "winner"
          ? ["Already comprehensive — minor improvements possible"]
          : ["Add input validation section", "Include more output examples"],
    },
  };
}

function generateReviewSummary(skill: SkillDef): string {
  if (skill.tier === "winner") {
    return `Excellent skill with clear instructions and well-structured output format. ${skill.name} demonstrates strong prompt engineering practices with comprehensive coverage of key scenarios. Minor improvements possible in edge case documentation.`;
  }
  return `Solid skill with good structure. ${skill.name} covers the core use case well. Consider adding more examples and edge case handling to improve completeness and user experience.`;
}

// ============================================================================
// Main Seed Function
// ============================================================================

async function seed() {
  console.log("Seeding Avenue One demo dataset...\n");

  try {
    // Step 1: Clean up existing Avenue One data
    console.log("Cleaning up existing Avenue One data...");
    await db.execute(sql`DELETE FROM notifications WHERE tenant_id = ${TENANT_ID}`);
    await db.execute(sql`DELETE FROM review_decisions WHERE tenant_id = ${TENANT_ID}`);
    await db.execute(sql`DELETE FROM skill_reviews WHERE tenant_id = ${TENANT_ID}`);
    await db.execute(sql`DELETE FROM skill_messages WHERE tenant_id = ${TENANT_ID}`);
    await db.execute(sql`DELETE FROM skill_embeddings WHERE tenant_id = ${TENANT_ID}`);
    await db.execute(sql`DELETE FROM ratings WHERE tenant_id = ${TENANT_ID}`);
    await db.execute(sql`DELETE FROM usage_events WHERE tenant_id = ${TENANT_ID}`);
    await db.execute(sql`DELETE FROM api_keys WHERE tenant_id = ${TENANT_ID}`);
    await db.execute(sql`DELETE FROM audit_logs WHERE tenant_id = ${TENANT_ID}`);
    await db.execute(sql`DELETE FROM skill_versions WHERE tenant_id = ${TENANT_ID}`);
    await db.execute(sql`DELETE FROM skills WHERE tenant_id = ${TENANT_ID}`);
    await db.execute(sql`DELETE FROM notification_preferences WHERE tenant_id = ${TENANT_ID}`);
    await db.execute(sql`DELETE FROM site_settings WHERE tenant_id = ${TENANT_ID}`);
    await db.execute(sql`DELETE FROM users WHERE tenant_id = ${TENANT_ID}`);
    await db.execute(sql`DELETE FROM tenants WHERE id = ${TENANT_ID}`);
    console.log("  [+] Cleaned up existing data\n");

    // Step 2: Create tenant
    console.log("Creating Avenue One tenant...");
    await db.insert(tenants).values(TENANT);
    console.log("  [+] Avenue One tenant created\n");

    // Step 3: Insert users
    console.log("Creating 100 users...");
    const userValues = USERS.map((u) => ({
      id: u.id,
      tenantId: TENANT_ID,
      email: u.email,
      name: u.name,
    }));
    for (let i = 0; i < userValues.length; i += 25) {
      await db.insert(users).values(userValues.slice(i, i + 25));
    }
    console.log(`  [+] ${USERS.length} users created\n`);

    // Step 4: Insert skills
    console.log("Creating 50 skills...");
    for (const skill of SKILLS) {
      await db.insert(skills).values({
        id: skill.id,
        tenantId: TENANT_ID,
        name: skill.name,
        slug: skill.slug,
        description: skill.description,
        category: skill.category,
        tags: skill.tags,
        hoursSaved: skill.hoursSaved,
        content: skill.content,
        authorId: skill.authorId,
        status: "published",
        createdAt: getSkillCreatedDate(skill),
      });
    }
    console.log(`  [+] ${SKILLS.length} skills created\n`);

    // Step 5: Create skill versions
    console.log("Creating skill versions...");
    for (const skill of SKILLS) {
      const versionId = `${skill.id}-v1`;
      await db.insert(skillVersions).values({
        id: versionId,
        tenantId: TENANT_ID,
        skillId: skill.id,
        version: 1,
        contentUrl: `skills/${skill.id}/v1/content.md`,
        contentHash: `sha256-${skill.slug}-v1`,
        contentType: "text/markdown",
        name: skill.name,
        description: skill.description,
        createdBy: skill.authorId,
        metadata: { format: "markdown" },
      });
      await db.update(skills).set({ publishedVersionId: versionId }).where(eq(skills.id, skill.id));
    }
    console.log(`  [+] ${SKILLS.length} versions created\n`);

    // Step 6: Generate usage events
    console.log("Generating usage events...");
    let totalEvents = 0;
    const eventBatch: Array<{
      tenantId: string;
      toolName: string;
      skillId: string;
      userId: string;
      metadata: Record<string, unknown>;
      createdAt: Date;
    }> = [];

    for (const skill of SKILLS) {
      const dailyUsage = generateDailyUsage(skill.usagePattern);
      for (let dayOffset = 89; dayOffset >= 0; dayOffset--) {
        const dayDate = new Date(NOW.getTime() - dayOffset * 86400000);
        const count = dailyUsage(89 - dayOffset);
        for (let e = 0; e < count; e++) {
          const user = pickRandomUser();
          const eventTime = new Date(dayDate);
          eventTime.setHours(8 + Math.floor(rand() * 10));
          eventTime.setMinutes(Math.floor(rand() * 60));
          eventBatch.push({
            tenantId: TENANT_ID,
            toolName: skill.slug,
            skillId: skill.id,
            userId: user.id,
            metadata: { source: "seed" },
            createdAt: eventTime,
          });
          totalEvents++;
        }
      }
    }

    const BATCH_SIZE = 500;
    for (let i = 0; i < eventBatch.length; i += BATCH_SIZE) {
      await db.insert(usageEvents).values(eventBatch.slice(i, i + BATCH_SIZE));
      if (i % 5000 === 0 && i > 0) {
        console.log(`  ... ${i}/${eventBatch.length} events`);
      }
    }
    console.log(`  [+] ${totalEvents} usage events created\n`);

    // Step 7: Generate ratings
    console.log("Generating ratings...");
    let totalRatings = 0;
    for (const skill of SKILLS) {
      const { numRatings, ratingRange } = getRatingConfig(skill.tier);
      const raters = [...USERS]
        .filter((u) => u.id !== skill.authorId)
        .sort(() => rand() - 0.5)
        .slice(0, numRatings);

      for (const rater of raters) {
        const rating = ratingRange[0] + Math.floor(rand() * (ratingRange[1] - ratingRange[0] + 1));
        const comments = RATING_COMMENTS[skill.tier];
        const comment = comments[Math.floor(rand() * comments.length)];
        const hoursSavedEstimate = Math.max(1, skill.hoursSaved + Math.floor(rand() * 3) - 1);

        await db.insert(ratings).values({
          tenantId: TENANT_ID,
          skillId: skill.id,
          userId: rater.id,
          rating,
          comment,
          hoursSavedEstimate,
        });
        totalRatings++;
      }
    }
    console.log(`  [+] ${totalRatings} ratings created\n`);

    // Step 8: AI reviews for top skills
    console.log("Generating AI reviews...");
    let reviewCount = 0;
    for (const skill of SKILLS) {
      if (skill.tier === "winner" || (skill.tier === "solid" && rand() > 0.5)) {
        if (reviewCount >= 15) break;
        await db.insert(skillReviews).values({
          tenantId: TENANT_ID,
          skillId: skill.id,
          requestedBy: skill.authorId,
          categories: generateReviewCategories(skill.tier),
          summary: generateReviewSummary(skill),
          reviewedContentHash: `sha256-${skill.slug}-v1`,
          modelName: "claude-haiku-4-5-20251001",
          isVisible: true,
        });
        reviewCount++;
      }
    }
    console.log(`  [+] ${reviewCount} AI reviews created\n`);

    // Step 9: Notifications
    console.log("Generating notifications...");
    const notifUsers = USERS.slice(0, 20);
    for (const user of notifUsers) {
      await db.insert(notifications).values({
        tenantId: TENANT_ID,
        userId: user.id,
        type: "platform_update",
        title: "Welcome to EverySkill",
        message:
          "Your team's AI skill library is ready. Browse skills or create your own to start saving time.",
        actionUrl: "/skills",
        isRead: rand() > 0.3,
      });
    }
    console.log(`  [+] ${notifUsers.length} notifications created\n`);

    // Step 10: Update denormalized metrics
    console.log("Updating skill metrics...");
    for (const skill of SKILLS) {
      const countResult = await db.execute(
        sql`SELECT COUNT(*)::integer AS cnt FROM usage_events WHERE skill_id = ${skill.id}`
      );
      const ratingResult = await db.execute(
        sql`SELECT AVG(rating)::numeric(5,2) AS avg_r FROM ratings WHERE skill_id = ${skill.id}`
      );
      const rows1 = countResult as unknown as Record<string, unknown>[];
      const rows2 = ratingResult as unknown as Record<string, unknown>[];
      const totalUses = Number(rows1[0]?.cnt ?? 0);
      const avgRating = rows2[0]?.avg_r
        ? Math.round(parseFloat(String(rows2[0].avg_r)) * 100)
        : null;

      await db
        .update(skills)
        .set({ totalUses, averageRating: avgRating })
        .where(eq(skills.id, skill.id));
    }
    console.log("  [+] Metrics updated\n");

    console.log("========================================");
    console.log("Avenue One seed complete!");
    console.log(`  - 1 tenant (Avenue One)`);
    console.log(`  - ${USERS.length} users`);
    console.log(`  - ${SKILLS.length} skills`);
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
