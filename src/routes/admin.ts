import { getUserFromRequest } from "../middleware/auth";
import {
  getAdminDashboardStats,
  getGlobalDashboardStats,
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

  return false;
}
