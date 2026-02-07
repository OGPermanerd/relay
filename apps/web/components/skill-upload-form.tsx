"use client";

import { useActionState, useState, useRef, useEffect, useCallback } from "react";
import { checkAndCreateSkill, SkillFormState } from "@/app/actions/skills";
import { SimilarSkillsWarning } from "./similar-skills-warning";
import { SkillFileDropZone } from "./skill-file-drop-zone";
import type { ParsedSkillData } from "@/lib/skill-file-parser";

const initialState: SkillFormState = {};

export function SkillUploadForm() {
  const [state, formAction, isPending] = useActionState(checkAndCreateSkill, initialState);

  const [showWarning, setShowWarning] = useState(false);
  const [skipCheck, setSkipCheck] = useState(false);
  const [variationOfId, setVariationOfId] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Controlled field values so they survive useActionState re-renders
  const [fields, setFields] = useState({
    name: "",
    description: "",
    category: "",
    tags: "",
    usageInstructions: "",
    content: "",
    hoursSaved: "1",
  });

  const setField = useCallback((name: string, value: string) => {
    setFields((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleFileParsed = useCallback((data: ParsedSkillData) => {
    setFields((prev) => ({
      ...prev,
      name: data.name || prev.name,
      description: data.description || prev.description,
      category: data.category || prev.category,
      tags: data.tags || prev.tags,
      usageInstructions: data.usageInstructions || prev.usageInstructions,
      content: data.content || prev.content,
    }));
  }, []);

  // When server returns similar skills, show warning
  useEffect(() => {
    if (state.similarSkills && state.similarSkills.length > 0) {
      setShowWarning(true);
      setSkipCheck(false);
    }
  }, [state.similarSkills]);

  // When skipCheck is set to true, resubmit form via native form mechanism
  // so that Next.js redirect() works correctly
  useEffect(() => {
    if (skipCheck) {
      formRef.current?.requestSubmit();
    }
  }, [skipCheck]);

  // Handle "Publish Anyway" — set skip flag, which triggers resubmit via useEffect
  const handleProceed = () => {
    setShowWarning(false);
    setSkipCheck(true);
  };

  // Handle "Go Back" from warning
  const handleCancel = () => {
    setShowWarning(false);
    setSkipCheck(false);
    setVariationOfId(null);
  };

  // Handle "Create as Variation" — link as fork of matched skill
  const handleCreateVariation = (skillId: string) => {
    setVariationOfId(skillId);
    setShowWarning(false);
    setSkipCheck(true);
  };

  const errors = state.errors;
  const message = state.message;

  return (
    <form ref={formRef} action={formAction} className="space-y-6">
      {/* Hidden input for skip-check flag (used by "Publish Anyway") */}
      <input type="hidden" name="_skipCheck" value={skipCheck ? "true" : ""} />
      <input type="hidden" name="_variationOf" value={variationOfId || ""} />

      {message && <div className="rounded-md bg-red-50 p-4 text-red-700">{message}</div>}

      {showWarning && state.similarSkills && state.similarSkills.length > 0 && (
        <SimilarSkillsWarning
          similarSkills={state.similarSkills}
          onProceed={handleProceed}
          onCancel={handleCancel}
          onCreateVariation={handleCreateVariation}
          isPending={isPending}
        />
      )}

      {/* Form fields — always in DOM (hidden when warning shown) so FormData includes them */}
      <div className={showWarning ? "hidden" : "space-y-6"}>
        {/* File import drop zone */}
        <SkillFileDropZone onFileParsed={handleFileParsed} disabled={isPending} />

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
            value={fields.name}
            onChange={(e) => setField("name", e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
            placeholder="My Awesome Skill"
          />
          {errors?.name && <p className="mt-1 text-sm text-red-600">{errors.name[0]}</p>}
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
            value={fields.description}
            onChange={(e) => setField("description", e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
            placeholder="A brief description of what this skill does"
          />
          {errors?.description && (
            <p className="mt-1 text-sm text-red-600">{errors.description[0]}</p>
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
            value={fields.category}
            onChange={(e) => setField("category", e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
          >
            <option value="">Select a category</option>
            <option value="prompt">Prompt</option>
            <option value="workflow">Workflow</option>
            <option value="agent">Agent</option>
            <option value="mcp">MCP Server</option>
          </select>
          {errors?.category && <p className="mt-1 text-sm text-red-600">{errors.category[0]}</p>}
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
            value={fields.tags}
            onChange={(e) => setField("tags", e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
            placeholder="e.g. marketing, automation, analytics (comma-separated)"
          />
          <p className="mt-1 text-sm text-gray-500">Enter up to 10 tags, separated by commas</p>
          {errors?.tags && <p className="mt-1 text-sm text-red-600">{errors.tags[0]}</p>}
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
            value={fields.usageInstructions}
            onChange={(e) => setField("usageInstructions", e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
            placeholder="How to use this skill effectively..."
          />
          <p className="mt-1 text-sm text-gray-500">
            Optional: Provide guidance on how to use this skill
          </p>
          {errors?.usageInstructions && (
            <p className="mt-1 text-sm text-red-600">{errors.usageInstructions[0]}</p>
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
            value={fields.hoursSaved}
            onChange={(e) => setField("hoursSaved", e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
          />
          <p className="mt-1 text-sm text-gray-500">
            How many hours does this skill save each time it&apos;s used?
          </p>
          {errors?.hoursSaved && (
            <p className="mt-1 text-sm text-red-600">{errors.hoursSaved[0]}</p>
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
            value={fields.content}
            onChange={(e) => setField("content", e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
            placeholder="Paste your prompt, workflow configuration, or MCP server definition here..."
          />
          <p className="mt-1 text-sm text-gray-500">
            The actual content of your skill (prompt text, workflow JSON, agent config, etc.)
          </p>
          {errors?.content && <p className="mt-1 text-sm text-red-600">{errors.content[0]}</p>}
        </div>

        {/* Submit button */}
        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-md bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:bg-blue-300"
        >
          {isPending ? "Checking..." : "Create Skill"}
        </button>
      </div>
    </form>
  );
}
