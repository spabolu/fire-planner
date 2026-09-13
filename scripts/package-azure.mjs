import { cp, mkdir, readdir, readlink, rm, stat } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const source = path.join(root, ".next/standalone");
const target = path.join(root, ".artifacts/deploy");
const forbidden = (name) =>
  name === ".git" ||
  name === ".local" ||
  /^\.env(?:\.|$)/.test(name) ||
  /\.(?:pdf|sqlite\d?|db)$/i.test(name);
async function check(directory, boundary = directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (forbidden(entry.name))
      throw new Error(
        `Refusing to package private file or directory: ${entry.name}`,
      );
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) await check(filename, boundary);
    if (entry.isSymbolicLink()) {
      const link = await readlink(filename);
      const resolved = path.resolve(directory, link);
      if (
        path.isAbsolute(link) ||
        !resolved.startsWith(`${boundary}${path.sep}`)
      ) {
        throw new Error(
          `Refusing a symlink outside the release: ${entry.name}`,
        );
      }
    }
  }
}
await stat(source);
await check(source);
await check(path.join(root, "public"));
await rm(target, { recursive: true, force: true });
await mkdir(target, { recursive: true });
await cp(source, target, { recursive: true, verbatimSymlinks: true });
await cp(path.join(root, ".next/static"), path.join(target, ".next/static"), {
  recursive: true,
});
await cp(path.join(root, "public"), path.join(target, "public"), {
  recursive: true,
});
await cp(path.join(root, "migrations"), path.join(target, "migrations"), {
  recursive: true,
});
await mkdir(path.join(target, "scripts"), { recursive: true });
await cp(
  path.join(root, "scripts/migrate.mjs"),
  path.join(target, "scripts/migrate.mjs"),
);
await check(target);
console.log("Public-safe standalone artifact prepared in .artifacts/deploy.");
