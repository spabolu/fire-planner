import "server-only";
import { YnabError } from "./account-refresh";
import type { Account, AccountKind, AccountSnapshot } from "./types";
import { isRecord, isSnapshot } from "./validation";

export { YnabError } from "./account-refresh";

function numeric(record: Record<string, unknown>, key: string) {
  const value = record[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new YnabError(`YNAB returned an invalid ${key} field.`);
  }
  return value;
}
function latestRate(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (!isRecord(value)) throw new YnabError("Invalid YNAB loan metadata.");
  const keys = Object.keys(value).sort();
  const newest = keys.at(-1);
  if (!newest) return null;
  const result = value[newest];
  if (typeof result !== "number" || !Number.isFinite(result))
    throw new YnabError("Invalid YNAB loan metadata.");
  return result / 1000;
}
function defaultKind(type: string, balance: number): AccountKind {
  if (
    balance < 0 ||
    [
      "creditCard",
      "studentLoan",
      "autoLoan",
      "mortgage",
      "otherLiability",
    ].includes(type)
  )
    return "debt";
  if (["checking", "savings", "cash"].includes(type)) return "cash";
  return "other";
}
export const liveYnabEnabled = () => Boolean(process.env.YNAB_ACCESS_TOKEN);

export async function fetchAccounts(
  previous: AccountSnapshot,
): Promise<AccountSnapshot> {
  const token = process.env.YNAB_ACCESS_TOKEN;
  if (!token)
    throw new YnabError(
      "Live refresh is not configured. Add YNAB_ACCESS_TOKEN to .env.local, or ask the CLI to update the local snapshot. Your current snapshot is unchanged.",
      409,
    );
  let response: Response;
  try {
    response = await fetch(
      `https://api.ynab.com/v1/plans/${encodeURIComponent(previous.planId)}/accounts`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      },
    );
  } catch (error) {
    if (
      error instanceof Error &&
      ["TimeoutError", "AbortError"].includes(error.name)
    ) {
      throw new YnabError(
        "YNAB timed out. The saved snapshot is unchanged.",
        504,
      );
    }
    if (error instanceof TypeError) {
      throw new YnabError(
        "Could not connect to YNAB. The saved snapshot is unchanged.",
        503,
      );
    }
    throw error;
  }
  if (!response.ok)
    throw new YnabError(
      `YNAB returned HTTP ${response.status}. The existing snapshot has not been replaced.`,
    );
  let payload: unknown;
  try {
    payload = await response.json();
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof TypeError) {
      throw new YnabError(
        "YNAB returned an unreadable response. The saved snapshot is unchanged.",
      );
    }
    if (
      error instanceof Error &&
      ["TimeoutError", "AbortError"].includes(error.name)
    ) {
      throw new YnabError(
        "Reading YNAB's response timed out. The saved snapshot is unchanged.",
        504,
      );
    }
    throw error;
  }
  if (
    !isRecord(payload) ||
    !isRecord(payload.data) ||
    !Array.isArray(payload.data.accounts)
  ) {
    throw new YnabError("YNAB returned an unexpected account response.");
  }
  const known = new Map(
    previous.accounts.map((account) => [account.id, account.kind]),
  );
  const accounts: Account[] = [];
  for (const raw of payload.data.accounts) {
    if (!isRecord(raw)) throw new YnabError("Invalid YNAB account object.");
    if (raw.deleted === true) continue;
    if (
      typeof raw.id !== "string" ||
      typeof raw.name !== "string" ||
      typeof raw.type !== "string"
    ) {
      throw new YnabError("YNAB returned an account without identifiers.");
    }
    const balance = numeric(raw, "balance") / 1000;
    accounts.push({
      id: raw.id,
      name: raw.name.replace(/\s*[\u2013\u2014-]\s*\d{4}\s*$/, ""),
      type: raw.type,
      kind: known.get(raw.id) ?? defaultKind(raw.type, balance),
      balance,
      clearedBalance: numeric(raw, "cleared_balance") / 1000,
      unclearedBalance: numeric(raw, "uncleared_balance") / 1000,
      onBudget: raw.on_budget === true,
      closed: raw.closed === true,
      lastReconciledAt:
        typeof raw.last_reconciled_at === "string"
          ? raw.last_reconciled_at
          : null,
      importError: raw.direct_import_in_error === true,
      apr: latestRate(raw.debt_interest_rates),
      minimumPayment: latestRate(raw.debt_minimum_payments),
    });
  }
  const snapshot: AccountSnapshot = {
    planId: previous.planId,
    fetchedAt: new Date().toISOString(),
    source: "live",
    accounts,
  };
  if (!isSnapshot(snapshot)) {
    throw new YnabError(
      "YNAB returned an invalid account snapshot. The saved balances are unchanged.",
    );
  }
  return snapshot;
}
