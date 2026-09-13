import { chmod, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { InputError, parsePlanningData } from "../lib/validation.ts";

const cwd = process.cwd();
const localDirectory = path.join(cwd, ".local");
const examplePath = path.join(cwd, "data", "example-seed.json");
const seedPath = path.join(localDirectory, "seed.json");

function relative(target) {
  return path.relative(cwd, target) || ".";
}

async function ensureDirectory(directory) {
  try {
    const info = await stat(directory);
    if (!info.isDirectory()) {
      throw new Error(`${relative(directory)} exists but is not a directory.`);
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    await mkdir(directory, { recursive: true, mode: 0o700 });
  }
  await chmod(directory, 0o700);
}

async function existingSeed() {
  try {
    const info = await stat(seedPath);
    if (!info.isFile()) {
      throw new Error(`${relative(seedPath)} exists but is not a file.`);
    }
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

async function loadExample() {
  const raw = await readFile(examplePath, "utf8");
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`${relative(examplePath)} is not valid JSON.`);
    }
    throw error;
  }
  try {
    return parsePlanningData(parsed);
  } catch (error) {
    if (error instanceof InputError) {
      throw new Error(
        `${relative(examplePath)} does not match the planning-data schema.`,
      );
    }
    throw error;
  }
}

function appDataNotice() {
  return process.env.APP_DATA_DIR
    ? `Detected APP_DATA_DIR=${process.env.APP_DATA_DIR}; setup ignores it and always uses ${relative(localDirectory)} for private local setup.`
    : null;
}

async function main() {
  const example = await loadExample();
  await ensureDirectory(localDirectory);

  const ignoredAppDataDir = appDataNotice();
  if (await existingSeed()) {
    console.log(
      [
        `Preserved existing ${relative(seedPath)}; setup did not overwrite local data.`,
        ignoredAppDataDir,
      ]
        .filter(Boolean)
        .join("\n"),
    );
    return;
  }

  await writeFile(seedPath, `${JSON.stringify(example, null, 2)}\n`, {
    flag: "wx",
    mode: 0o600,
  });
  await chmod(seedPath, 0o600);

  console.log(
    [
      `Created ${relative(seedPath)} from ${relative(examplePath)}.`,
      "The bundled seed is fictional example data; replace it privately before relying on planner output.",
      ignoredAppDataDir,
    ]
      .filter(Boolean)
      .join("\n"),
  );
}

try {
  await main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Setup failed: ${message}`);
  process.exitCode = 1;
}
