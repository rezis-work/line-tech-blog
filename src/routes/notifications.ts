import { IncomingMessage, ServerResponse } from "http";
import { getUserFromRequest } from "../middleware/auth";
import { handleApiError } from "../utils/error";
import {
  clearAllNotifications,
  getUnreadNotificationCount,
  getUserNotifications,
  markNotificationsAsRead,
} from "../services/notification";
import pool from "../config/db";

export async function handleNotificationsRoutes(
  req: IncomingMessage,
  res: ServerResponse
) {
  const parsedUrl = new URL(
    req.url || "",
    `http://${req.headers.host || "localhost"}`
  );
  const path = parsedUrl.pathname;

  const user = await getUserFromRequest(req);

  if (!user) {
    handleApiError(res, "Unauthorized", 401);
    return true;
  }
  if (req.method === "GET" && path === "/api/notifications") {
    try {
      const page = parseInt(parsedUrl.searchParams.get("page") || "1");
      const limit = parseInt(parsedUrl.searchParams.get("limit") || "10");
      const { rows } = await pool.query(
        "SELECT COUNT(*) FROM notifications WHERE user_id = $1",
        [user.id]
      );
      const totalNotifications = parseInt(rows[0].count);
      const totalPages = Math.ceil(totalNotifications / limit);
      const notifications = await getUserNotifications(
        user.id,
        page,
        limit,
        totalPages,
        totalNotifications
      );

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(notifications));
      return true;
    } catch (error) {
      handleApiError(res, error, 500, "Failed to fetch notifications");
      return true;
    }
  }

  if (
    req.method === "PUT" &&
    path.startsWith("/notifications/") &&
    path.endsWith("/read")
  ) {
    const id = parseInt(path.split("/")[2]);

    try {
      await markNotificationsAsRead(id, user.id);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ message: "Notification marked as read" }));
      return true;
    } catch (error) {
      handleApiError(res, error, 500, "Failed to mark notification as read");
      return true;
    }
  }

  if (req.method === "GET" && path === "/notifications/unread-count") {
    try {
      const count = await getUnreadNotificationCount(user.id);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ count }));
      return true;
    } catch (error) {
      handleApiError(
        res,
        error,
        500,
        "Failed to get unread notification count"
      );
      return true;
    }
  }

  if (req.method === "DELETE" && path === "/notifications") {
    try {
      await clearAllNotifications(user.id);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ message: "All notifications cleared" }));
      return true;
    } catch (error) {
      handleApiError(res, error, 500, "Failed to clear all notifications");
      return true;
    }
  }

  return false;
}
