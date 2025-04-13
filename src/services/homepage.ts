import pool from "../config/db";

export async function getTopPostsByCategory(limitPerCategory = 3) {
  try {
    const categoriesResult = await pool.query(`
      SELECT id, name FROM categories ORDER BY name ASC
      `);

    const categories = categoriesResult.rows;

    const results: Record<string, any>[] = [];

    for (const category of categories) {
      const postsResult = await pool.query(
        `
        SELECT
         p.id, p.title, p.slug, p.image_url, p.created_at,
         u.id AS author_id, u.name AS author_name, u.image_url AS author_image_url
        FROM posts p
        JOIN post_categories pc ON pc.post_id = p.id
        JOIN users u ON p.author_id = u.id
        WHERE pc.category_id = $1
        ORDER BY p.created_at DESC
        LIMIT $2
        `,
        [category.id, limitPerCategory]
      );

      results.push({
        category: {
          id: category.id,
          name: category.name,
        },
        posts: postsResult.rows,
      });
    }
    return results;
  } catch (err) {
    console.error("Error fetching top posts by category", err);
    throw new Error("Failed to fetch top posts by category");
  }
}
