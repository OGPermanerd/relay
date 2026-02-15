# Domain Pitfalls: AI Feedback, Training Data & Benchmarking

**Domain:** Adding feedback collection via PostToolUse hooks, training data management, token counting, LLM benchmarking, suggestion-to-fork pipelines, and smart frequency feedback to an existing MCP-based skill marketplace
**Project:** EverySkill (subsequent milestone after v3.0)
**Researched:** 2026-02-15
**Overall confidence:** HIGH (PostToolUse hook constraints verified from official Claude Code docs; Anthropic token counting API verified from official docs; benchmarking pitfalls verified from multiple sources; codebase analysis of existing hook infrastructure)

---

## Critical Pitfalls

Mistakes that cause data loss, privacy violations, user revolt, or require rewrites.

---

### Pitfall 1: PostToolUse Hooks Run Unsandboxed with Full User Permissions -- Feedback Payloads Can Leak Secrets

**What goes wrong:** The existing PostToolUse hook fires a curl command to `/api/track` with `skill_id`, `tool_name`, and `timestamp`. Extending this to capture richer feedback -- tool_input snippets, tool_output content, conversation context, error messages -- means the hook command now processes and transmits real user data. Because PostToolUse hooks run with the user's full system permissions and NO sandbox (verified from official Claude Code docs), the hook command can access anything the user can: environment variables, SSH keys, AWS credentials, source code. If the feedback payload construction is sloppy (e.g., capturing the full `tool_input` object without filtering), secrets embedded in tool inputs get transmitted to the EverySkill server.

**Specifically what the hook receives (from official docs):**

```json
{
  "session_id": "abc123",
  "transcript_path": "/Users/.../.claude/projects/.../transcript.jsonl",
  "cwd": "/Users/.../my-project",
  "permission_mode": "default",
  "hook_event_name": "PostToolUse",
  "tool_name": "Write",
  "tool_input": {
    "file_path": "/path/to/file.txt",
    "content": "file content here -- may contain API keys, passwords, etc."
  },
  "tool_response": {
    "filePath": "/path/to/file.txt",
    "success": true
  },
  "tool_use_id": "toolu_01ABC123..."
}
```

The `tool_input` and `tool_response` fields contain EVERYTHING the tool received and returned. For a Bash tool call, `tool_input.command` could contain `export API_KEY=sk-xxx`. For a Write tool, `tool_input.content` could be an `.env` file with database credentials.

**Why it happens:** The existing hook already captures `tool_input_snippet` and `tool_output_snippet` (1000 chars max, per the Zod schema in `/api/track/route.ts`). Extending to richer feedback means capturing more of this data. Developers naturally think "capture more context for better training data" without considering what that context contains.

**Consequences:**
- User credentials, API keys, and proprietary code transmitted to EverySkill's PostgreSQL database in the `metadata` JSONB column of `usage_events`.
- Data stored in plaintext in a multi-tenant database. Even with RLS, a database compromise exposes all training data across tenants.
- SOC2 violation: storing credentials outside the authorized boundary.
- GDPR violation if European user data (emails, names, addresses) appears in tool inputs and gets stored as training data without consent.

**Prevention:**
1. **Sanitize on the client side (in the hook command).** Before sending data, strip known secret patterns: `s/[A-Za-z0-9_-]*KEY[=:][^ ]*/[REDACTED]/g`, environment variables, bearer tokens, base64 strings longer than 100 chars. This runs in the bash hook before the curl.
2. **Sanitize on the server side (in `/api/track`).** Add a `sanitizePayload()` function that runs regex patterns against `tool_input_snippet` and `tool_output_snippet` before inserting into the database. Use patterns from tools like `detect-secrets` or `trufflehog`.
3. **Size-limit snippets aggressively.** The current 1000-char limit on snippets is already set. For training data, keep it. Do NOT increase this limit to "capture more context." 1000 chars of code is enough for quality assessment without containing full files.
4. **Never capture the full `tool_input.content` for Write operations.** This is the most dangerous field -- it contains entire file contents. Capture only the `file_path` and a truncated first-line summary.
5. **Add an opt-in consent flag.** Before capturing any training data, the user must explicitly opt in via an environment variable or skill configuration: `EVERYSKILL_TRAINING_DATA=true`. The hook checks this before including snippets.
6. **Encrypt training data at rest.** Use PostgreSQL's `pgcrypto` extension to encrypt the `metadata` JSONB column, or store training data in a separate encrypted table.

**Detection:** After implementing, search the `usage_events.metadata` column for common secret patterns: `sk-`, `AKIA`, `ghp_`, `password`, `secret`. If any matches, the sanitization is insufficient.

**Phase:** Must be addressed in the FIRST phase of feedback extension. The sanitization pipeline is a prerequisite for any richer data collection.

