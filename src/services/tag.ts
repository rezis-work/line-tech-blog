import pool from "../config/db";

export async function findOrCreateTag(name: string) {
  const normalized = name.trim().toLowerCase();

  const existing = await pool.query(
    `
    SELECT id, name FROM tags WHERE name = $1
    `,
    [normalized]
  );

  if (existing.rows.length > 0) {
    return existing.rows[0];
  }

  const result = await pool.query(
    `
    INSERT INTO tags (name) VALUES ($1) RETURNING id, name
    `,
    [normalized]
  );

  return result.rows[0];
}

export async function addTagsToPost(postId: number, tagNames: string[]) {
  for (const name of tagNames) {
    const tag = await findOrCreateTag(name);
    await pool.query(
      `
      INSERT INTO post_tags (post_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING
      `,
      [postId, tag.id]
    );
  }
}

export async function clearTagsFromPost(postId: number) {
  await pool.query(
    `
    DELETE FROM post_tags WHERE post_id = $1
    `,
    [postId]
  );
}

export async function getTagsForPost(postId: number) {
  const result = await pool.query(
    `
    SELECT t.id, t.name
    FROM tags t
    JOIN post_tags pt ON pt.tag_id = t.id
    WHERE pt.post_id = $1
    `,
    [postId]
  );

  return result.rows;
}

export async function getTrendingTags(limit = 10) {
  const result = await pool.query(
    `
    SELECT 
     t.id, t.name, COUNT(pt.post_id) as usage_count
    FROM tags t
    JOIN post_tags pt ON pt.tag_id = t.id
    GROUP BY t.id
    ORDER BY usage_count DESC
    LIMIT $1
    `,
    [limit]
  );

  return result.rows.map((tag) => ({
    id: tag.id,
    name: tag.name,
    usageCount: parseInt(tag.usage_count),
  }));
}
export async function getTags() {
  const tagsResult = await pool.query(
    `
    SELECT id, name FROM tags
    `
  );
  return tagsResult.rows;
}
