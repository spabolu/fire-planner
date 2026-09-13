import { Pool } from "pg";

let pool: Pool | undefined;
export function getPool() {
  if (pool) return pool;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString)
    throw new Error("DATABASE_URL is required for PostgreSQL storage.");
  const url = new URL(connectionString);
  if (url.searchParams.has("sslmode"))
    throw new Error(
      "Configure TLS through the driver, not sslmode in DATABASE_URL.",
    );
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  pool = new Pool({
    connectionString,
    ssl: loopback ? false : { rejectUnauthorized: true },
    max: 3,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    statement_timeout: 10000,
  });
  pool.on("error", () =>
    console.error(
      "An idle PostgreSQL connection failed; the pool will replace it.",
    ),
  );
  return pool;
}

export async function readDocuments(): Promise<Map<string, unknown>> {
  const result = await getPool().query<{ name: string; value: unknown }>(
    "SELECT name, value FROM planner_documents WHERE name IN ('seed', 'settings', 'accounts')",
  );
  return new Map(result.rows.map((row) => [row.name, row.value]));
}
export async function writeDocument(
  name: "settings" | "accounts",
  value: unknown,
) {
  await getPool().query(
    `INSERT INTO planner_documents (name, value) VALUES ($1, $2::jsonb)
     ON CONFLICT (name) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [name, JSON.stringify(value)],
  );
}
