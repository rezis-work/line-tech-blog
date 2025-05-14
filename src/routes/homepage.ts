import { IncomingMessage, ServerResponse } from "http";
import { handleApiError } from "../utils/error";
import { getTopPostsByCategory, getTrendingPosts } from "../services/homepage";
import { createRateLimiter } from "../config/ratelimiter";

const homepageLimiter = createRateLimiter({ limit: 60, windowSeconds: 60 });

export async function handleHomepageRoutes(
  req: IncomingMessage,
  res: ServerResponse
) {
  const parsedUrl = new URL(
    req.url || "",
    `http://${req.headers.host || "localhost"}`
  );
  const path = parsedUrl.pathname;

  if (req.method === "GET" && path === "/api/homepage/top-by-category") {
    const { success } = await homepageLimiter(
      req.socket.remoteAddress ?? "unknown"
    );
    if (!success)
      return handleApiError(res, "Too many requests, try again later", 429);
    try {
      const result = await getTopPostsByCategory();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result));
      return true;
    } catch (err) {
      handleApiError(res, err, 500, "Failed to fetch top posts by category");
      return true;
    }
  }

  if (req.method === "GET" && path === "/api/homepage/trending") {
    const { success } = await homepageLimiter(
      req.socket.remoteAddress ?? "unknown"
    );
    if (!success)
      return handleApiError(res, "Too many requests, try again later", 429);
    try {
      const result = await getTrendingPosts();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result));
      return true;
    } catch (err) {
      handleApiError(res, err, 500, "Failed to fetch trending posts");
      return true;
    }
  }

  return false;
}
