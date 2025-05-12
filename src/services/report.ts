import pool from "../config/db";
import { createRateLimiter } from "../config/ratelimiter";

export async function reportPost(
  userId: number,
  postId: number,
  reason: string
) {
  const limiter = createRateLimiter({ limit: 5, windowSeconds: 60 });
  const { success } = await limiter(userId.toString());
  if (!success) throw new Error("Too many reports");
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
  const limiter = createRateLimiter({ limit: 5, windowSeconds: 60 });
  const { success } = await limiter(userId.toString());
  if (!success) throw new Error("Too many reports");
  await pool.query(
    `
    INSERT INTO reports (user_id, comment_id, reason)
    VALUES ($1, $2, $3)
    `,
    [userId, commentId, reason]
  );
}
