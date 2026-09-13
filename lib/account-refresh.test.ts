import assert from "node:assert/strict";
import test from "node:test";
import { preferLiveAccounts, YnabError } from "./account-refresh.ts";
import type { AccountSnapshot } from "./types.ts";

const previous: AccountSnapshot = {
  planId: "test-plan",
  fetchedAt: "2026-01-01",
  source: "live",
  accounts: [],
};

test("prefers live accounts even if a saved snapshot exists, and persists the result", async () => {
  const fresh: AccountSnapshot = { ...previous, fetchedAt: "2026-01-02" };
  const calls: string[] = [];
  const result = await preferLiveAccounts(previous, {
    enabled: true,
    fetch: async (snapshot) => {
      assert.equal(snapshot, previous);
      calls.push("fetch");
      return fresh;
    },
    save: async (snapshot) => {
      assert.equal(snapshot, fresh);
      calls.push("save");
    },
  });
  assert.equal(result.snapshot, fresh);
  assert.deepEqual(calls, ["fetch", "save"]);
  assert.deepEqual(result.status, { mode: "live", message: null });
});

test("uses a visibly labeled fallback with the original timestamp on known YNAB failures", async () => {
  for (const status of [401, 429, 502, 503, 504]) {
    const result = await preferLiveAccounts(previous, {
      enabled: true,
      fetch: async () => {
        throw new YnabError(`Unavailable (${status})`, status);
      },
      save: async () => {
        assert.fail("A failed fetch must never overwrite the saved snapshot");
      },
    });
    assert.equal(result.snapshot.source, "snapshot");
    assert.equal(result.snapshot.fetchedAt, previous.fetchedAt);
    assert.equal(result.snapshot.accounts, previous.accounts);
    assert.equal(result.status.mode, "fallback");
    assert.match(result.status.message ?? "", /last saved balances/);
    assert.match(result.status.message ?? "", new RegExp(String(status)));
  }
  assert.equal(previous.source, "live");
});

test("missing credentials use fallback without requesting or saving anything", async () => {
  const result = await preferLiveAccounts(previous, {
    enabled: false,
    fetch: async () => {
      throw new Error("Must not fetch");
    },
    save: async () => {
      throw new Error("Must not save");
    },
  });
  assert.equal(result.status.mode, "fallback");
  assert.match(result.status.message ?? "", /not configured/);
});

test("unexpected bugs and local storage failures are not hidden as YNAB outages", async () => {
  const bug = new Error("Programming error");
  await assert.rejects(
    () =>
      preferLiveAccounts(previous, {
        enabled: true,
        fetch: async () => {
          throw bug;
        },
        save: async () => {},
      }),
    (error) => error === bug,
  );
  const disk = new Error("Local write failed");
  await assert.rejects(
    () =>
      preferLiveAccounts(previous, {
        enabled: true,
        fetch: async () => ({ ...previous, fetchedAt: "2026-01-02" }),
        save: async () => {
          throw disk;
        },
      }),
    (error) => error === disk,
  );
});
