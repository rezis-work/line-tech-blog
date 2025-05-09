import { IncomingMessage, ServerResponse } from "http";
import { getRelatedPosts } from "../services/post";
import { handleApiError } from "../utils/error";
import { getPostBySlug } from "../services/post";

export async function handleRelatedPostsRoute(
  req: IncomingMessage,
  res: ServerResponse
) {
  const parsedUrl = new URL(
    req.url || "",
    `http://${req.headers.host || "localhost"}`
  );
  const path = parsedUrl.pathname;
  const parts = path.split("/");

  if (req.method === "GET" && parts[1] === "posts" && parts[3] === "related") {
    const slug = parts[2];

    try {
      const post = await getPostBySlug(slug);
      if (!post) {
        handleApiError(res, "Post not found", 404);
        return true;
      }

      const relatedPosts = await getRelatedPosts(post.id);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(relatedPosts));
      return true;
    } catch (error) {
      handleApiError(res, "Internal server error", 500);
      return true;
    }
  }

  return false;
}
