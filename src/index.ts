import { startServer } from "./server";
import pool from "./config/db";

async function init() {
  try {
    const result = await pool.query("SELECT NOW()");
    console.log("Database connected:", result.rows[0].now);
    startServer();
  } catch (err) {
    console.error("Error initializing the application:", err);
  }
}

init();
