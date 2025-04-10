import { IncomingMessage, ServerResponse } from "http";
import { getNextAndPrevPosts } from "../services/post";
import { handleApiError } from "../utils/error";

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
    parts[1] === "posts" &&
    parts[3] === "navigation"
  ) {
    const slug = parts[2];

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
