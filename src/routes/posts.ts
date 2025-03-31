import { IncomingMessage, ServerResponse } from "http";
import { parseBody } from "../utils/parseBody";
import {
  createPost,
  getAllPosts,
  getPostBySlug,
  updatePostBySlug,
  deletePostBySlug,
} from "../services/post";
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
    const categoryParam = parsedUrl.searchParams.get("category");
    const pageParam = parsedUrl.searchParams.get("page");
    const limitParam = parsedUrl.searchParams.get("limit");
    const categoryId = categoryParam ? parseInt(categoryParam) : undefined;
    const page = pageParam ? parseInt(pageParam) : 1;
    const limit = limitParam ? parseInt(limitParam) : 5;

    try {
      const result = await getAllPosts(categoryId, page, limit);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result));
      return true;
    } catch (err) {
      console.error(err);
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
      const { title, slug, content, image_url, category_ids } = await parseBody(
        req
      );

      const post = await createPost(
        title,
        slug,
        content,
        image_url,
        user.id,
        Array.isArray(category_ids) ? category_ids : []
      );

      res.writeHead(201, { "Content-Type": "application/json" });
      res.end(JSON.stringify(post));
      return true;
    } catch (error) {
      handleApiError(res, `${error}`, 400, "Failed to create post");
      return true;
    }
  }

  if (req.method === "PUT" && path.startsWith("/posts/")) {
    const slug = path.split("/")[2];
    const user = await getUserFromRequest(req);

    if (!user || user.role !== "admin") {
      handleApiError(res, "Unauthorized", 401);
      return true;
    }

    try {
      const body = await parseBody(req);
      const updated = await updatePostBySlug(slug, {
        title: body.title,
        newSlug: body.new_slug,
        content: body.content,
        imageUrl: body.image_url,
        categoryIds: body.category_ids,
      });

      if (!updated) {
        handleApiError(res, "Post not found", 404);
        return true;
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(updated));
      return true;
    } catch (error) {
      handleApiError(res, `${error}`, 400, "Failed to update post");
      return true;
    }
  }

  if (req.method === "DELETE" && path.startsWith("/posts/")) {
    const slug = path.split("/")[2];
    const user = await getUserFromRequest(req);

    if (!user || user.role !== "admin") {
      handleApiError(res, "Unauthorized", 401);
      return true;
    }

    try {
      const deleted = await deletePostBySlug(slug);

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(deleted));
      return true;
    } catch (error) {
      handleApiError(res, `${error}`, 400, "Failed to delete post");
      return true;
    }
  }

  return false;
}
