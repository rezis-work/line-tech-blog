import dotenv from "dotenv";
import http from "http";
import { handleAuthRoutes } from "./routes/auth";
import { handlePostRoutes } from "./routes/posts";
import { handleApiError } from "./utils/error";
import { handleCategoryRoutes } from "./routes/categories";
import { handleFavoriteRoutes } from "./routes/favorites";
import { handleUserRoutes } from "./routes/user";
dotenv.config();

const PORT = process.env.PORT || 3000;

const routeHandlers = [
  handleUserRoutes,
  handleAuthRoutes,
  handlePostRoutes,
  handleCategoryRoutes,
  handleFavoriteRoutes,
];

export function startServer() {
  const server = http.createServer(async (req, res) => {
    try {
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
