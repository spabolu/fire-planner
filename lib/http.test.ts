import assert from "node:assert/strict";
import test from "node:test";
import { sameOrigin } from "./http.ts";

test("same-origin checks use the browser-facing loopback host", () => {
  const request = new Request("http://localhost:3000/api/settings", {
    headers: { host: "127.0.0.1:3000", origin: "http://127.0.0.1:3000" },
  });
  assert.equal(sameOrigin(request), true);
});
test("reject missing, foreign, rebound, and mismatched origins", () => {
  for (const headers of [
    { host: "127.0.0.1:3000", origin: "" },
    { host: "127.0.0.1:3000", origin: "https://example.com" },
    { host: "127.0.0.1:3000", origin: "http://localhost:3000" },
    { host: "malicious.example", origin: "http://malicious.example" },
  ]) {
    assert.equal(
      sameOrigin(new Request("http://localhost:3000", { headers })),
      false,
    );
  }
});
