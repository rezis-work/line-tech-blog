import { IncomingMessage, ServerResponse } from "http";
import { parseBody } from "../utils/parseBody";
import {
  registerUser,
  loginUser,
  refreshAccessToken,
  logoutUser,
} from "../services/auth";
import { handleApiError } from "../utils/error";
import { getUserFromRequest } from "../middleware/auth";
import { getPostsByUserId, updateUserProfile } from "../services/user";
import { createCookie } from "../utils/cookie";

export async function handleAuthRoutes(
  req: IncomingMessage,
  res: ServerResponse
) {
  res.setHeader("Content-Type", "application/json");

  const parsedUrl = new URL(
    req.url || "",
    `http://${req.headers.host || "localhost"}`
  );
  const path = parsedUrl.pathname;
  if (req.method === "POST" && path === "/api/register") {
    try {
      const { name, email, password, role } = await parseBody(req);
      if (!name || !email || !password) {
        res.writeHead(400);
        res.end(
          JSON.stringify({
            error: "Missing required fields",
            reqiredFileds: ["name", "email", "password"],
          })
        );
        return true;
      }
      const user = await registerUser(name, email, password, role);
      res.writeHead(201);
      res.end(
        JSON.stringify({
          user: { ...user, password: undefined },
          message: "User registered successfully",
        })
      );
      return true;
    } catch (err) {
      handleApiError(res, err, 401, "User registration failed");
      return true;
    }
  } else if (req.method === "POST" && path === "/api/login") {
    try {
      const { email, password } = await parseBody(req);
      if (!email || !password) {
        res.writeHead(400);
        res.end(
          JSON.stringify({
            error: "Missing required fields",
            reqiredFileds: ["email", "password"],
          })
        );
        return true;
      }
      const { accessToken, refreshToken, user } = await loginUser(
        email,
        password
      );
      const isProduction = process.env.NODE_ENV === "production";

      res.setHeader("Set-Cookie", [
        createCookie("token", accessToken, {
          maxAge: 60 * 60, // 1h
          httpOnly: true,
          sameSite: "Strict",
          secure: isProduction,
          path: "/",
        }),
        createCookie("refreshToken", refreshToken, {
          maxAge: 7 * 24 * 60 * 60, // 7d
          httpOnly: true,
          sameSite: "Strict",
          secure: isProduction,
          path: "/",
        }),
      ]);
      res.end(
        JSON.stringify({
          user: { ...user, password: undefined },
          message: "Logged in successfully",
        })
      );
      return true;
    } catch (err) {
      handleApiError(res, err, 401, "Login failed");
      return true;
    }
  } else if (req.method === "POST" && path === "/api/refresh") {
    try {
      const { refreshToken } = await parseBody(req);
      if (!refreshToken) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: "Missing refresh token" }));
        return true;
      }

      const { accessToken } = await refreshAccessToken(refreshToken);

      res.writeHead(200, {
        "Content-Type": "application/json",
        "Set-Cookie": createCookie("token", accessToken, { maxAge: 60 * 60 }),
      });
      res.end(JSON.stringify({ accessToken }));
      return true;
    } catch (error) {
      handleApiError(res, error, 401, "Refresh token expired");
      return true;
    }
  } else if (req.method === "POST" && path === "/api/logout") {
    try {
      const refreshToken = req.headers.cookie
        ?.split("; ")
        .find((row) => row.startsWith("refreshToken="))
        ?.split("=")[1];
      if (refreshToken) {
        await logoutUser(refreshToken);
      }
      res.writeHead(200, {
        "Content-Type": "application/json",
        "Set-Cookie": [
          "token=; HttpOnly; Path=/; Max-Age=0",
          "refreshToken=; HttpOnly; Path=/; Max-Age=0",
        ],
      });
      res.end(JSON.stringify({ message: "Logged out successfully" }));
      return true;
    } catch (error) {
      handleApiError(res, error, 401, "Logout failed");
      return true;
    }
  } else if (req.method === "GET" && path === "/api/me") {
    try {
      const authorizedUser = await getUserFromRequest(req);

      if (!authorizedUser) {
        handleApiError(res, null, 401, "Unauthorized");
        return true;
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({ user: { ...authorizedUser, password: undefined } })
      );
      return true;
    } catch (error) {
      handleApiError(res, error, 401, "User not found");
      return true;
    }
  } else if (req.method === "GET" && path === "/api/me/posts") {
    const user = await getUserFromRequest(req);
    if (!user) {
      handleApiError(res, null, 401, "Unauthorized");
      return true;
    }

    try {
      const posts = await getPostsByUserId(user.id);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ posts }));
      return true;
    } catch (err) {
      handleApiError(res, err, 500, "Failed to fetch posts");
      return true;
    }
  } else if (req.method === "PUT" && path === "/api/me") {
    const user = await getUserFromRequest(req);
    if (!user) {
      handleApiError(res, null, 401, "Unauthorized");
      return true;
    }

    try {
      const { name, image_url, email } = await parseBody(req);

      const updatedUser = await updateUserProfile(
        user.id,
        name,
        image_url,
        email
      );

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(updatedUser));
      return true;
    } catch (error) {
      handleApiError(res, error, 500, "Failed to update profile");
      return true;
    }
  }

  return false;
}
