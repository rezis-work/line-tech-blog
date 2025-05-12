import { cacheKey, getCache, setCache, invalidateCache } from "../config/cache";
import pool from "../config/db";

export async function createCategory(name: string) {
  const result = await pool.query(
    `
    INSERT INTO categories (name) VALUES ($1) RETURNING id, name
    `,
    [name]
  );

  await invalidateCache(cacheKey(["categories", "all"]));

  return result.rows[0];
}

export async function getAllCategories() {
  const key = cacheKey(["categories", "all"]);
  const cached = await getCache(key);
  if (cached) {
    return cached;
  }
  const result = await pool.query(`
    SELECT id, name FROM categories ORDER BY name ASC
  `);

  await setCache(key, result.rows, 300);

  return result.rows;
}

export async function updateCategory(id: number, name: string) {
  const result = await pool.query(
    `
    UPDATE categories SET name = $1 WHERE id = $2 RETURNING id, name
    `,
    [name, id]
  );

  await invalidateCache(cacheKey(["categories", "all"]));

  return result.rows[0];
}

export async function deleteCategory(id: number) {
  await pool.query(
    `
    DELETE FROM categories WHERE id = $1
    `,
    [id]
  );

  await invalidateCache(cacheKey(["categories", "all"]));
}

export async function getTopCategories(limit: number = 5) {
  const key = cacheKey(["categories", "top", limit.toString()]);
  const cached = await getCache(key);
  if (cached) {
    return cached;
  }
  const { rows } = await pool.query(
    `
    SELECT c.id, c.name, COUNT(pc.post_id) AS post_count
    FROM categories c
    LEFT JOIN post_categories pc ON c.id = pc.category_id
    GROUP BY c.id
    ORDER BY post_count DESC
    LIMIT $1
    `,
    [limit]
  );

  const resultObj = rows.map((row) => ({
    id: row.id,
    name: row.name,
    postCount: row.post_count,
  }));

  await setCache(key, resultObj, 300);

  return resultObj;
}