**Confidence:** HIGH -- PostToolUse hook permissions verified from [official Claude Code hooks reference](https://code.claude.com/docs/en/hooks): "Hooks run with your system user's full permissions. They can modify, delete, or access any files your user account can access."

---

### Pitfall 2: Training Data Consent and GDPR "Right to Erasure" Conflict

**What goes wrong:** Collecting real usage data as training data for skill quality assessment creates a data pipeline subject to privacy regulations. Three specific problems:

1. **Implicit collection without consent.** The current PostToolUse hook fires silently ("Silent with local log" per Phase 28 decisions). Extending it to capture training data without explicit user consent violates GDPR Article 6 (lawfulness of processing) and Article 13 (right to be informed). The user doesn't know their tool interactions are being stored as training data.

2. **Right to erasure (GDPR Article 17).** A user requests deletion of their data. You must delete their usage events from `usage_events`, but you've already used those events to compute benchmark scores, training datasets, and quality metrics for skills. The derived data may still contain traces of the user's interactions.

3. **Cross-tenant training data contamination.** If training data from tenant A is used to improve skill quality scores visible to tenant B, tenant A's proprietary workflows leak into tenant B's environment. Even aggregated data can reveal patterns (e.g., "this skill is most commonly used with financial data" derived from tenant A's banking workflows).

**Why it happens:** Developers treat usage tracking and training data collection as the same thing. Usage tracking ("skill X was used 50 times") is low-risk. Training data collection ("here's what the user did with skill X, including their inputs and outputs") is high-risk.

**Consequences:**
- Regulatory fines under GDPR (up to 4% of global revenue or EUR 20M) or EU AI Act (up to EUR 35M or 7% of revenue).
- If a user exercises their right to erasure and you can't fully comply because training data is woven into benchmark scores, you face a compliance incident.
- If training data leaks between tenants (even in aggregate), you violate the multi-tenant isolation that is the foundation of EverySkill's architecture.

**Prevention:**
1. **Separate usage tracking from training data collection.** Usage events (`usage_events` table) track WHAT was used. Training data (new `training_examples` table) stores HOW it was used. These are different data categories with different consent requirements.
2. **Explicit opt-in for training data.** Add a tenant-level setting: "Allow skill usage data to be used for quality assessment." This is an admin decision, not per-user. Display it prominently in tenant settings.
3. **Per-user opt-out.** Even with tenant-level opt-in, individual users can opt out of training data collection. Store this as a user preference. The hook checks `EVERYSKILL_TRAINING_DATA=false` and skips snippet capture.
4. **Implement data erasure.** When a user requests deletion: (a) delete all `training_examples` where `userId = X`, (b) recalculate any benchmark scores that used their data, (c) log the erasure in the audit trail.
5. **Never mix training data across tenants.** Training examples must have `tenantId` and RLS policies. Benchmark scores derived from training data are tenant-scoped. A skill's quality assessment in tenant A is independent of tenant B.
6. **Retention policy.** Training data older than 12 months is automatically purged. This limits the erasure surface and keeps data fresh.
7. **Add a `consent_version` field to training examples.** When the consent terms change, old data collected under the previous version can be identified and re-consented or purged.

**Detection:** Create training data as user A. Delete user A's account. Verify: (a) all training examples with userId=A are gone, (b) benchmark scores are recalculated without user A's data, (c) no remnants exist in the `metadata` JSONB column of any table.

**Phase:** Consent framework must be designed BEFORE any training data collection begins. It shapes the entire data pipeline.

**Confidence:** HIGH -- GDPR requirements verified from [Enterprise LLM Privacy Concerns](https://www.protecto.ai/blog/enterprise-llm-privacy-concerns/) and [Privacy Risks in LLMs](https://secureprivacy.ai/blog/privacy-risks-llms-enterprise-ai-governance). EU AI Act requirements from [EDPB Opinion 28/2024](https://www.edpb.europa.eu/).

---

### Pitfall 3: Token Counting is Model-Specific and the Anthropic API is the ONLY Accurate Source

**What goes wrong:** Benchmarking skills across LLM models requires knowing how many tokens each skill consumes. Developers assume they can count tokens locally using a tokenizer library (like tiktoken for OpenAI) and apply those counts universally. This is fundamentally wrong:

1. **Each model family has its own tokenizer.** Claude, GPT, Llama, and Gemini all tokenize text differently. The same skill prompt that is 500 tokens on Claude might be 480 on GPT-4 and 520 on Llama. There is no universal token count.

2. **Anthropic does not publish a local tokenizer.** Unlike OpenAI (which provides tiktoken), Anthropic's tokenizer is only available via their [Token Counting API](https://platform.claude.com/docs/en/build-with-claude/token-counting) (`POST /v1/messages/count_tokens`). Using tiktoken to estimate Claude tokens gives inaccurate results -- "the accuracy rate for Claude token counts is understandably not great" when using tiktoken.

3. **Token counts are estimates even from the official API.** Anthropic's own documentation states: "The token count should be considered an **estimate**. In some cases, the actual number of input tokens used when creating a message may differ by a small amount." Additionally, "Token counts may include tokens added automatically by Anthropic for system optimizations."

4. **Token counting API has rate limits.** The endpoint is free but rate-limited: 100 RPM for tier 1, up to 8,000 RPM for tier 4. If you're benchmarking 500 skills, each with 3 prompts, that's 1,500 API calls just for token counting. At 100 RPM, that's 15 minutes of waiting.

**Why it happens:** Developers see "token counter" and assume it's a deterministic local calculation. For OpenAI models this is largely true (tiktoken runs locally). For Claude, it requires an API call.

**Consequences:**
- Token counts stored in benchmarks are wrong if calculated with the wrong tokenizer, making cost estimates misleading.
- Cost comparisons between models are invalid if token counts aren't model-specific.
- Rate limits on the token counting API throttle benchmark runs, making the process much slower than expected.
- If the token count is used for context window management ("will this skill fit in the context?"), wrong counts cause silent truncation or API errors.

**Prevention:**
1. **Store token counts PER MODEL.** The benchmark table must have: `skillId`, `modelId`, `modelVersion`, `inputTokens`, `outputTokens`, `totalTokens`, `measuredAt`. Do not store a single "token count" per skill.
2. **Use the Anthropic Token Counting API for Claude models.** Call `POST /v1/messages/count_tokens` with the actual skill prompt, system message, and tool definitions. This is the only accurate source for Claude token counts.
3. **For non-Anthropic models:** use model-specific tokenizers. tiktoken for OpenAI, the Gemini tokenizer for Google models, SentencePiece for Llama.
4. **Cache token counts aggressively.** Token counts only change when the skill content changes. Hash the skill content and only re-count tokens when the hash changes. Store the content hash alongside the token count.
5. **Batch token counting.** Don't count tokens for all skills at once. Count tokens lazily -- when a skill is viewed, deployed, or benchmarked. Pre-compute counts for popular skills in a background job.
6. **Display token counts as ranges, not exact numbers.** "~500 tokens" is more honest than "503 tokens" given that the official API is an estimate.
7. **Cost estimation must use model-specific pricing.** Token count * price-per-token, where both values are model-specific. Store pricing as configuration, not hardcoded, since providers change pricing frequently.

**Detection:** Count tokens for the same skill using Anthropic's API and tiktoken. If the numbers match exactly, something is wrong (they should differ). Verify that changing one character in the skill content triggers a re-count.

**Phase:** Token counting infrastructure should be built as part of the benchmarking foundation phase, before any cost estimation or model comparison features.

**Confidence:** HIGH -- Anthropic's token counting API docs verified at [platform.claude.com](https://platform.claude.com/docs/en/build-with-claude/token-counting). Rate limits verified. Tiktoken inaccuracy for Claude verified from [multiple sources](https://blog.gopenai.com/counting-claude-tokens-without-a-tokenizer-e767f2b6e632).

---

### Pitfall 4: Benchmarks Become Invalid When Models Update, But Old Data Persists

**What goes wrong:** You benchmark skill X on "Claude Opus 4" in February 2026 -- it costs $0.03, uses 500 tokens, and produces "good" output. In April 2026, Anthropic updates Claude Opus 4 with improved capabilities (possibly under the same model ID, or a new version like "claude-opus-4-20260401"). Your benchmark data still shows the February numbers. Three failure modes:

1. **Silent model version changes.** Anthropic and OpenAI regularly update model weights behind the same API endpoint. The model called `claude-opus-4-6` today may have subtly different behavior than three months ago. If your benchmarks don't record the exact model version string (including the date suffix), you can't tell whether performance changes are due to the skill or the model.

2. **Prompt sensitivity across versions.** A skill prompt that gets 95% quality on model version A might get 75% on version B because the model interprets instructions differently. This is not a skill regression -- it's a model change. But if the benchmark doesn't distinguish the two, the skill appears to have degraded.

3. **Historical benchmark inflation.** Old benchmarks are never re-run. A skill benchmarked once on a favorable model version shows perpetually good numbers. Newer skills benchmarked on a harder model version look worse by comparison, even if they're objectively better.

4. **Benchmark contamination.** If the benchmark test cases are derived from real usage (training data), and those test cases were generated by the same model being evaluated, the benchmark is testing the model on its own output -- a form of data contamination that inflates scores.

**Why it happens:** Teams treat LLM benchmarking like traditional software testing, where the test environment is stable. In LLM benchmarking, the "environment" (the model) changes unpredictably and often silently.

**Consequences:**
- Cost estimates become misleading: a skill shows "$0.03/use" based on February pricing, but April pricing or token efficiency changed.
- Quality scores become meaningless: a skill shows "9/10 quality" but that was on an older model version.
- Cross-model comparisons are invalid: "Claude scores 9/10, GPT scores 7/10" if measured at different times with different model versions.
- Enterprise customers lose trust in the benchmarking system when numbers don't match reality.

**Prevention:**
1. **Record the EXACT model version string.** Not "claude-opus-4" but "claude-opus-4-6-20250929" (the full model ID returned by the API). Store this in every benchmark record.
2. **Add a `benchmarkedAt` timestamp.** Every benchmark record has a date. Display this prominently: "Benchmarked on 2026-02-15 with claude-opus-4-6."
3. **Implement benchmark expiration.** Benchmarks older than 90 days are marked as "stale" in the UI. Show a warning: "This benchmark was run 4 months ago. Model performance may have changed." Offer a "Re-benchmark" button.
4. **Detect model version changes.** On each API call, capture the model version from the response headers. If the version changes from the last known version, flag all benchmarks for that model as potentially stale.
5. **Separate the test cases from the training data.** Use a held-out evaluation set that is never used for training. If the training data changes, the evaluation set does not. This prevents contamination.
6. **Normalize cross-model comparisons.** Don't compare absolute scores across models. Instead, show relative performance: "This skill performs in the top 20% on Claude" and "top 30% on GPT." These percentile rankings are meaningful even when absolute scores differ.
7. **Version the benchmark methodology.** If you change how quality is scored (new rubric, new evaluation prompts), increment a `benchmarkVersion` field. Old results under version 1 are not comparable to new results under version 2.

**Detection:** Run the same benchmark twice, 30 days apart, on the same model. If the scores differ significantly (>10%), investigate whether the model version changed. Check the model version strings in both runs.

**Phase:** Benchmark schema design must be in the foundation phase. Staleness detection and re-benchmarking can be a follow-up phase.

**Confidence:** HIGH -- Model version instability verified from [HoneyHive evaluation pitfalls](https://www.honeyhive.ai/post/avoiding-common-pitfalls-in-llm-evaluation): "changes to the underlying models are often opaque, invalidating previous evaluation baselines." Confirmed by [LLM benchmarks 2026 analysis](https://llm-stats.com/benchmarks).

---

## Moderate Pitfalls

---

### Pitfall 5: Feedback Fatigue -- Users Ignore or Resent Prompts for Quality Ratings

**What goes wrong:** EverySkill already has a rating system (star ratings with time-saved estimates on `/skills/[slug]`). Adding in-session feedback prompts (via PostToolUse hooks or MCP tools) creates a second feedback channel. If this fires too often, users develop "feedback blindness" -- they stop reading prompts and either always click "good" or actively disable the hook.

Three specific failure modes in the EverySkill context:

1. **PostToolUse feedback hooks fire on EVERY tool call.** The current tracking hook fires on every tool invocation with `matcher: "*"`. If you add a feedback prompt on the same cadence, a session that makes 50 tool calls will prompt for feedback 50 times. This is unusable.

2. **Feedback inside Claude Code disrupts flow.** The PostToolUse hook can return `additionalContext` or `systemMessage` to Claude, or print to stderr (shown in verbose mode). But ANY output from a PostToolUse hook is visible to Claude and may affect its behavior. A feedback prompt like "Rate this skill 1-5" in the hook output would confuse Claude -- it would try to rate the skill itself rather than wait for the user.

3. **Feedback in the web UI competes with existing ratings.** The skill detail page already has star ratings. Adding a separate "Was this skill helpful?" or "Rate this session" widget duplicates the feedback mechanism and confuses users about which one matters.

**Why it happens:** Teams want rich feedback data. "More prompts = more data." But feedback quality degrades rapidly with frequency. Research shows survey fatigue causes respondents to either disengage entirely or provide low-quality angry responses.

**Consequences:**
- Users disable feedback hooks entirely, losing ALL feedback data.
- Feedback data is biased: only frustrated users respond (selection bias), or users always click the same answer (acquiescence bias).
- Claude interprets feedback prompts as instructions, corrupting the skill's behavior mid-session.
- Multiple feedback channels (in-session hook, web UI ratings, MCP tool) create contradictory data about the same skill.

**Prevention:**
1. **Smart frequency gating.** Never prompt for feedback more than once per session per skill. Use a local file (`/tmp/everyskill-feedback-state.json`) to track which skills have already prompted in this session. The hook checks this file before prompting.
2. **Probabilistic sampling.** Don't prompt every user every time. Prompt 10-20% of sessions, randomly. This gets statistically valid data without fatiguing every user. Implement in the hook: `if (( RANDOM % 10 == 0 )); then ...`.
3. **Prompt at session END, not during.** Use the `Stop` or `SessionEnd` hook instead of PostToolUse for feedback. After Claude finishes its work, ask "How was skill X?" This doesn't disrupt the workflow.
4. **Use implicit signals over explicit prompts.** Instead of asking users to rate, infer quality from behavior: Did the user re-run the skill? Did they fork it? Did they uninstall it? Did the session succeed (no errors)? These implicit signals are available from the existing usage tracking data without ANY user prompts.
5. **Consolidate feedback channels.** One canonical feedback mechanism: the web UI star rating. In-session feedback should AUGMENT this with implicit signals, not duplicate it with explicit prompts.
6. **If you MUST prompt in-session:** use a `Notification` hook (which shows to the user, not Claude) rather than PostToolUse output (which shows to Claude). The `Notification` event is specifically designed for user-facing messages.
7. **Respect "don't ask again."** If a user dismisses feedback 3 times in a row, stop asking for 30 days. Store this preference in the local state file.

**Detection:** Monitor feedback response rates over time. If the response rate drops below 20%, feedback fatigue has set in. If 80%+ of responses are the same rating, acquiescence bias has taken over.

**Phase:** Feedback mechanism design should be its own focused phase. Don't bolt feedback onto the tracking hook as an afterthought.

**Confidence:** HIGH -- Feedback fatigue patterns verified from [Fortune survey fatigue analysis](https://fortune.com/2025/12/28/customer-survey-fatigue-feedback-consumer-experience/) and [UX research best practices](https://www.userinterviews.com/ux-research-field-guide-chapter/continuous-user-feedback-surveys).

---

### Pitfall 6: Fork Spam from Auto-Generated Suggestions Overwhelms the Review Queue

**What goes wrong:** The v3 milestone idea says "suggested changes can come from any user / user's use of everyskill." If the system auto-generates improvement suggestions based on usage patterns or feedback data, and those suggestions automatically create fork proposals, the review queue gets flooded.

Consider the math: 100 active skills * 50 users * monthly usage = 5,000 usage events. If 5% of events trigger an auto-suggestion (error patterns, common modifications), that's 250 auto-generated fork proposals per month. Each requires author review. Most will be noise (minor formatting differences, environment-specific tweaks, false positive "improvements").

**Current fork infrastructure in the codebase:**
- `skills.forkedFromId` tracks the parent skill (self-referential FK)
- `skills.forkedAtContentHash` enables drift detection
- `update_skill` MCP tool creates forks: `forkedFromId: skillId` (line 277 of `apps/mcp/src/tools/update-skill.ts`)
- Fork actions in `apps/web/app/actions/fork-skill.ts` create new skills with `forkedFromId: parent.id`
- The existing review queue (`status` lifecycle with admin review) is designed for human-authored skills, not machine-generated variants

**Why it happens:** Auto-suggestion systems are easy to build but hard to calibrate. Without quality gates, every minor difference between a user's modified version and the original gets flagged as a "suggestion." The signal-to-noise ratio is terrible.

**Consequences:**
- Skill authors are buried in low-quality suggestions and stop reviewing any of them.
- The admin review queue (built for 5-10 submissions/week) chokes on hundreds of auto-generated proposals.
- The `skills` table fills with "suggestion" forks that are never approved, cluttering search results and inflating fork counts.
- Users who DO make legitimate suggestions have them lost in the noise.

**Prevention:**
1. **Suggestions are NOT forks.** Create a separate `skill_suggestions` table with: `id`, `skillId`, `suggesterId`, `tenantId`, `diff`, `reason`, `status` (pending/accepted/rejected/auto-dismissed), `confidence`, `createdAt`. Do NOT create a new row in `skills` for every suggestion.
2. **Quality threshold for auto-suggestions.** Only generate suggestions when: (a) multiple users made similar modifications (3+ users changed the same section), (b) the modification demonstrably improved outcomes (measured via training data), (c) the suggestion confidence exceeds a threshold (e.g., 0.8). One user's one-time tweak is NOT a suggestion.
3. **Rate-limit suggestions per skill per week.** Maximum 3 auto-generated suggestions per skill per week. After that, queue them for the next week. This prevents burst flooding.
4. **Batch suggestions.** Don't show each suggestion individually. Once per week, send the skill author a digest: "3 improvement suggestions for your skill 'Code Review Checklist'." One notification, not three.
5. **Author opt-in for auto-suggestions.** When creating a skill, the author chooses: "Accept improvement suggestions from users" (default off). If off, no auto-suggestions are generated. Manual fork-and-propose still works.
6. **Auto-dismiss low-confidence suggestions.** If a suggestion has confidence < 0.5 and no human endorsement within 14 days, auto-dismiss it. Don't keep it in the queue.
7. **Separate suggestion UI from the admin review queue.** Author-facing suggestion review is a different workflow from admin quality review. Don't mix them in the same queue.

**Detection:** After implementing, count suggestions per skill per week. If any skill has >10 suggestions, the threshold is too low. Count the acceptance rate -- if <10%, the quality filter needs tightening.

**Phase:** Suggestion pipeline should be a separate phase AFTER training data collection is stable. You need quality data to generate quality suggestions.

**Confidence:** MEDIUM -- No direct analogues in the current codebase. Pattern derived from content moderation best practices and the codebase's existing fork architecture.

---

### Pitfall 7: PostToolUse Hook Cannot Directly Solicit User Input or Block Session Flow

**What goes wrong:** Developers assume they can use the PostToolUse hook to ask the user a question ("Was this helpful?") and wait for a response. This is architecturally impossible. PostToolUse hooks have these constraints (verified from official docs):

1. **PostToolUse cannot block.** Exit code 2 on PostToolUse "Shows stderr to Claude (tool already ran)" -- it does NOT block the session. Unlike PreToolUse (which can deny a tool call), PostToolUse runs after the fact.
2. **Async hooks cannot return decisions.** The existing hook uses `async: true`. Async hooks "cannot block tool calls or return decisions" -- their output is "delivered on the next conversation turn."
3. **PostToolUse output goes to CLAUDE, not the user.** The `decision: "block"` field on PostToolUse "prompts Claude with the reason." The `additionalContext` is "for Claude to consider." The `systemMessage` is "shown to the user" but only as a warning, not an interactive prompt.
4. **No hook type supports interactive user input.** Command hooks, prompt hooks, and agent hooks all produce output -- they don't receive input from the user mid-session. The only user-facing interaction is the `PermissionRequest` hook (which shows an allow/deny dialog), and that's for permissions, not feedback.

**Why it happens:** The hook system is designed for automation and guardrails, not for user interaction. Developers coming from web frameworks expect request-response patterns, but hooks are fire-and-forget.

**Consequences:**
- If feedback is put in PostToolUse output, Claude reads it as instructions and may try to act on it (e.g., Claude starts rating its own work).
- If feedback is put in stderr, it shows in verbose mode only -- most users never see it.
- If `systemMessage` is used, the user sees a warning banner but has no way to respond to it.
- Any attempt to "pause for user input" hangs the hook until timeout (default 600 seconds).

**Prevention:**
1. **Collect feedback OUTSIDE the hook system.** The hook fires a POST to EverySkill's API with usage data. Feedback collection happens separately: (a) in the EverySkill web UI after the user's session, (b) via a dedicated MCP tool that the user explicitly invokes, (c) via a Notification hook that shows "Rate this skill at [URL]" -- a link the user clicks to go to the web feedback page.
2. **Use the `Notification` hook for user-visible messages.** If you need the user to see something, use the `Notification` event type, which is specifically for user-facing messages. However, it still can't collect input -- it's one-way.
3. **Use the `Stop` hook for end-of-session feedback.** The `Stop` event fires when Claude finishes responding. A Stop hook can return `decision: "block"` with a `reason` that asks Claude to prompt the user for feedback. This is the closest to interactive feedback: Claude asks the user, the user responds in the chat, and Claude can relay the rating via an MCP tool call.
4. **Build a dedicated `rate_skill` MCP tool.** This already fits the EverySkill architecture. The MCP server already has tools like `describe_skill`, `deploy_skill`. Add `rate_skill(skillId, rating, comment)`. Claude can suggest this tool to the user at appropriate moments. The user approves the tool call (via normal Claude Code permissions), providing an implicit consent mechanism.

**Detection:** Test by examining Claude's conversation after a PostToolUse hook fires with feedback text. If Claude responds to the feedback text as if it's an instruction, the feedback is in the wrong place.

**Phase:** This constraint should be understood BEFORE designing the feedback mechanism. It determines the entire feedback architecture.

**Confidence:** HIGH -- All constraints verified from [official Claude Code hooks reference](https://code.claude.com/docs/en/hooks), specifically the PostToolUse section and the async hooks limitations section.

---

### Pitfall 8: Benchmark Evaluation Using LLM-as-Judge is Unreliable and Biased

**What goes wrong:** Benchmarking skill quality requires a quality score. The obvious approach is to use an LLM to evaluate skill output: "Rate this output 1-10 for quality." This introduces systematic biases:

1. **Self-evaluation bias.** If you use Claude to evaluate output that Claude generated, the evaluation is biased toward Claude's own style. Claude rates Claude-generated text higher than human-written text, and vice versa for GPT evaluating GPT output. Verified: "LLM evaluators can hallucinate, make factual errors, or struggle to follow complex instructions" and "exhibit systematic biases favoring LLM-generated over human-written text."

2. **Positional bias.** When comparing two outputs, the LLM tends to rate the first one higher. If benchmark comparisons always present the "original" skill output first and the "new" version second, the original gets an unfair advantage.

3. **Verbosity bias.** LLMs rate longer, more verbose outputs higher even when shorter outputs are objectively better. A skill that produces concise output scores lower than one that produces verbose output, even if the concise version is more useful.

4. **Rubric drift.** If the evaluation prompt changes (even slightly), all scores shift. "Rate the output quality" vs "Evaluate the output effectiveness" produces different distributions. Your historical benchmarks become incomparable.

**Why it happens:** LLM-as-judge is convenient and scalable. Human evaluation is expensive and slow. Teams default to LLM evaluation for everything.

**Consequences:**
- Quality scores are inconsistent across evaluation runs, undermining trust.
- Cross-model comparisons are invalid: Claude rates Claude-output higher, GPT rates GPT-output higher.
- Skills optimized for LLM-evaluated quality (verbose, well-structured) may not be the best for actual users.
- Historical benchmarks can't be compared if the evaluation prompt changed.

**Prevention:**
1. **Use LLM-as-judge for RELATIVE comparisons, not absolute scores.** "Is output A better than output B for this task?" is more reliable than "Rate output A on a scale of 1-10." Pairwise comparison reduces bias.
2. **Use a DIFFERENT model as judge than the model being evaluated.** If benchmarking Claude output, evaluate with GPT (or vice versa). If benchmarking GPT output, evaluate with Claude. This mitigates self-evaluation bias.
3. **Randomize presentation order.** When comparing two outputs, randomly order them in the evaluation prompt. Log which was presented first to detect positional bias.
4. **Version-lock the evaluation prompt.** Store the exact evaluation prompt in the benchmark record. If you change the prompt, increment the benchmark version. Never mix scores from different evaluation prompts.
5. **Supplement with objective metrics.** Token count, execution time, error rate, and tool call count are objective measures that don't require LLM evaluation. Use these as the primary benchmarks, with LLM quality assessment as a secondary signal.
6. **Calibrate with human baselines.** For the first 50-100 evaluations, have a human rate the same outputs. Compute the LLM-human agreement rate. If agreement < 70%, the LLM evaluation is not reliable enough to use.
7. **The existing AI review system (`apps/web/lib/ai-review.ts`) already uses Anthropic with structured JSON output and Zod validation.** Extend this pattern for benchmarking evaluation, but add the anti-bias measures above.

**Detection:** Evaluate the same skill output twice with the same LLM. If scores differ by >1 point (on a 10-point scale), the evaluation is not stable enough for benchmarking.

**Phase:** Evaluation methodology should be designed in the benchmarking foundation phase, before any scores are stored.

**Confidence:** HIGH -- LLM-as-judge biases verified from [HoneyHive evaluation pitfalls](https://www.honeyhive.ai/post/avoiding-common-pitfalls-in-llm-evaluation) and [LLM evaluation frameworks 2026 analysis](https://medium.com/@future_agi/llm-evaluation-frameworks-metrics-and-best-practices-2026-edition-162790f831f4).

---

### Pitfall 9: Training Data Schema Design -- JSONB Blob vs Structured Tables

**What goes wrong:** The existing `usage_events` table stores training-relevant data in a `metadata` JSONB column. The temptation is to keep adding fields to this JSONB blob: `tool_input_snippet`, `tool_output_snippet`, `quality_score`, `user_feedback`, `benchmark_result`, `model_version`. Over time, the JSONB column becomes an untyped, unindexed data swamp.

**Specific problems with the current approach:**

1. **JSONB is not indexable for complex queries.** "Find all training examples where quality_score > 7 and model_version starts with 'claude'" requires a full table scan or GIN index on the JSONB column. With 100K+ usage events, these queries become slow.

2. **No schema enforcement.** Different hook versions send different JSONB shapes. Events from February have `{ source: "hook", skillName: "..." }`. Events from March might have `{ source: "hook", skillName: "...", quality: 8, modelVersion: "..." }`. There's no way to distinguish "quality is missing because it wasn't measured" from "quality is missing because the hook version didn't support it."

3. **Migration complexity.** Changing the shape of JSONB data requires a backfill migration across potentially millions of rows. Unlike column additions (which can have defaults), JSONB fields require explicit UPDATE statements.

4. **Query complexity.** Every query that touches training data needs `metadata->>'quality_score'` casting, null checking, and JSONB path expressions. This is error-prone and verbose.

**Why it happens:** JSONB feels like the "flexible" choice. "We'll figure out the schema later." But "later" never comes, and the blob grows.

**Consequences:**
- Benchmark queries are slow because they scan unindexed JSONB.
- Training data pipelines break silently when JSONB shapes don't match expectations.
- Reporting dashboards show incorrect aggregates because of inconsistent JSONB schemas.
- Data quality deteriorates as different hook versions send different shapes.

**Prevention:**
1. **Create dedicated tables for new data categories.** Don't extend `usage_events.metadata` JSONB. Create:
   - `training_examples` (id, tenantId, skillId, userId, inputSnippet, outputSnippet, quality, createdAt)
   - `skill_benchmarks` (id, tenantId, skillId, modelId, modelVersion, inputTokens, outputTokens, costEstimate, qualityScore, evaluationPromptVersion, benchmarkedAt)
   - `skill_feedback` (id, tenantId, skillId, userId, rating, comment, feedbackType, createdAt)
2. **Keep `usage_events` for usage tracking only.** It tracks WHAT happened (tool name, timestamp, source). It does NOT store HOW WELL it happened.
3. **Use proper columns with types and indexes.** `qualityScore INTEGER`, `modelVersion TEXT`, `inputTokens INTEGER` -- not JSONB. Index on `(skillId, modelVersion)` for benchmark queries.
4. **Add foreign keys and constraints.** `training_examples.skillId` references `skills.id`. `skill_benchmarks.skillId` references `skills.id`. This prevents orphaned data.
5. **Apply tenant RLS to all new tables.** Follow the established pattern: `tenantId NOT NULL`, pgPolicy for tenant isolation.
6. **Migrate existing training-relevant data from JSONB to structured tables.** Write a one-time migration that extracts `tool_input_snippet`, `tool_output_snippet`, and `quality_score` from `usage_events.metadata` into the new `training_examples` table.

**Detection:** After implementation, run `EXPLAIN ANALYZE` on benchmark queries. If any show sequential scans on JSONB columns, the schema is wrong.

**Phase:** Schema design should be the FIRST task of the training/benchmarking phase. Everything else depends on it.

**Confidence:** HIGH -- Directly verified from the existing `usage_events` schema at `packages/db/src/schema/usage-events.ts` which uses untyped `jsonb("metadata").$type<Record<string, unknown>>()`.

---

### Pitfall 10: Existing Rate Limiter (100 RPM) Will Throttle Enriched Feedback Payloads

**What goes wrong:** The current `/api/track` endpoint has an in-memory rate limiter at 100 requests per minute per API key (implemented in `apps/web/lib/rate-limiter.ts`). The existing PostToolUse hook fires on EVERY tool call. In a typical Claude Code session:

- A coding session might make 30-100 tool calls (Read, Write, Edit, Bash, Grep, Glob).
- Each tool call fires the PostToolUse hook, which sends a request to `/api/track`.
- At 100 tool calls/minute during an intensive session, the rate limiter starts dropping events.

Adding richer feedback (token counts, quality assessments, benchmark triggers) means each request takes longer to process server-side, and you might want to send additional requests (e.g., a separate "benchmark this" call after certain tool uses). This increases the chance of hitting the rate limit.

**Why it happens:** The 100 RPM limit was set for "prevent abuse" not "handle intensive sessions." Intensive Claude Code sessions easily hit 100 tool calls per minute during bulk operations (e.g., "edit 20 files").

**Consequences:**
- Usage events are silently dropped (the hook uses `|| true` to swallow errors, including 429 responses).
- Training data is incomplete: events from the busiest (most interesting) sessions are the most likely to be dropped.
- The dropped events are NOT retried or queued (the local queue mechanism from Phase 28 was noted as LOW confidence and may not be implemented).

**Prevention:**
1. **Client-side batching in the hook.** Instead of one HTTP request per tool call, batch events. Accumulate events in a local file (`/tmp/everyskill-batch.jsonl`) and flush every 10 seconds or every 10 events, whichever comes first. One HTTP request sends an array of events.
2. **Server-side batch endpoint.** Add `POST /api/track/batch` that accepts `{ events: [...] }`. This reduces HTTP overhead and rate limit pressure.
3. **Selective tracking.** Not every tool call needs rich feedback data. Track ALL tool calls with minimal data (skill_id, tool_name, timestamp). Only capture rich data (snippets, token counts) for a sample of calls, or only for specific tools (Write, Bash -- not Read, Glob).
4. **Increase the rate limit for known good keys.** The in-memory rate limiter could have per-key configurations: default 100 RPM, but keys associated with active tenants get 500 RPM.
5. **Implement the local queue.** Failed requests (429s) should be queued locally and retried on the next successful request. The hook appends failed payloads to `/tmp/everyskill-queue.jsonl` and drains the queue on the next flush.

**Detection:** Monitor 429 responses in the server logs. If >5% of tracking requests are rate-limited, the limit is too low for the workload.

**Phase:** Batching and rate limit adjustments should be done in the same phase as enriched feedback collection.

**Confidence:** HIGH -- Rate limiter implementation verified at `apps/web/lib/rate-limiter.ts`. Hook behavior verified from the existing `buildEverySkillFrontmatter()` pattern and Phase 28 research.

---

## Minor Pitfalls

---

### Pitfall 11: Benchmark Cost Estimates Become Stale as Provider Pricing Changes

**What goes wrong:** Skill benchmarks include cost estimates: "This skill costs ~$0.03 per use on Claude Opus 4.6." Provider pricing changes quarterly or more frequently. If cost data is hardcoded or stored at benchmark time without a mechanism to update it, cost estimates become wrong silently.

**Prevention:**
1. **Separate token counts from cost calculations.** Store token counts in the benchmark table. Calculate costs at DISPLAY TIME using a `model_pricing` configuration table or a pricing service.
2. **The `model_pricing` table stores: `modelId`, `inputPricePerMToken`, `outputPricePerMToken`, `effectiveDate`, `source`.** When pricing changes, add a new row with the new effective date. Cost queries use the pricing row with the most recent effective date.
3. **Show the pricing date.** "Estimated cost: $0.03 (based on pricing as of 2026-02-15)."
4. **Provide a manual "update pricing" admin action.** Don't auto-scrape provider pricing -- it changes format. An admin pastes the new pricing into a settings page.

**Detection:** Compare displayed cost estimates against the provider's current pricing page. If they differ, pricing is stale.

**Phase:** Pricing management can be a lightweight add-on to the benchmarking phase.

**Confidence:** MEDIUM -- Pricing volatility is well-known but specific update frequency varies by provider.

---

### Pitfall 12: Training Data Creates a Feedback Loop that Amplifies Skill Biases

**What goes wrong:** Training data comes from real usage. If a skill has a bias (e.g., it always suggests Python solutions even when the user is working in TypeScript), the training data captures this bias as "correct" behavior. When this training data is used to evaluate skill quality or suggest improvements, the bias is reinforced: the system thinks Python suggestions are good because that's what the training data shows.

**Prevention:**
1. **Diverse evaluation criteria.** Don't evaluate skills solely on "does the output match the training data." Include criteria like: relevance to the user's context, correctness, conciseness, and adherence to the skill's stated purpose.
2. **Flag training data outliers.** If 90% of training examples show the same pattern, it might be bias, not quality. Flag these for human review.
3. **Include negative examples.** Training data should include cases where the skill performed poorly (user switched to a different approach, session ended with errors). This prevents the training data from being exclusively "happy path."
4. **Periodically refresh the evaluation criteria.** Every 6 months, review what "good skill output" means. Update the evaluation rubric to prevent stagnation.

**Detection:** Analyze training data distribution. If >80% of examples for a skill show the same pattern, investigate whether it's genuinely good or a bias.

**Phase:** Training data analysis features in a later phase, after data collection is stable.

**Confidence:** MEDIUM -- Feedback loop patterns well-documented in ML literature but specific manifestation in skill marketplaces is novel.

---

### Pitfall 13: Async PostToolUse Hook Output Timing is Unpredictable

**What goes wrong:** The existing tracking hook uses `async: true`, which means "runs in the background without blocking." But the official docs state: "Hook output is delivered on the next conversation turn. If the session is idle, the response waits until the next user interaction." This means:

1. If the hook finishes while Claude is still working, the output arrives DURING Claude's next tool call -- potentially confusing Claude if the output contains feedback text.
2. If the hook finishes after the session ends, the output is NEVER delivered.
3. If multiple async hooks finish at different times, their outputs arrive interleaved on subsequent turns.

For the current use case (silent tracking with `-o /dev/null`), this doesn't matter because there's no output. But if enriched feedback hooks return `systemMessage` or `additionalContext`, the timing becomes unpredictable.

**Prevention:**
1. **Keep tracking hooks silent.** Continue using `-o /dev/null` for the tracking curl. Do not return JSON output from async PostToolUse hooks.
2. **Use synchronous hooks ONLY if blocking is acceptable.** For non-async hooks, the default timeout is 600 seconds. A sync hook that makes an HTTP call adds latency to every tool call. This is why the current design uses async.
3. **For feedback that must reach Claude:** use a separate mechanism (MCP tool, Stop hook) rather than PostToolUse async output. PostToolUse async output timing is not guaranteed.

**Detection:** Run a slow async hook (5-second sleep) and observe when the output appears in Claude's context. It should appear on the next turn, but verify this behavior is consistent.

**Phase:** Understand this constraint during feedback mechanism design.

**Confidence:** HIGH -- Verified from official docs: "Each execution creates a separate background process. There is no deduplication across multiple firings of the same async hook."

---

### Pitfall 14: Benchmarking Requires Anthropic API Key with Sufficient Tier for Token Counting

**What goes wrong:** The Anthropic Token Counting API is free but rate-limited by tier:

| Usage Tier | RPM |
|---|---|
| Tier 1 | 100 |
| Tier 2 | 2,000 |
| Tier 3 | 4,000 |
| Tier 4 | 8,000 |

EverySkill's existing Anthropic integration (for AI review) uses a single API key configured in the environment. Benchmarking hundreds of skills adds significant API volume. If the API key is on Tier 1, benchmarking 500 skills at 100 RPM takes 5 minutes just for token counting, plus the actual benchmark evaluation calls.

**Prevention:**
1. **Check the current API tier before building benchmarking.** Run a quick burst test: 100 token-counting calls in 1 minute. If rate-limited, the tier is 1 and needs upgrading.
2. **Implement exponential backoff for token counting calls.** The API returns 429 with a `retry-after` header. Respect it.
3. **Cache token counts aggressively.** Token counts for a given skill + model combination only change when the skill content changes. Hash the content and cache the count.
4. **Run benchmarks as a background job, not at request time.** A cron job that benchmarks 10 skills per hour is sustainable at any tier. Don't try to benchmark everything at once.

**Detection:** Monitor 429 responses from the Anthropic API. If they increase during benchmark runs, the tier is insufficient.

**Phase:** Verify API tier during the benchmarking foundation phase.

**Confidence:** HIGH -- Rate limits verified from [Anthropic token counting docs](https://platform.claude.com/docs/en/build-with-claude/token-counting).

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|---|---|---|
| Feedback Hook Extension | Pitfall 1: Secret leakage in tool_input | Client + server side sanitization, size limits |
| Feedback Hook Extension | Pitfall 7: Hook can't solicit user input | Use Stop hook, Notification hook, or MCP tool instead |
| Feedback Hook Extension | Pitfall 10: Rate limiter throttles enriched payloads | Client-side batching, selective tracking |
| Feedback Hook Extension | Pitfall 13: Async output timing unpredictable | Keep hooks silent, use separate feedback channels |
| Training Data Collection | Pitfall 2: GDPR consent and erasure | Separate consent framework, tenant opt-in, user opt-out |
| Training Data Collection | Pitfall 9: JSONB blob anti-pattern | Dedicated tables with typed columns and indexes |
| Training Data Collection | Pitfall 12: Feedback loop bias | Diverse evaluation criteria, negative examples |
| Benchmarking Foundation | Pitfall 3: Token counts are model-specific | Per-model token counting via official APIs |
| Benchmarking Foundation | Pitfall 4: Model version changes invalidate benchmarks | Record exact model versions, benchmark expiration |
| Benchmarking Foundation | Pitfall 8: LLM-as-judge is biased | Cross-model evaluation, pairwise comparison, human calibration |
| Benchmarking Foundation | Pitfall 11: Cost estimates go stale | Separate token counts from pricing, pricing table |
| Benchmarking Foundation | Pitfall 14: API tier limits benchmarking throughput | Check tier, cache counts, background jobs |
| Feedback UX | Pitfall 5: Feedback fatigue | Smart frequency, probabilistic sampling, Stop hook |
| Suggestion Pipeline | Pitfall 6: Fork spam from auto-suggestions | Separate suggestions table, quality threshold, batching |
| All Phases | Pitfall 2: Consent before collection | Design consent framework before any data collection |
| All Phases | Pitfall 9: Schema design before implementation | Dedicated tables for training data and benchmarks |

---

## Sources

### Primary -- Verified Official Documentation
- [Claude Code Hooks Reference](https://code.claude.com/docs/en/hooks) -- PostToolUse input schema, async limitations, no sandbox, security model, hook output routing (Claude vs user), decision control limitations. Verified 2026-02-15.
- [Anthropic Token Counting API](https://platform.claude.com/docs/en/build-with-claude/token-counting) -- Official API, rate limits by tier, estimate disclaimer, supported models. Verified 2026-02-15.
- Existing codebase analysis:
  - `apps/web/app/api/track/route.ts` -- Current tracking endpoint, Zod schema with 1000-char snippet limits
  - `packages/db/src/services/usage-tracking.ts` -- insertTrackingEvent, fire-and-forget pattern
  - `packages/db/src/schema/usage-events.ts` -- JSONB metadata column, tenant RLS
  - `packages/db/src/schema/skills.ts` -- Fork tracking fields (forkedFromId, forkedAtContentHash)
  - `apps/web/lib/rate-limiter.ts` -- In-memory 100 RPM rate limiter
  - `.planning/phases/28-hook-based-usage-tracking/28-RESEARCH.md` -- Original hook architecture decisions

### Secondary -- Verified External Sources
- [HoneyHive: Avoiding Common Pitfalls in LLM Evaluation](https://www.honeyhive.ai/post/avoiding-common-pitfalls-in-llm-evaluation) -- LLM-as-judge biases, model version opacity, benchmark contamination, statistical rigor
- [LLM Evaluation Frameworks 2026](https://medium.com/@future_agi/llm-evaluation-frameworks-metrics-and-best-practices-2026-edition-162790f831f4) -- Benchmark methodology, continuous evaluation
- [Counting Claude Tokens Without a Tokenizer](https://blog.gopenai.com/counting-claude-tokens-without-a-tokenizer-e767f2b6e632) -- tiktoken inaccuracy for Claude models
- [Token Counting Guide 2025](https://www.propelcode.ai/blog/token-counting-tiktoken-anthropic-gemini-guide-2025) -- Model-specific tokenization differences
- [Enterprise LLM Privacy Concerns](https://www.protecto.ai/blog/enterprise-llm-privacy-concerns/) -- GDPR, consent frameworks, data processing obligations
- [Privacy Risks in LLMs: Enterprise AI Governance Guide](https://secureprivacy.ai/blog/privacy-risks-llms-enterprise-ai-governance) -- Right to erasure challenges, data minimization
- [Fortune: Customer Survey Fatigue](https://fortune.com/2025/12/28/customer-survey-fatigue-feedback-consumer-experience/) -- Survey frequency degradation, user resentment patterns
- [Continuous Feedback Surveys UX Research](https://www.userinterviews.com/ux-research-field-guide-chapter/continuous-user-feedback-surveys) -- Smart timing, quality over quantity
- [LLM Benchmarks 2026](https://llm-stats.com/benchmarks) -- Benchmark saturation, data contamination evidence

### Codebase Evidence
- PostToolUse hook format: `.planning/phases/28-hook-based-usage-tracking/28-RESEARCH.md` lines 97-163
- Rate limiter: `apps/web/lib/rate-limiter.ts` (100 RPM per key)
- Usage events schema: `packages/db/src/schema/usage-events.ts` (JSONB metadata)
- Fork infrastructure: `packages/db/src/schema/skills.ts` lines 76-78, `apps/mcp/src/tools/update-skill.ts` line 277
- Tracking endpoint: `apps/web/app/api/track/route.ts` (Zod validation, HMAC, Bearer auth)
- AI review pattern: `apps/web/lib/ai-review.ts` (Anthropic SDK, structured JSON output)
