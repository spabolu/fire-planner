import { execFileSync } from "node:child_process";
import { mkdtemp, rm, rmdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const [resourceGroup, appName, objectId] = process.argv.slice(2);
if (!resourceGroup || !appName || !/^[0-9a-f-]{36}$/i.test(objectId ?? "")) {
  throw new Error(
    "Usage: node scripts/azure-allow-user.mjs <resource-group> <app-name> <tenant-user-object-id>",
  );
}
function az(args) {
  return execFileSync("az", [...args, "--only-show-errors", "-o", "json"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}
const user = JSON.parse(
  az(["ad", "user", "show", "--id", objectId, "--query", "{id:id}"]),
);
if (user.id !== objectId)
  throw new Error("The user is not present in the active Azure tenant.");
const app = JSON.parse(
  az([
    "webapp",
    "show",
    "-g",
    resourceGroup,
    "-n",
    appName,
    "--query",
    "{id:id}",
  ]),
);
const url = `https://management.azure.com${app.id}/config/authsettingsV2?api-version=2024-11-01`;
const auth = JSON.parse(az(["rest", "--method", "get", "--url", url]));
const aad = auth.properties?.identityProviders?.azureActiveDirectory;
if (
  !auth.properties?.platform?.enabled ||
  !auth.properties?.globalValidation?.requireAuthentication ||
  !aad?.enabled
) {
  throw new Error(
    "Required App Service authentication must be enabled before granting access.",
  );
}
const ids =
  aad.validation?.defaultAuthorizationPolicy?.allowedPrincipals?.identities;
if (!Array.isArray(ids) || ids.length === 0)
  throw new Error("A nonempty existing owner allowlist is required.");
const allowed = [...new Set([...ids, objectId])];
if (allowed.join("").length > 500)
  throw new Error("Azure's identity allowlist limit would be exceeded.");
aad.validation.defaultAuthorizationPolicy.allowedPrincipals.identities =
  allowed;
const dir = await mkdtemp(path.join(os.tmpdir(), "planner-allow-user-"));
const filename = path.join(dir, "auth.json");
try {
  await writeFile(filename, JSON.stringify({ properties: auth.properties }), {
    mode: 0o600,
  });
  az(["rest", "--method", "put", "--url", url, "--body", `@${filename}`]);
  az([
    "webapp",
    "config",
    "appsettings",
    "set",
    "-g",
    resourceGroup,
    "-n",
    appName,
    "--settings",
    `APP_ALLOWED_PRINCIPAL_IDS=${allowed.join(",")}`,
    "--query",
    "[?name=='APP_ALLOWED_PRINCIPAL_IDS'].name",
  ]);
  console.log(
    "Access granted to this tenant user for the shared planner. Also retain the ID in your private infrastructure parameters.",
  );
} finally {
  await rm(filename, { force: true });
  await rmdir(dir);
}
