import { IncomingMessage, ServerResponse } from "http";
import { parseBody } from "../utils/parseBody";
import { registerUser, loginUser } from "../services/auth";
import { handleApiError } from "../utils/error";
import { getUserFromRequest } from "../middleware/auth";

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
  if (req.method === "POST" && path === "/register") {
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
  } else if (req.method === "POST" && path === "/login") {
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
      const { token, user } = await loginUser(email, password);
      res.writeHead(200, {
        "Content-Type": "application/json",
        "set-cookie": `token=${token}; HttpOnly; Path=/; Max-Age=${
          7 * 24 * 60 * 60
        }`,
      });
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
  } else if (req.method === "POST" && path === "/logout") {
    res.writeHead(200, {
      "Set-Cookie": "token=; HttpOnly; Path=/; Max-Age=0",
      "Content-Type": "application/json",
    });
    res.end(JSON.stringify({ message: "Logged out successfully" }));
    return true;
  } else if (req.method === "GET" && path === "/me") {
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
  }

  return false;
}
