import { IncomingMessage, ServerResponse } from "http";
import { parseBody } from "../utils/parseBody";
import { createPost, getAllPosts, getPostBySlug } from "../services/post";
import { getUserFromRequest } from "../middleware/auth";
import { handleApiError } from "../utils/error";

export async function handlePostRoutes(
  req: IncomingMessage,
  res: ServerResponse
) {
  const parsedUrl = new URL(
    req.url || "",
    `http://${req.headers.host || "localhost"}`
  );
  const path = parsedUrl.pathname;

  if (req.method === "GET" && path === "/posts") {
    try {
      const posts = await getAllPosts();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(posts));
      return true;
    } catch (err) {
      handleApiError(res, `${err}`, 500, "Failed to fetch posts");
      return true;
    }
  }

  if (req.method === "GET" && path.startsWith("/posts/")) {
    const slug = path.split("/")[2];

    try {
      const post = await getPostBySlug(slug);
      if (!post) {
        handleApiError(res, "Post not found", 404, "Post not found");
        return true;
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(post));
      return true;
    } catch (err) {
      handleApiError(res, `${err}`, 500, "Failed to fetch post");
      return true;
    }
  }

  if (req.method === "POST" && path === "/posts") {
    const user = await getUserFromRequest(req);

    if (!user || user.role !== "admin") {
      handleApiError(res, "Unauthorized", 401);
      return true;
    }

    try {
      const { title, slug, content, image_url } = await parseBody(req);

      const post = await createPost(title, slug, content, image_url, user.id);

      res.writeHead(201, { "Content-Type": "application/json" });
      res.end(JSON.stringify(post));
      return true;
    } catch (error) {
      handleApiError(res, `${error}`, 400, "Failed to create post");
      return true;
    }
  }

  return false;
}
