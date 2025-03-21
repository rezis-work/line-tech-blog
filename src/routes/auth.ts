import { IncomingMessage, ServerResponse } from "http";
import { parseBody } from "../utils/parseBody";
import { registerUser, loginUser } from "../services/auth";

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
        res.end(JSON.stringify({ error: "Missing required fields" }));
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
      if (err instanceof Error) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: err.message }));
      } else {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: "An unknown error occurred" }));
      }
    }
  } else if (req.method === "POST" && path === "/login") {
    try {
      const { email, password } = await parseBody(req);
      if (!email || !password) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: "Missing required fields" }));
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
      if (err instanceof Error) {
        res.statusCode = 401;
        res.end(JSON.stringify({ error: err.message }));
      } else {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: "An unknown error occurred" }));
      }
    }
  } else if (req.method === "POST" && path === "/logout") {
    res.writeHead(200, {
      "Set-Cookie": "token=; HttpOnly; Path=/; Max-Age=0",
      "Content-Type": "application/json",
    });
    res.end(JSON.stringify({ message: "Logged out successfully" }));
  } else {
    res.statusCode = 404;
    res.end(JSON.stringify({ error: "Route not found" }));
  }
}
