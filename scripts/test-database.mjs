import assert from "node:assert/strict";
import { getPool, readDocuments, writeDocument } from "../lib/database.ts";

const pool = getPool();
try {
  const name = await pool.query("SELECT current_database() AS name");
  if (name.rows[0]?.name !== "planner_test")
    throw new Error(
      "Integration tests require the dedicated planner_test database.",
    );
  const value = { fictional: true, revision: 1 };
  await writeDocument("settings", value);
  assert.deepEqual((await readDocuments()).get("settings"), value);
  await writeDocument("settings", { ...value, revision: 2 });
  assert.equal((await readDocuments()).get("settings").revision, 2);
  await writeDocument("accounts", { fictional: true, accounts: [] });
  assert.equal((await readDocuments()).get("accounts").accounts.length, 0);
  await pool.query(
    "DELETE FROM planner_documents WHERE name IN ('settings', 'accounts')",
  );
  console.log("PostgreSQL document persistence passed.");
} finally {
  await pool.end();
}
