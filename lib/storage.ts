import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { readDocuments, writeDocument } from "./database";
import type { AccountSnapshot, AppSettings } from "./types";
import {
  InputError,
  isSettings,
  isSnapshot,
  parsePlanningData,
} from "./validation";

const directory = path.join(process.cwd(), ".local");
async function optionalJson(filename: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(path.join(directory, filename), "utf8"));
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT")
      return null;
    throw error;
  }
}
export async function loadPlanningData() {
  const documents = process.env.DATABASE_URL ? await readDocuments() : null;
  const [seed, settings, snapshot] = documents
    ? [
        documents.get("seed"),
        documents.get("settings") ?? null,
        documents.get("accounts") ?? null,
      ]
    : await Promise.all([
        optionalJson("seed.json"),
        optionalJson("settings.json"),
        optionalJson("accounts.json"),
      ]);
  const data = parsePlanningData(seed);
  if (settings !== null) {
    if (!isSettings(settings))
      throw new InputError(
        "Saved settings are invalid; restore .local/settings.json.",
      );
    data.settings = settings;
  }
  if (snapshot !== null) {
    if (!isSnapshot(snapshot))
      throw new InputError("Saved account snapshot is invalid.");
    data.snapshot = snapshot;
  }
  return data;
}
async function atomicJson(filename: string, value: unknown) {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const temporary = path.join(directory, `.${filename}.${randomUUID()}.tmp`);
  await writeFile(temporary, JSON.stringify(value, null, 2), { mode: 0o600 });
  await rename(temporary, path.join(directory, filename));
}
export async function saveSettings(settings: AppSettings) {
  if (process.env.DATABASE_URL) return writeDocument("settings", settings);
  await atomicJson("settings.json", settings);
}
export async function saveAccounts(snapshot: AccountSnapshot) {
  if (process.env.DATABASE_URL) return writeDocument("accounts", snapshot);
  await atomicJson("accounts.json", snapshot);
}
