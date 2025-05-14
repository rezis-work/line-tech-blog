import { IncomingMessage, ServerResponse } from "http";
import { getNextAndPrevPosts } from "../services/post";
import { handleApiError } from "../utils/error";
import { createRateLimiter } from "../config/ratelimiter";

const limiter = createRateLimiter({ limit: 60, windowSeconds: 60 });

export async function handleNextPrevPostsRoute(
  req: IncomingMessage,
  res: ServerResponse
) {
  const parsedUrl = new URL(
    req.url || "",
    `http://${req.headers.host || "localhost"}`
  );
  const path = parsedUrl.pathname;
  const parts = path.split("/");

  if (
    req.method === "GET" &&
    parts[1] === "api" &&
    parts[2] === "posts" &&
    parts[4] === "navigation"
  ) {
    const { success } = await limiter(req.socket.remoteAddress ?? "unknown");
    if (!success)
      return handleApiError(res, "Too many requests, try again later", 429);
    const slug = parts[3];

    try {
      const result = await getNextAndPrevPosts(slug);

      if (!result) {
        handleApiError(res, "Post not found", 404);
        return true;
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result));
    } catch (error) {
      handleApiError(
        res,
        "Internal server error",
        500,
        "Error fetching next/prev posts"
      );
      return true;
    }
  }

  return false;
}
