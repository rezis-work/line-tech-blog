import { IncomingMessage, ServerResponse } from "http";
import { parse } from "url";
import { handleApiError } from "../utils/error";
import {
  createCategory,
  deleteCategory,
  getAllCategories,
  updateCategory,
} from "../services/category";
import { getUserFromRequest } from "../middleware/auth";
import { parseBody } from "../utils/parseBody";
import { getAllPosts } from "../services/post";
import { createRateLimiter } from "../config/ratelimiter";

const limiter = createRateLimiter({ limit: 60, windowSeconds: 60 });

export async function handleCategoryRoutes(
  req: IncomingMessage,
  res: ServerResponse
) {
  const parsedUrl = new URL(
    req.url || "",
    `http://${req.headers.host || "localhost"}`
  );
  const path = parsedUrl.pathname;

  if (req.method === "GET" && path === "/api/categories") {
    const { success } = await limiter(req.socket.remoteAddress ?? "unknown");
    if (!success)
      return handleApiError(res, "Too many requests, try again later", 429);
    try {
      const categories = await getAllCategories();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(categories));
      return true;
    } catch (error) {
      handleApiError(res, `${error}`, 500, "Failed to fetch categories");
      return true;
    }
  }

  if (req.method === "POST" && path === "/api/categories") {
    const user = await getUserFromRequest(req);
    if (!user || (user.role !== "admin" && user.role !== "holder")) {
      handleApiError(res, "Forbidden", 403, "Forbidden");
      return true;
    }

    try {
      const { name } = await parseBody(req);
      const category = await createCategory(name);
      res.writeHead(201, { "Content-Type": "application/json" });
      res.end(JSON.stringify(category));
      return true;
    } catch (error) {
      handleApiError(res, `${error}`, 400, "Failed to create category");
      return true;
    }
  }

  if (req.method === "GET" && path.match(/^\/api\/categories\/\d+\/posts$/)) {
    const { success } = await limiter(req.socket.remoteAddress ?? "unknown");
    if (!success)
      return handleApiError(res, "Too many requests, try again later", 429);
    const categoryId = parseInt(path.split("/")[2]);
    const page = parseInt(parsedUrl.searchParams.get("page") || "1");
    const limit = parseInt(parsedUrl.searchParams.get("limit") || "5");

    try {
      const result = await getAllPosts(categoryId, page, limit);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result));
      return true;
    } catch (err) {
      handleApiError(res, `${err}`, 500, "Failed to fetch posts");
      return true;
    }
  }

  if (req.method === "PUT" && path.startsWith("/api/categories/")) {
    const user = await getUserFromRequest(req);
    if (!user || user.role !== "admin") {
      handleApiError(res, "Forbidden", 403, "Forbidden");
      return true;
    }

    const id = parseInt(path.split("/")[2]);
    try {
      const { name } = await parseBody(req);
      const category = await updateCategory(id, name);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(category));
      return true;
    } catch (error) {
      handleApiError(res, `${error}`, 400, "Failed to update category");
      return true;
    }
  }

  if (req.method === "DELETE" && path.startsWith("/api/categories/")) {
    const user = await getUserFromRequest(req);
    if (!user || (user.role !== "admin" && user.role !== "holder")) {
      handleApiError(res, "Forbidden", 403, "Forbidden");
      return true;
    }

    const id = parseInt(path.split("/")[2]);
    try {
      await deleteCategory(id);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ message: "Category deleted successfully" }));
      return true;
    } catch (error) {
      handleApiError(res, `${error}`, 400, "Failed to delete category");
      return true;
    }
  }

  return false;
}
