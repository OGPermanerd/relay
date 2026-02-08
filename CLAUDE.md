# Project Rules

# Relay Project - Claude Code Guidelines

## System Context
LXC container on 32GB / 8 vCPU Hetzner VPS. Use full resources, but detect and stop runaway conditions.

## Circuit Breakers (MUST follow)

### Stop and Report If:
- Same error appears 3+ times in a row
- Build/test cycle repeats without progress for 10+ minutes
- Load average exceeds 40 (check with `uptime`)
- Available memory drops below 2GB (`free -h`)

### When Circuit Breaker Triggers:
1. Kill runaway processes: `pkill -f "next-server" && pkill -9 node`
2. Document: what was attempted, what failed, how many times
3. Wait for guidance before retrying

## Avoiding Hot-Reload Loops

When making bulk file changes (5+ files), stop dev server first:
```bash
pkill -f "next-server"
# make changes
pnpm build  # validate without hot-reload
```

For single file changes, hot-reload is fine.

## Quick Health Check
```bash
uptime && free -h | grep Mem
```

## If Stuck
```bash
# What's consuming resources?
ps aux --sort=-%cpu | head -10

# Kill everything and reassess
pkill -f "next-server" && pkill -9 node && pkill ollama
```

## Summary
- Use full parallelism — no artificial limits
- Stop after 3 identical failures
- Stop if load > 40 or memory < 2GB
- Kill hot-reload during bulk edits
- When in doubt, checkpoint and ask

## Testing
- Always invoke Playwright to test each page modified before asking the user to review it. Never present a checkpoint without first running automated Playwright tests that verify every modified page loads without errors.