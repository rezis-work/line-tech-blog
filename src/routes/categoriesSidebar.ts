import { getTopCategories } from "../services/category";
import { handleApiError } from "../utils/error";
import { IncomingMessage, ServerResponse } from "http";
import { createRateLimiter } from "../config/ratelimiter";

const limiter = createRateLimiter({ limit: 60, windowSeconds: 60 });

export async function handleCategoriesSidebarRoute(
  req: IncomingMessage,
  res: ServerResponse
) {
  const parsedUrl = new URL(
    req.url || "",
    `http://${req.headers.host || "localhost"}`
  );
  const path = parsedUrl.pathname;

  if (req.method === "GET" && path === "/api/categories/sidebar") {
    const { success } = await limiter(req.socket.remoteAddress ?? "unknown");
    if (!success)
      return handleApiError(res, "Too many requests, try again later", 429);
    try {
      const categories = await getTopCategories(5);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(categories));
      return true;
    } catch (error) {
      handleApiError(
        res,
        "Internal server error",
        500,
        "Error fetching categories"
      );
      return true;
    }
  }

  return false;
}
