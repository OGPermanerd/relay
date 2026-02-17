# Loom Video Thumbnails in Skills Accordion

**Created:** 2026-02-16
**Source:** UAT session feedback
**Priority:** Backlog

## Idea

Create test data with some random Loom video links and show a video play thumbnail in the skills accordion blowup (expanded row detail view).

## Details

- Seed some skills with Loom video URLs in their metadata
- When a skill has a Loom video link, render a clickable video thumbnail in the accordion expansion
- Loom provides oEmbed API for thumbnail extraction
- Existing Loom integration (Phase 41) may already have infrastructure for this

## Technical Notes

- Loom oEmbed endpoint: `https://www.loom.com/v1/oembed?url=VIDEO_URL`
- Thumbnail could be lazy-loaded on accordion expand
- Click should open Loom player (inline or new tab)
