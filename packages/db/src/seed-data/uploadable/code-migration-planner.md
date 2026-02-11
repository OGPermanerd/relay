# Code Migration Planner

Plan and execute codebase migrations with minimal risk, clear rollback procedures, and comprehensive validation.

## Purpose
This skill helps engineering teams plan large-scale code migrations — framework upgrades, language transitions, monolith-to-microservice splits, or dependency replacements. It produces a migration plan that balances speed with safety.

## Inputs
- **Migration Type**: {{type}} (framework upgrade / language migration / architecture change / dependency replacement)
- **Source**: {{source}} — current state (e.g., "React class components", "Express.js monolith", "Moment.js")
- **Target**: {{target}} — desired state (e.g., "React functional + hooks", "NestJS microservices", "date-fns")
- **Codebase Size**: {{size}} — files affected (approximate)
- **Team Size**: {{team}} — engineers available for migration
- **Timeline Constraint**: {{timeline}} — hard deadline if any
- **Risk Tolerance**: {{risk}} (conservative / moderate / aggressive)

## Migration Plan Output

### 1. Impact Assessment
Analyze the codebase to determine:
- Total files and lines of code affected
- Dependency graph — what depends on what's changing
- Test coverage in affected areas
- External API contracts that must be preserved
- Database schema changes required

### 2. Migration Strategy
Choose and justify one of:
- **Big Bang**: Migrate everything at once (only for small, well-tested codebases)
- **Strangler Fig**: Gradually replace old with new, running both in parallel
- **Branch by Abstraction**: Introduce an abstraction layer, swap implementation behind it
- **Feature Flag**: Toggle between old and new code per-feature

### 3. Phase Breakdown
For each phase:
- **Scope**: Which modules/files are migrated
- **Prerequisites**: What must be true before starting
- **Steps**: Ordered list of changes
- **Validation**: How to verify this phase succeeded
- **Rollback**: How to undo if something breaks
- **Duration Estimate**: Calendar time and person-days

### 4. Compatibility Layer
If running old and new code in parallel:
- Adapter/bridge code needed
- Shared state management approach
- API versioning strategy
- Feature detection vs. feature flags

### 5. Testing Strategy
- Unit test migration (update tests as code migrates)
- Integration test plan (verify interfaces between old and new)
- Performance benchmarks (before/after comparison)
- Canary deployment plan
- Smoke test checklist for each phase

### 6. Risk Register
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
Include technical risks, timeline risks, and people risks.

### 7. Communication Plan
- How to communicate progress to stakeholders
- Breaking change announcements to API consumers
- Documentation updates needed
- Team onboarding for new patterns/frameworks

### 8. Success Criteria
- All tests passing
- Performance within X% of baseline
- Zero regression bugs in production for 1 week
- Team velocity returns to pre-migration levels within 2 sprints

## Codemods & Automation
Where possible, suggest automated migration tools:
- jscodeshift transforms for JavaScript/TypeScript
- go-fix for Go migrations
- Rector for PHP
- Scalafix for Scala
- Custom regex-based transforms for simple replacements

For each codemod:
- What it transforms
- How to run it
- Manual review needed after running
- Edge cases it won't handle

## Anti-Patterns to Avoid
- Migrating and refactoring at the same time — separate concerns
- Skipping the compatibility layer — always have a way to run both
- Ignoring test coverage gaps — write tests BEFORE migrating
- Underestimating long-tail cleanup — budget 30% extra time
- Not measuring performance impact — benchmark before and after
