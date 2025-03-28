import pool from "../config/db";

export async function createCategory(name: string) {
  const result = await pool.query(
    `
    INSERT INTO categories (name) VALUES ($1) RETURNING id, name
    `,
    [name]
  );

  return result.rows[0];
}

export async function getAllCategories() {
  const result = await pool.query(`
    SELECT id, name FROM categories ORDER BY name ASC
  `);

  return result.rows;
}
