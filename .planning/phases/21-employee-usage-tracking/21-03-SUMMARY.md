# Phase 21 Plan 03: Install Callback in Generated Scripts Summary

**One-liner:** Added curl/Invoke-WebRequest callbacks to bash and PowerShell install scripts so confirmed installations report back to the Relay server.

## What Was Done

### Task 1: Add install callback to generated install scripts

1. **Updated function signature** -- `generateInstallScript(os, baseUrl)` now accepts a `baseUrl: string` parameter that gets interpolated into the generated script templates.

2. **Bash script callback** -- Added a `curl -s -X POST` call to `${baseUrl}/api/install-callback` that:
   - Extracts `RELAY_API_KEY` from the just-written config file using a `node -e` one-liner
   - Sends JSON payload with `key`, `platform`, and `os` fields
   - Is fully non-blocking (`|| true`, stderr/stdout suppressed)

3. **PowerShell script callback** -- Added an `Invoke-WebRequest` call wrapped in `try/catch` that:
   - Reads `RELAY_API_KEY` from the config via `ConvertFrom-Json`
   - Posts the same JSON payload to the same endpoint
   - Silently swallows errors (empty catch block)

4. **Updated caller** -- `platform-install-modal.tsx` now passes `window.location.origin` as the second argument.

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Non-blocking callbacks with error suppression | Install must succeed even if callback fails (network down, server unreachable) |
| Extract API key from just-written config | The config file is guaranteed to exist at callback time; key may or may not be present depending on setup |

## Deviations from Plan

None -- plan executed exactly as written.

## Verification Results

- TypeScript compilation: clean (zero errors)
- Grep for `install-callback` in install-script.ts: found in both bash (line 117) and PowerShell (line 63) templates
- Playwright install tests: 6/6 passed (19.3s)

## Commits

| Hash | Message |
|------|---------|
| 32c9459 | feat(21-03): add install callback to generated install scripts |

## Files Modified

| File | Change |
|------|--------|
| `apps/web/lib/install-script.ts` | Added `baseUrl` param, bash curl callback, PowerShell Invoke-WebRequest callback |
| `apps/web/components/platform-install-modal.tsx` | Updated `generateInstallScript` call with `window.location.origin` |

## Duration

~2.5 minutes
