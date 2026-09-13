import assert from "node:assert/strict";
import test from "node:test";
import { accountTotals } from "./accounts.ts";
import type { Account } from "./types.ts";
import { isAccountKind, isSnapshot, parsePlanningData } from "./validation.ts";

function account(id: string, kind: Account["kind"], balance: number): Account {
  return {
    id,
    name: id,
    kind,
    balance,
    type: "otherAsset",
    clearedBalance: balance,
    unclearedBalance: 0,
    onBudget: false,
    closed: false,
    lastReconciledAt: null,
    importError: false,
    apr: null,
    minimumPayment: null,
  };
}
test("net worth is distinct from investable and accessible capital", () => {
  const accounts = [
    account("cash", "cash", 5000),
    account("car", "vehicle", 12000),
    account("taxable", "taxable", 20000),
    account("retirement", "retirement", 30000),
    account("hsa", "hsa", 1000),
    account("loan", "debt", -8000),
  ];
  const result = accountTotals(accounts, {}, true, true);
  assert.equal(result.netWorth, 60000);
  assert.equal(result.investments, 51000);
  assert.equal(result.startingPortfolio, 43000);
  assert.equal(result.accessibleAfterDebt, 12000);
  assert.equal(
    accountTotals(accounts, {}, false, true).startingPortfolio,
    42000,
  );
  assert.equal(
    accountTotals(accounts, {}, true, false).startingPortfolio,
    51000,
  );
});
test("negative balances remain liabilities even if misclassified", () => {
  const a = [account("a", "taxable", 1000), account("b", "cash", -1500)];
  const result = accountTotals(a, { b: "taxable" }, true, true);
  assert.equal(result.liabilities, 1500);
  assert.equal(result.startingPortfolio, 0);
  assert.equal(result.netWorth, -500);
});
test("data validation rejects malformed and duplicate snapshots", () => {
  const a = account("a", "cash", 100);
  const base = {
    planId: "p",
    fetchedAt: "2026-01-01",
    source: "snapshot",
    accounts: [a],
  };
  assert.equal(isSnapshot(base), true);
  assert.equal(isSnapshot({ ...base, accounts: [a, a] }), false);
  assert.equal(
    isSnapshot({ ...base, accounts: [{ ...a, balance: NaN }] }),
    false,
  );
  assert.equal(isAccountKind("pretend-investment"), false);
  assert.throws(() => parsePlanningData(null), /missing or invalid/);
});
