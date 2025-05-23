import { invalidateCache, setCache } from "../config/cache";
import { cacheKey, getCache } from "../config/cache";
import pool from "../config/db";

export async function createNotification(
  userId: number,
  type: string,
  message: string,
  postId?: number,
  commentId?: number
) {
  await pool.query(
    `
    INSERT INTO notifications (user_id, type, message, post_id, comment_id)
    VALUES ($1, $2, $3, $4, $5)
    `,
    [userId, type, message, postId || null, commentId || null]
  );

  await invalidateCache(cacheKey(["notifications", userId.toString()]));
  await invalidateCache(
    cacheKey(["notifications", "unread", userId.toString()])
  );
}

export async function getUserNotifications(
  userId: number,
  page = 1,
  limit = 10,
  totalPages: number,
  totalNotifications: number
) {
  const key = cacheKey([
    "notifications",
    userId.toString(),
    page.toString(),
    limit.toString(),
  ]);
  const cached = await getCache(key);
  if (cached) {
    return cached;
  }
  const offset = (page - 1) * limit;

  const result = await pool.query(
    `
    SELECT id, type, message, post_id, comment_id, is_read, created_at
    FROM notifications
    WHERE user_id = $1
    ORDER BY created_at DESC
    LIMIT $2 OFFSET $3
    `,
    [userId, limit, offset]
  );

  const resultObj = {
    notifications: result.rows,
    totalPages,
    totalNotifications,
  };

  await setCache(key, resultObj, 300);

  return resultObj;
}

export async function markNotificationsAsRead(
  notificationId: number,
  userId: number
) {
  const { rows } = await pool.query(
    `
    UPDATE notifications
    SET is_read = TRUE
    WHERE id = $1 AND user_id = $2
    `,
    [notificationId, userId]
  );

  await invalidateCache(cacheKey(["notifications", userId.toString()]));
  await invalidateCache(
    cacheKey(["notifications", "unread", userId.toString()])
  );

  return rows[0];
}

export async function getUnreadNotificationCount(userId: number) {
  const key = cacheKey(["notifications", "unread", userId.toString()]);
  const cached = await getCache(key);
  if (cached) return cached;
  const { rows } = await pool.query(
    `
    SELECT COUNT(*) FROM notifications
    WHERE user_id = $1 AND is_read = FALSE
    `,
    [userId]
  );

  const count = parseInt(rows[0].count, 10);

  await setCache(key, count, 300);

  return count;
}

export async function clearAllNotifications(userId: number) {
  await pool.query(
    `
    DELETE FROM notifications
    WHERE user_id = $1
    `,
    [userId]
  );

  await invalidateCache(cacheKey(["notifications", userId.toString()]));
  await invalidateCache(
    cacheKey(["notifications", "unread", userId.toString()])
  );

  return true;
}
