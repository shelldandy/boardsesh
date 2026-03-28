DROP INDEX "board_climbs_layout_filter_idx";--> statement-breakpoint
DROP INDEX "board_climbs_edges_idx";--> statement-breakpoint
CREATE INDEX "board_climb_stats_ascents_idx" ON "board_climb_stats" USING btree ("board_type","angle","ascensionist_count");--> statement-breakpoint
CREATE INDEX "board_climbs_search_filter_idx" ON "board_climbs" USING btree ("board_type","layout_id","is_listed","is_draft","frames_count","edge_left","edge_right","edge_bottom","edge_top");--> statement-breakpoint
CREATE INDEX "boardsesh_ticks_user_climb_lookup_idx" ON "boardsesh_ticks" USING btree ("user_id","board_type","angle","climb_uuid");