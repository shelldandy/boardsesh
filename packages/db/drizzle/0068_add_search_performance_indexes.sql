-- Performance indexes for expensive climb search queries
-- These require features (extensions, expression indexes, GIN, INCLUDE, DESC) that Drizzle can't express
-- Note: CONCURRENTLY removed because Drizzle migrations run inside a transaction.
-- For production, consider running these indexes manually outside a transaction if needed.

-- 1. pg_trgm for ILIKE '%pattern%' name search
CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS board_climbs_name_trgm_idx
  ON board_climbs USING GIN (name gin_trgm_ops);--> statement-breakpoint

-- 2. Expression index for ROUND(display_difficulty) range queries
CREATE INDEX IF NOT EXISTS board_climb_stats_difficulty_rounded_idx
  ON board_climb_stats (board_type, angle, ROUND(display_difficulty::numeric, 0))
  INCLUDE (climb_uuid, ascensionist_count);--> statement-breakpoint

-- 3. Enhanced covering index for ascensionist_count sort with INCLUDE columns
--    Replaces the basic board_climb_stats_ascents_idx from the Drizzle migration
DROP INDEX IF EXISTS board_climb_stats_ascents_idx;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS board_climb_stats_ascents_covering_idx
  ON board_climb_stats (board_type, angle, ascensionist_count DESC NULLS LAST)
  INCLUDE (climb_uuid, display_difficulty, quality_average, difficulty_average, benchmark_difficulty);--> statement-breakpoint

-- 4. Expression index for session feed COALESCE grouping
CREATE INDEX IF NOT EXISTS boardsesh_ticks_effective_session_idx
  ON boardsesh_ticks (COALESCE(session_id, inferred_session_id))
  WHERE COALESCE(session_id, inferred_session_id) IS NOT NULL;
