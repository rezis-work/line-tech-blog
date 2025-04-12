import pool from "../config/db";

export async function reportPost(
  userId: number,
  postId: number,
  reason: string
) {
  await pool.query(
    `
    INSERT INTO reports (user_id, post_id, reason)
    VALUES ($1, $2, $3)
    `,
    [userId, postId, reason]
  );
}

export async function reportComment(
  userId: number,
  commentId: number,
  reason: string
) {
  await pool.query(
    `
    INSERT INTO reports (user_id, comment_id, reason)
    VALUES ($1, $2, $3)
    `,
    [userId, commentId, reason]
  );
}
