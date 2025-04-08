import pool from "../config/db";

export async function refreshPostsSearchView() {
  await pool.query(`
    REFRESH MATERIALIZED VIEW posts_search;
  `);
}
