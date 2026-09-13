import type { AccountSnapshot, AccountStatus } from "./types.ts";

export class YnabError extends Error {
  readonly status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.status = status;
  }
}

interface RefreshDependencies {
  enabled: boolean;
  fetch: (previous: AccountSnapshot) => Promise<AccountSnapshot>;
  save: (snapshot: AccountSnapshot) => Promise<void>;
}

export async function preferLiveAccounts(
  previous: AccountSnapshot,
  dependencies: RefreshDependencies,
): Promise<{ snapshot: AccountSnapshot; status: AccountStatus }> {
  const fallback = (message: string) => ({
    snapshot: { ...previous, source: "snapshot" as const },
    status: { mode: "fallback" as const, message },
  });
  if (!dependencies.enabled) {
    return fallback(
      "Live YNAB is not configured. Showing the last saved balances; add YNAB_ACCESS_TOKEN to .env.local and restart to enable live loading.",
    );
  }
  let snapshot: AccountSnapshot;
  try {
    snapshot = await dependencies.fetch(previous);
  } catch (error) {
    if (!(error instanceof YnabError)) throw error;
    return fallback(
      `Live YNAB refresh was unavailable. Showing the last saved balances. ${error.message}`,
    );
  }
  // Local storage failures are not YNAB outages and must not be hidden by fallback.
  await dependencies.save(snapshot);
  return { snapshot, status: { mode: "live", message: null } };
}
