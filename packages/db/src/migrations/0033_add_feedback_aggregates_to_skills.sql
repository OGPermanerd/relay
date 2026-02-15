-- Migration: Add feedback aggregate columns to skills table
-- Date: 2026-02-15
-- Description: Denormalized counters for feedback and token cost on skills

ALTER TABLE skills ADD COLUMN IF NOT EXISTS total_feedback INTEGER NOT NULL DEFAULT 0;
ALTER TABLE skills ADD COLUMN IF NOT EXISTS positive_feedback_pct INTEGER;
ALTER TABLE skills ADD COLUMN IF NOT EXISTS avg_token_cost_microcents INTEGER;
