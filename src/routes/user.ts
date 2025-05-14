import { IncomingMessage, ServerResponse } from "http";
import {
  changeUserPassword,
  createAdmin,
  generatePasswordResetToken,
  getPostsByUserId,
  getPublicUserProfile,
  getUserProfile,
  resetPasswordWithToken,
  updateAdminProfile,
  updateMyProfile,
} from "../services/user";
import { handleApiError } from "../utils/error";
import { getUserFromRequest } from "../middleware/auth";
import { parseBody } from "../utils/parseBody";
import { sendResetPasswordEmail } from "../utils/email";

export async function handleUserRoutes(
  req: IncomingMessage,
  res: ServerResponse
) {
  const parsedUrl = new URL(
    req.url || "",
    `http://${req.headers.host || "localhost"}`
  );
  const path = parsedUrl.pathname;

  if (
    req.method === "GET" &&
    path.match(/^\/api\/users\/\d+\/profile-public$/)
  ) {
    const userId = parseInt(path.split("/")[3]);

    try {
      const profile = await getPublicUserProfile(userId);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(profile));
      return true;
    } catch (err) {
      handleApiError(res, err, 500, "Failed to fetch public profile");
      return true;
    }
  }

  if (
    req.method === "GET" &&
    path.startsWith("/api/users/") &&
    path.includes("/posts")
  ) {
    const userId = parseInt(path.split("/")[2]);
    const parsedUrl = new URL(
      req.url || "",
      `http://${req.headers.host || "localhost"}`
    );
    const page = parseInt(parsedUrl.searchParams.get("page") || "1");
    const limit = parseInt(parsedUrl.searchParams.get("limit") || "5");

    try {
      const posts = await getPostsByUserId(userId, page, limit);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ posts }));
      return true;
    } catch (err) {
      handleApiError(res, err, 500, "Failed to fetch posts");
      return true;
    }
  }

  if (req.method === "PUT" && path === "/api/me/profile") {
    const user = await getUserFromRequest(req);

    if (!user) {
      handleApiError(res, "Unauthorized", 401);
      return true;
    }

    try {
      const body = await parseBody(req);
      const updatedProfile = await updateMyProfile(user.id, user.role, body);

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(updatedProfile));
      return true;
    } catch (err) {
      handleApiError(res, err, 500, "Failed to update profile");
      return true;
    }
  }

  if (req.method === "GET" && path === "/api/users/profile") {
    const user = await getUserFromRequest(req);

    if (!user) {
      handleApiError(res, "Unauthorized", 401);
      return true;
    }

    try {
      const profile = await getUserProfile(user.id);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(profile));
      return true;
    } catch (err) {
      handleApiError(res, err, 500, "Failed to fetch profile");
      return true;
    }
  }

  if (req.method === "POST" && path === "/api/holders/admins") {
    const user = await getUserFromRequest(req);

    if (!user || user.role !== "holder") {
      handleApiError(res, "Unauthorized", 401);
      return true;
    }

    try {
      const body = await parseBody(req);

      if (!body.name || !body.email || !body.password) {
        handleApiError(res, "Missing required fields", 400);
        return true;
      }

      const newAdmin = await createAdmin({
        name: body.name,
        email: body.email,
        password: body.password,
        role: body.role,
      });

      res.writeHead(201, { "Content-Type": "application/json" });
      res.end(JSON.stringify(newAdmin));
      return true;
    } catch (err) {
      handleApiError(res, err, 500, "Failed to create admin");
      return true;
    }
  }

  if (req.method === "PUT" && path === "/api/me/change-password") {
    const user = await getUserFromRequest(req);

    if (!user) {
      handleApiError(res, "Unauthorized", 401);
      return true;
    }

    try {
      const body = await parseBody(req);

      if (!body.currentPassword || !body.newPassword) {
        handleApiError(res, "Missing required fields", 400);
        return true;
      }

      await changeUserPassword(user.id, body.currentPassword, body.newPassword);

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ message: "Password updated successfully" }));
      return true;
    } catch (err) {
      handleApiError(res, err, 500, "Failed to change password");
      return true;
    }
  }

  if (req.method === "POST" && path === "/api/auth/forget-password") {
    try {
      const body = await parseBody(req);

      if (!body.email) {
        handleApiError(res, "Missing email", 400);
        return true;
      }

      const token = await generatePasswordResetToken(body.email);

      await sendResetPasswordEmail(body.email, token);

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ message: "Password reset token sent" }));
      return true;
    } catch (err) {
      handleApiError(res, err, 500, "Failed to generate password reset token");
      return true;
    }
  }

  if (req.method === "POST" && path === "/api/auth/reset-password") {
    try {
      const body = await parseBody(req);

      if (!body.token || !body.newPassword) {
        handleApiError(res, "Missing required fields", 400);
        return true;
      }

      await resetPasswordWithToken(body.token, body.newPassword);

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ message: "Password reset successful" }));
      return true;
    } catch (err) {
      handleApiError(res, err, 500, "Failed to reset password");
      return true;
    }
  }

  return false;
}
