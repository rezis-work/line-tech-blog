import { IncomingMessage, ServerResponse } from "http";
import { parseBody } from "../utils/parseBody";
import { registerUser, loginUser } from "../services/auth";
import { parseCookies } from "../utils/parseCookies";
import { verifyToken } from "../utils/jwt";
import pool from "../config/db";
import { handleApiError } from "../utils/error";

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
      const { name, email, password } = await parseBody(req);
      if (!name || !email || !password) {
        res.writeHead(400);
        res.end(
          JSON.stringify({
            error: "Missing required fields",
            reqiredFileds: ["name", "email", "password"],
          })
        );
        return;
      }
      const user = await registerUser(name, email, password);
      res.writeHead(201);
      res.end(
        JSON.stringify({
          user: { ...user, password: undefined },
          message: "User registered successfully",
        })
      );
    } catch (err) {
      handleApiError(res, err, 401, "User registration failed");
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
        return;
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
    } catch (err) {
      handleApiError(res, err, 401, "Login failed");
    }
  } else if (req.method === "POST" && path === "/logout") {
    res.writeHead(200, {
      "Set-Cookie": "token=; HttpOnly; Path=/; Max-Age=0",
      "Content-Type": "application/json",
    });
    res.end(JSON.stringify({ message: "Logged out successfully" }));
  } else if (req.method === "GET" && path === "/me") {
    try {
      const cookies = parseCookies(req);
      const token = cookies.token;

      if (!token) throw new Error("Unauthorized");

      const decoded = verifyToken(token);

      const result = await pool.query(
        "SELECT id, name, email, role FROM users WHERE id = $1",
        [decoded.userId]
      );

      const user = result.rows[0];

      if (!user) throw new Error("User not found");

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ user: { ...user, password: undefined } }));
    } catch (error) {
      handleApiError(res, error, 401, "User not found");
    }
  } else {
    handleApiError(res, null, 404, "Route not found");
  }
}
