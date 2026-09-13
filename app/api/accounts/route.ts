import { privateHeaders, sameOrigin } from "@/lib/http";
import { loadPlanningData, saveAccounts } from "@/lib/storage";
import { fetchAccounts, YnabError } from "@/lib/ynab";

export async function POST(request: Request) {
  const denied = authorizeRequest(request);
  if (denied) return denied;
  if (!sameOrigin(request))
    return Response.json(
      { error: "Same-origin requests only." },
      { status: 403 },
    );
  const data = await loadPlanningData();
  try {
    const snapshot = await fetchAccounts(data.snapshot);
    await saveAccounts(snapshot);
    return Response.json(snapshot, { headers: privateHeaders });
  } catch (error) {
    if (error instanceof YnabError)
      return Response.json({ error: error.message }, { status: error.status });
    if (
      error instanceof Error &&
      ["TimeoutError", "AbortError"].includes(error.name)
    ) {
      return Response.json(
        { error: "YNAB timed out. Your snapshot is unchanged." },
        { status: 504 },
      );
    }
    throw error;
  }
}

import { authorizeRequest } from "@/lib/auth";
