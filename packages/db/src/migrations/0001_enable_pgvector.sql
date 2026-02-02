-- Enable pgvector extension for vector similarity search
-- This must run before any tables that use the vector type
-- Idempotent: safe to run multiple times
CREATE EXTENSION IF NOT EXISTS vector;
