import { readFile } from "node:fs/promises";
import path from "node:path";
import { getPool } from "../lib/database.ts";
import {
  isSettings,
  isSnapshot,
  parsePlanningData,
} from "../lib/validation.ts";

const directory = path.resolve(process.argv[2] ?? ".local");
const seed = parsePlanningData(
  JSON.parse(await readFile(path.join(directory, "seed.json"), "utf8")),
);
async function optional(name) {
  try {
    return JSON.parse(
      await readFile(path.join(directory, `${name}.json`), "utf8"),
    );
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}
const settings = (await optional("settings")) ?? seed.settings;
const accounts = (await optional("accounts")) ?? seed.snapshot;
if (!isSettings(settings) || !isSnapshot(accounts))
  throw new Error("Import data is invalid; no data was changed.");
const pool = getPool();
const client = await pool.connect();
try {
  await client.query("BEGIN");
  for (const [name, value] of [
    ["seed", seed],
    ["settings", settings],
    ["accounts", accounts],
  ]) {
    await client.query(
      "INSERT INTO planner_documents (name, value) VALUES ($1, $2::jsonb) ON CONFLICT (name) DO NOTHING",
      [name, JSON.stringify(value)],
    );
  }
  await client.query("COMMIT");
  console.log(
    "Private data imported. Existing database documents were preserved.",
  );
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
