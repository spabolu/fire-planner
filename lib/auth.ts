import "server-only";
import { headers } from "next/headers";
import { accessStatus } from "./access";

export async function requireOwner() {
  const status = accessStatus(new Headers(await headers()), process.env);
  if (status !== 200)
    throw new Error("Access denied: owner authentication is required.");
}

export function authorizeRequest(request: Request): Response | null {
  const status = accessStatus(request.headers, process.env);
  return status === 200
    ? null
    : Response.json(
        {
          error:
            status === 503
              ? "Authentication is not configured."
              : "Owner authentication required.",
        },
        { status, headers: { "Cache-Control": "no-store" } },
      );
}
