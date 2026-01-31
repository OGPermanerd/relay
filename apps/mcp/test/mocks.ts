export interface MockSkill {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: "prompt" | "workflow" | "agent" | "mcp";
  content: string;
  hoursSaved: number;
  authorId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export const mockSkills: MockSkill[] = [
  {
    id: "skill-1",
    name: "Code Review Assistant",
    slug: "code-review",
    description: "Automated code review with best practices",
    category: "prompt",
    content: "# Code Review\n\nReview this code...",
    hoursSaved: 2,
    authorId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "skill-2",
    name: "API Documentation Generator",
    slug: "api-docs",
    description: "Generate OpenAPI docs from code",
    category: "workflow",
    content: "# API Docs\n\nGenerate docs...",
    hoursSaved: 4,
    authorId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "skill-3",
    name: "Test Writer",
    slug: "test-writer",
    description: "Generate comprehensive test cases",
    category: "prompt",
    content: "# Test Writer\n\nWrite tests...",
    hoursSaved: 3,
    authorId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];
