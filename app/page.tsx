import { connection } from "next/server";
import { Dashboard } from "@/components/dashboard";
import { preferLiveAccounts } from "@/lib/account-refresh";
import { requireOwner } from "@/lib/auth";
import { loadPlanningData, saveAccounts } from "@/lib/storage";
import { fetchAccounts, liveYnabEnabled } from "@/lib/ynab";

export default async function Home() {
  await connection();
  await requireOwner();
  const data = await loadPlanningData();
  const enabled = liveYnabEnabled();
  const accounts = await preferLiveAccounts(data.snapshot, {
    enabled,
    fetch: fetchAccounts,
    save: saveAccounts,
  });
  data.snapshot = accounts.snapshot;
  return (
    <Dashboard
      initialData={data}
      initialAccountStatus={accounts.status}
      liveYnabEnabled={enabled}
    />
  );
}
