import { createScriptDb } from './db-connection';
import { sql } from 'drizzle-orm';

async function main() {
  const { db, close } = createScriptDb();

  try {
    const rows = await db.execute(sql`
      SELECT
        configs.board_type,
        configs.layout_id,
        bl.name AS layout_name,
        configs.size_id,
        configs.size_name,
        configs.size_description,
        configs.set_ids,
        configs.set_names,
        COALESCE(cc.climb_count, 0) AS climb_count
      FROM (
        SELECT DISTINCT ON (psls_agg.board_type, psls_agg.layout_id, bps.edge_left, bps.edge_right, bps.edge_bottom, bps.edge_top)
          psls_agg.board_type,
          psls_agg.layout_id,
          psls_agg.product_size_id AS size_id,
          bps.name AS size_name,
          bps.description AS size_description,
          bps.edge_left,
          bps.edge_right,
          bps.edge_bottom,
          bps.edge_top,
          (
            SELECT array_agg(DISTINCT s.set_id ORDER BY s.set_id)
            FROM board_product_sizes_layouts_sets s
            JOIN board_product_sizes sp ON sp.board_type = s.board_type AND sp.id = s.product_size_id
            WHERE s.board_type = psls_agg.board_type
              AND s.layout_id = psls_agg.layout_id
              AND sp.edge_left = bps.edge_left
              AND sp.edge_right = bps.edge_right
              AND sp.edge_bottom = bps.edge_bottom
              AND sp.edge_top = bps.edge_top
              AND s.is_listed = true
          ) AS set_ids,
          (
            SELECT array_agg(DISTINCT bs.name ORDER BY bs.name)
            FROM board_product_sizes_layouts_sets s
            JOIN board_product_sizes sp ON sp.board_type = s.board_type AND sp.id = s.product_size_id
            JOIN board_sets bs ON bs.board_type = s.board_type AND bs.id = s.set_id
            WHERE s.board_type = psls_agg.board_type
              AND s.layout_id = psls_agg.layout_id
              AND sp.edge_left = bps.edge_left
              AND sp.edge_right = bps.edge_right
              AND sp.edge_bottom = bps.edge_bottom
              AND sp.edge_top = bps.edge_top
              AND s.is_listed = true
          ) AS set_names
        FROM board_product_sizes_layouts_sets psls_agg
        JOIN board_product_sizes bps ON bps.board_type = psls_agg.board_type AND bps.id = psls_agg.product_size_id
        WHERE psls_agg.is_listed = true
          AND bps.is_listed = true
        GROUP BY psls_agg.board_type, psls_agg.layout_id, psls_agg.product_size_id,
                 bps.name, bps.description, bps.edge_left, bps.edge_right, bps.edge_bottom, bps.edge_top
        ORDER BY psls_agg.board_type, psls_agg.layout_id, bps.edge_left, bps.edge_right, bps.edge_bottom, bps.edge_top,
                 COUNT(DISTINCT psls_agg.set_id) DESC
      ) configs
      JOIN board_layouts bl ON bl.board_type = configs.board_type AND bl.id = configs.layout_id
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS climb_count
        FROM board_climbs bc
        WHERE bc.board_type = configs.board_type
          AND bc.layout_id = configs.layout_id
          AND bc.is_listed = true
          AND bc.is_draft = false
          AND bc.edge_left > configs.edge_left
          AND bc.edge_right < configs.edge_right
          AND bc.edge_bottom > configs.edge_bottom
          AND bc.edge_top < configs.edge_top
      ) cc ON true
      WHERE bl.is_listed = true
      ORDER BY climb_count DESC, configs.board_type, bl.name
    `);

    // db.execute() returns QueryResult with .rows for neon-serverless, or an array for postgres-js
    const rowsArray = Array.isArray(rows)
      ? (rows as Array<Record<string, unknown>>)
      : (rows as unknown as { rows: Array<Record<string, unknown>> }).rows;

    console.log(`Found ${rowsArray.length} board configurations:\n`);
    console.table(rowsArray);
  } finally {
    await close();
  }
}

main().catch((err) => {
  console.error('Error running popular board configs query:', err);
  process.exit(1);
});
