import { readFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL must be configured.");
const url = new URL(connectionString);
if (url.searchParams.has("sslmode"))
  throw new Error(
    "Remove sslmode from DATABASE_URL; TLS is certificate-verified by this script.",
  );
const client = new pg.Client({
  connectionString,
  ssl: ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
    ? false
    : { rejectUnauthorized: true },
  connectionTimeoutMillis: 10000,
});
await client.connect();
try {
  await client.query(
    await readFile(
      path.join(import.meta.dirname, "../migrations/001_documents.sql"),
      "utf8",
    ),
  );
  console.log("Database schema is ready. Existing data was preserved.");
} finally {
  await client.end();
}
