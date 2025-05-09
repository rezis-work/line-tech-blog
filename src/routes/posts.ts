import { IncomingMessage, ServerResponse } from "http";
import { parseBody } from "../utils/parseBody";
import {
  createPost,
  getAllPosts,
  getPostBySlug,
  updatePostBySlug,
  deletePostBySlug,
  getPostsWithVideos,
  getPostsByTags,
} from "../services/post";
import { getUserFromRequest } from "../middleware/auth";
import { handleApiError } from "../utils/error";
import pool from "../config/db";

export async function handlePostRoutes(
  req: IncomingMessage,
  res: ServerResponse
) {
  const parsedUrl = new URL(
    req.url || "",
    `http://${req.headers.host || "localhost"}`
  );
  const path = parsedUrl.pathname;

  if (req.method === "GET" && path === "/posts/tags") {
    const tagsParam = parsedUrl.searchParams.get("tags");

    if (!tagsParam) {
      handleApiError(res, "No tags provided", 400);
      return true;
    }

    const tags = tagsParam.split(",").map((t) => t.trim());
    const page = parseInt(parsedUrl.searchParams.get("page") || "1");
    const limit = parseInt(parsedUrl.searchParams.get("limit") || "5");

    try {
      const result = await getPostsByTags(tags, page, limit);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result));
      return true;
    } catch (error) {
      handleApiError(res, `${error}`, 500, "Failed to fetch posts by tags");
      return true;
    }
  }

  if (req.method === "GET" && path === "/posts") {
    const categoryParam = parsedUrl.searchParams.get("category");
    const pageParam = parsedUrl.searchParams.get("page");
    const limitParam = parsedUrl.searchParams.get("limit");
    const tagNameParam = parsedUrl.searchParams.get("tag");
    const queryParam = parsedUrl.searchParams.get("query");
    const sortParam = parsedUrl.searchParams.get("sort") as
      | "newest"
      | "popular"
      | "commented";
    const categoryId = categoryParam ? parseInt(categoryParam) : undefined;
    const page = pageParam ? parseInt(pageParam) : 1;
    const limit = limitParam ? parseInt(limitParam) : 5;
    console.log(categoryId);

    try {
      const {
        page: _page,
        limit: _limit,
        total,
        hasMore,
        posts,
      } = await getAllPosts(
        categoryId,
        page,
        limit,
        queryParam || undefined,
        sortParam || "newest",
        tagNameParam || undefined
      );

      const totalPages = Math.ceil(total / limit);

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({ page, limit, total, totalPages, hasMore, posts })
      );
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
      const {
        title,
        slug,
        content,
        image_url,
        category_ids,
        video_url,
        tag_names,
      } = await parseBody(req);

      const post = await createPost(
        title,
        slug,
        content,
        image_url,
        user.id,
        Array.isArray(category_ids) ? category_ids : [],
        video_url,
        tag_names
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
      const authorCheck = await pool.query(
        `
         SELECT author_id FROM posts WHERE slug = $1
        `,
        [slug]
      );

      if (authorCheck.rows.length === 0) {
        handleApiError(res, "Post not found", 404);
        return true;
      }

      const post = authorCheck.rows[0];

      if (post.author_id !== user.id) {
        handleApiError(res, "Unauthorized", 401);
        return true;
      }

      const body = await parseBody(req);
      const updated = await updatePostBySlug(slug, {
        title: body.title,
        newSlug: body.new_slug,
        content: body.content,
        imageUrl: body.image_url,
        categoryIds: body.category_ids,
        tagNames: body.tag_names,
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

  if (req.method === "GET" && path === "/videos") {
    try {
      const posts = await getPostsWithVideos();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(posts));
      return true;
    } catch (error) {
      handleApiError(res, `${error}`, 500, "Failed to fetch videos");
      return true;
    }
  }

  return false;
}
