"use client";

import { useActionState } from "react";
import { createSkill, CreateSkillState } from "@/app/actions/skills";

const initialState: CreateSkillState = {};

export function SkillUploadForm() {
  const [state, formAction, isPending] = useActionState(createSkill, initialState);

  return (
    <form action={formAction} className="space-y-6">
      {state.message && (
        <div className="rounded-md bg-red-50 p-4 text-red-700">{state.message}</div>
      )}

      {/* Name field */}
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700">
          Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="name"
          name="name"
          required
          disabled={isPending}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
          placeholder="My Awesome Skill"
        />
        {state.errors?.name && <p className="mt-1 text-sm text-red-600">{state.errors.name[0]}</p>}
      </div>

      {/* Description field */}
      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700">
          Description <span className="text-red-500">*</span>
        </label>
        <textarea
          id="description"
          name="description"
          required
          disabled={isPending}
          rows={3}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
          placeholder="A brief description of what this skill does"
        />
        {state.errors?.description && (
          <p className="mt-1 text-sm text-red-600">{state.errors.description[0]}</p>
        )}
      </div>

      {/* Category field */}
      <div>
        <label htmlFor="category" className="block text-sm font-medium text-gray-700">
          Category <span className="text-red-500">*</span>
        </label>
        <select
          id="category"
          name="category"
          required
          disabled={isPending}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
        >
          <option value="">Select a category</option>
          <option value="prompt">Prompt</option>
          <option value="workflow">Workflow</option>
          <option value="agent">Agent</option>
          <option value="mcp">MCP Server</option>
        </select>
        {state.errors?.category && (
          <p className="mt-1 text-sm text-red-600">{state.errors.category[0]}</p>
        )}
      </div>

      {/* Tags field */}
      <div>
        <label htmlFor="tags" className="block text-sm font-medium text-gray-700">
          Tags
        </label>
        <input
          type="text"
          id="tags"
          name="tags"
          disabled={isPending}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
          placeholder="e.g. marketing, automation, analytics (comma-separated)"
        />
        <p className="mt-1 text-sm text-gray-500">Enter up to 10 tags, separated by commas</p>
        {state.errors?.tags && <p className="mt-1 text-sm text-red-600">{state.errors.tags[0]}</p>}
      </div>

      {/* Usage Instructions field */}
      <div>
        <label htmlFor="usageInstructions" className="block text-sm font-medium text-gray-700">
          Usage Instructions
        </label>
        <textarea
          id="usageInstructions"
          name="usageInstructions"
          disabled={isPending}
          rows={4}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
          placeholder="How to use this skill effectively..."
        />
        <p className="mt-1 text-sm text-gray-500">
          Optional: Provide guidance on how to use this skill
        </p>
        {state.errors?.usageInstructions && (
          <p className="mt-1 text-sm text-red-600">{state.errors.usageInstructions[0]}</p>
        )}
      </div>

      {/* Hours Saved field */}
      <div>
        <label htmlFor="hoursSaved" className="block text-sm font-medium text-gray-700">
          Estimated Hours Saved Per Use
        </label>
        <input
          type="number"
          id="hoursSaved"
          name="hoursSaved"
          disabled={isPending}
          min="0"
          max="1000"
          step="0.1"
          defaultValue="1"
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
        />
        <p className="mt-1 text-sm text-gray-500">
          How many hours does this skill save each time it's used?
        </p>
        {state.errors?.hoursSaved && (
          <p className="mt-1 text-sm text-red-600">{state.errors.hoursSaved[0]}</p>
        )}
      </div>

      {/* Content field */}
      <div>
        <label htmlFor="content" className="block text-sm font-medium text-gray-700">
          Skill Content <span className="text-red-500">*</span>
        </label>
        <textarea
          id="content"
          name="content"
          required
          disabled={isPending}
          rows={10}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
          placeholder="Paste your prompt, workflow configuration, or MCP server definition here..."
        />
        <p className="mt-1 text-sm text-gray-500">
          The actual content of your skill (prompt text, workflow JSON, agent config, etc.)
        </p>
        {state.errors?.content && (
          <p className="mt-1 text-sm text-red-600">{state.errors.content[0]}</p>
        )}
      </div>

      {/* Submit button */}
      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-md bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:bg-blue-300"
      >
        {isPending ? "Creating Skill..." : "Create Skill"}
      </button>
    </form>
  );
}
