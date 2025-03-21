import fs from "fs";
import path from "path";
import pool from "../config/db";

export async function runSchema() {
  try {
    const schemaPath = path.join(process.cwd(), "./schema.sql");
    const schema = fs.readFileSync(schemaPath, "utf8");
    await pool.query(schema);
    console.log("Schema applied successfully");
  } catch (err) {
    console.error("Error running schema:", err);
  }
}
