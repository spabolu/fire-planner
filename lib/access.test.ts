import assert from "node:assert/strict";
import test from "node:test";
import { accessStatus } from "./access.ts";
import { sameOrigin } from "./http.ts";

test("Azure denies missing configuration, missing identity and non-owner accounts", () => {
  const headers = new Headers({ host: "app.azurewebsites.net" });
  assert.equal(accessStatus(headers, { WEBSITE_SITE_NAME: "app" }), 503);
  const env = {
    APP_AUTH_MODE: "azure",
    APP_ALLOWED_PRINCIPAL_ID: "owner",
    WEBSITE_SITE_NAME: "app",
  };
  assert.equal(accessStatus(headers, env), 401);
  headers.set("x-ms-client-principal-id", "someone-else");
  headers.set("x-ms-client-principal-idp", "aad");
  assert.equal(accessStatus(headers, env), 403);
  headers.set("x-ms-client-principal-id", "owner");
  assert.equal(accessStatus(headers, env), 200);
  headers.set("x-ms-client-principal-idp", "github");
  assert.equal(accessStatus(headers, env), 403);
  assert.equal(accessStatus(headers, { ...env, APP_AUTH_MODE: "local" }), 503);
});
test("local mode never accepts an arbitrary public host", () => {
  assert.equal(accessStatus(new Headers({ host: "127.0.0.1:3000" }), {}), 200);
  assert.equal(accessStatus(new Headers({ host: "public.example" }), {}), 403);
});

test("explicit additional users can access the shared app; other tenant users cannot", () => {
  const env = {
    APP_AUTH_MODE: "azure",
    APP_ALLOWED_PRINCIPAL_IDS: "owner, invited-user",
  };
  const headers = new Headers({
    "x-ms-client-principal-idp": "aad",
    "x-ms-client-principal-id": "invited-user",
  });
  assert.equal(accessStatus(headers, env), 200);
  headers.set("x-ms-client-principal-id", "other-user");
  assert.equal(accessStatus(headers, env), 403);
  assert.equal(
    accessStatus(headers, { ...env, APP_ALLOWED_PRINCIPAL_IDS: " , " }),
    503,
  );
});
test("cloud write origin must match the configured HTTPS origin exactly", () => {
  const request = (origin: string) =>
    new Request("http://localhost:8080/api/settings", {
      headers: { origin, host: "app.azurewebsites.net" },
    });
  assert.equal(
    sameOrigin(
      request("https://app.azurewebsites.net"),
      "https://app.azurewebsites.net",
    ),
    true,
  );
  assert.equal(
    sameOrigin(
      request("https://evil.example"),
      "https://app.azurewebsites.net",
    ),
    false,
  );
  assert.equal(
    sameOrigin(
      request("http://app.azurewebsites.net"),
      "https://app.azurewebsites.net",
    ),
    false,
  );
});
