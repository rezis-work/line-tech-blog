import { IncomingMessage, ServerResponse } from "http";
import { getPostsByUserId, updateAdminProfile } from "../services/user";
import { handleApiError } from "../utils/error";
import { getUserFromRequest } from "../middleware/auth";
import { parseBody } from "../utils/parseBody";

export async function handleUserRoutes(
  req: IncomingMessage,
  res: ServerResponse
) {
  const parsedUrl = new URL(
    req.url || "",
    `http://${req.headers.host || "localhost"}`
  );
  const path = parsedUrl.pathname;

  if (req.method === "GET" && path.match(/^\/users\/\d+\/posts$/)) {
    const userId = parseInt(path.split("/")[2]);

    try {
      const posts = await getPostsByUserId(userId);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ posts }));
      return true;
    } catch (err) {
      handleApiError(res, err, 500, "Failed to fetch posts");
      return true;
    }
  }

  if (req.method === "PUT" && path === "/me/profile") {
    const user = await getUserFromRequest(req);

    if (!user || user.role !== "admin") {
      handleApiError(res, "Unauthorized", 401);
      return true;
    }

    try {
      const body = await parseBody(req);

      await updateAdminProfile(user.id, {
        name: body.name,
        coverImageUrl: body.coverImageUrl,
        bio: body.bio,
        imageUrl: body.imageUrl,
        email: body.email,
        facebookUrl: body.facebookUrl,
        twitterUrl: body.twitterUrl,
        instagramUrl: body.instagramUrl,
        linkedinUrl: body.linkedinUrl,
      });

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ message: "Profile updated successfully" }));
      return true;
    } catch (err) {
      handleApiError(res, err, 500, "Failed to update profile");
      return true;
    }
  }

  return false;
}
