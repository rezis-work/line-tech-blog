import { IncomingMessage, ServerResponse } from "http";
import { searchPosts } from "../services/post";
import { handleApiError } from "../utils/error";
import { createRateLimiter } from "../config/ratelimiter";

const limiter = createRateLimiter({ limit: 30, windowSeconds: 60 });

export async function handleSearchRoutes(
  req: IncomingMessage,
  res: ServerResponse
) {
  const parsedURL = new URL(
    req.url || "",
    `http://${req.headers.host || "localhost"}`
  );
  const path = parsedURL.pathname;

  if (req.method === "GET" && path === "/api/search") {
    const { success } = await limiter(req.socket.remoteAddress ?? "unknown");
    if (!success)
      return handleApiError(res, "Too many requests, try again later", 429);
    const query = parsedURL.searchParams.get("query");

    if (!query || query.trim() === "") {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Query parameter is required" }));
      return true;
    }

    try {
      const posts = await searchPosts(query);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(posts));
      return true;
    } catch (error) {
      handleApiError(res, error, 500);
      return true;
    }
  }
  return false;
}
