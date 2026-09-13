import type { Account, AccountKind } from "./types.ts";

export const ACCOUNT_KINDS: readonly AccountKind[] = [
  "cash",
  "taxable",
  "retirement",
  "hsa",
  "vehicle",
  "property",
  "other",
  "debt",
];

export function accountTotals(
  accounts: Account[],
  overrides: Record<string, AccountKind>,
  includeHsa: boolean,
  reserveDebt: boolean,
) {
  let assets = 0;
  let liabilities = 0;
  let investments = 0;
  let cash = 0;
  let accessible = 0;
  let restricted = 0;
  let loanMinimums = 0;
  for (const account of accounts) {
    const kind = overrides[account.id] ?? account.kind;
    const positive = Math.max(0, account.balance);
    assets += positive;
    liabilities += Math.max(0, -account.balance);
    if (kind === "cash") cash += positive;
    if (kind === "taxable") accessible += positive;
    if (kind === "retirement" || (kind === "hsa" && includeHsa))
      restricted += positive;
    if (
      kind === "taxable" ||
      kind === "retirement" ||
      (kind === "hsa" && includeHsa)
    ) {
      investments += positive;
    }
    if (account.balance < 0) loanMinimums += account.minimumPayment ?? 0;
  }
  const debtReserve = reserveDebt ? liabilities : 0;
  return {
    assets,
    liabilities,
    netWorth: assets - liabilities,
    cash,
    investments,
    accessible,
    restricted,
    loanMinimums,
    debtReserve,
    startingPortfolio: Math.max(0, investments - debtReserve),
    accessibleAfterDebt: Math.max(0, accessible - debtReserve),
  };
}
