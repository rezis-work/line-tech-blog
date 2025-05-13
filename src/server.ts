import dotenv from "dotenv";
import http from "http";
import { handleAuthRoutes } from "./routes/auth";
import { handlePostRoutes } from "./routes/posts";
import { handleApiError } from "./utils/error";
import { handleCategoryRoutes } from "./routes/categories";
import { handleFavoriteRoutes } from "./routes/favorites";
import { handleUserRoutes } from "./routes/user";
import { handleCommentRoutes } from "./routes/comments";
import { handleAdminDashboardRoutes } from "./routes/admin";
import { rateLimiter } from "./middleware/rateLimiter";
import { cors } from "./middleware/cors";
import { handleBloggerRoutes } from "./routes/bloggers";
import { handleSearchRoutes } from "./routes/search";
import { handleTagRoutes } from "./routes/tags";
import { handleRelatedPostsRoute } from "./routes/relatedPosts";
import { handleNextPrevPostsRoute } from "./routes/nextPrevPosts";
import { handleCategoriesSidebarRoute } from "./routes/categoriesSidebar";
import { handleReportRoutes } from "./routes/report";
import { handleHomepageRoutes } from "./routes/homepage";
import { handleNotificationsRoutes } from "./routes/notifications";
dotenv.config();

const PORT = process.env.PORT || 3000;

const routeHandlers = [
  handleUserRoutes,
  handleBloggerRoutes,
  handleSearchRoutes,
  handleTagRoutes,
  handleRelatedPostsRoute,
  handleNextPrevPostsRoute,
  handleCategoriesSidebarRoute,
  handlePostRoutes,
  handleHomepageRoutes,
  handleCategoryRoutes,
  handleAuthRoutes,
  handleNotificationsRoutes,
  handleFavoriteRoutes,
  handleCommentRoutes,
  handleAdminDashboardRoutes,
  handleReportRoutes,
];

export function startServer() {
  const server = http.createServer(async (req, res) => {
    try {
      if (cors(req, res)) {
        return;
      }

      if (rateLimiter(req, res)) {
        return;
      }

      res.setHeader("Content-Type", "application/json");

      for (const handler of routeHandlers) {
        const handled = await handler(req, res);
        if (handled) {
          return;
        }
      }

      handleApiError(res, "Not Found", 404);
    } catch (error) {
      console.error("Server error:", error);
      handleApiError(res, "error", 500);
    }
  });

  server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}
