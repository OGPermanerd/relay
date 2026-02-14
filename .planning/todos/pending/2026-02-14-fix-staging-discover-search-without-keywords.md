---
created: 2026-02-14T18:51:28.761Z
title: Fix staging discover search without keywords
area: search
files:
  - apps/web/lib/search-skills.ts
  - apps/web/app/actions/skills.ts
---

## Problem

Searching with "discover" in the staging environment doesn't work without keywords. The hybrid search (Phase 45) relies on Voyage AI embeddings for semantic search. If the Voyage API key isn't configured in staging, or if Ollama needs to be running for local embeddings, the search will fail silently or return no results.

Questions to investigate:
- Does staging have VOYAGE_API_KEY configured in .env.staging?
- Is there a fallback to text-only search when embeddings are unavailable?
- Who is the admin user for the staging environment tenant?
- Does Ollama need to be activated for local embedding support?

## Solution

1. Check `.env.staging` for VOYAGE_API_KEY
2. Verify staging admin user and tenant configuration
3. If Voyage isn't configured, consider adding a text-only fallback in searchSkills()
4. Document staging environment requirements for hybrid search
