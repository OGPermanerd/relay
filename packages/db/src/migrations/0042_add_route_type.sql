-- Add route_type column to search_queries for adaptive query routing
ALTER TABLE search_queries ADD COLUMN route_type text;

-- Backfill existing rows as hybrid (the previous default behavior)
UPDATE search_queries SET route_type = 'hybrid' WHERE route_type IS NULL;

-- Enforce NOT NULL after backfill
ALTER TABLE search_queries ALTER COLUMN route_type SET NOT NULL;

-- Set default for future inserts
ALTER TABLE search_queries ALTER COLUMN route_type SET DEFAULT 'hybrid';

-- Index for analytics grouping by route type
CREATE INDEX search_queries_route_type_idx ON search_queries (route_type);
