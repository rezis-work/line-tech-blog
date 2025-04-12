import { getUserFromRequest } from "../middleware/auth";
import {
  deleteComment,
  deletePost,
  getAdminDashboardStats,
  getAdminPersonalAnalytics,
  getGlobalAnalyticsData,
  getGlobalDashboardStats,
  getReportedComments,
  getReportedPosts,
} from "../services/admin";
import { IncomingMessage, ServerResponse } from "http";
import { handleApiError } from "../utils/error";

export async function handleAdminDashboardRoutes(
  req: IncomingMessage,
  res: ServerResponse
) {
  if (req.method === "GET" && req.url === "/admin/dashboard") {
    const user = await getUserFromRequest(req);

    if (!user || (user.role !== "admin" && user.role !== "holder")) {
      handleApiError(res, "Unauthorized", 401);
      return true;
    }

    try {
      let stats;

      if (user.role === "admin") {
        stats = await getAdminDashboardStats(user.id);
      } else {
        stats = await getGlobalDashboardStats();
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(stats));
      return true;
    } catch (error) {
      handleApiError(res, error, 500);
      return true;
    }
  }

  if (req.method === "GET" && req.url === "/admin/analytics") {
    const user = await getUserFromRequest(req);
    if (!user || (user.role !== "admin" && user.role !== "holder")) {
      handleApiError(res, "Unauthorized", 401);
      return true;
    }

    try {
      let analyticsData;

      if (user.role === "admin") {
        analyticsData = await getAdminPersonalAnalytics(user.id);
      } else {
        analyticsData = await getGlobalAnalyticsData();
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(analyticsData));
      return true;
    } catch (error) {
      handleApiError(res, error, 500);
      return true;
    }
  }

  if (req.method === "GET" && req.url === "/admin/reported-posts") {
    const user = await getUserFromRequest(req);

    if (!user || (user.role !== "admin" && user.role !== "holder")) {
      handleApiError(res, "Unauthorized", 401);
      return true;
    }

    try {
      const reports = await getReportedPosts();

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(reports));
      return true;
    } catch (error) {
      handleApiError(res, error, 500);
      return true;
    }
  }

  if (req.method === "GET" && req.url === "/admin/reported-comments") {
    const user = await getUserFromRequest(req);

    if (!user || (user.role !== "admin" && user.role !== "holder")) {
      handleApiError(res, "Unauthorized", 401);
      return true;
    }

    try {
      const reports = await getReportedComments();

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(reports));
      return true;
    } catch (error) {
      handleApiError(res, error, 500);
      return true;
    }
  }

  if (req.method === "DELETE" && req.url?.startsWith("/admin/reports/posts/")) {
    const postId = req.url.split("/")[4];
    const user = await getUserFromRequest(req);

    if (!user || (user.role !== "admin" && user.role !== "holder")) {
      handleApiError(res, "Unauthorized", 401);
      return true;
    }

    try {
      await deletePost(parseInt(postId));
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ message: "Post deleted successfully" }));
      return true;
    } catch (error) {
      handleApiError(res, error, 500);
      return true;
    }
  }

  if (
    req.method === "DELETE" &&
    req.url?.startsWith("/admin/reports/comments/")
  ) {
    const commentId = req.url.split("/")[4];
    const user = await getUserFromRequest(req);

    if (!user || (user.role !== "admin" && user.role !== "holder")) {
      handleApiError(res, "Unauthorized", 401);
      return true;
    }

    try {
      await deleteComment(parseInt(commentId));
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ message: "Comment deleted successfully" }));
      return true;
    } catch (error) {
      handleApiError(res, error, 500);
      return true;
    }
  }

  return false;
}
