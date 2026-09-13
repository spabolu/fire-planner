import { type NextRequest, NextResponse } from "next/server";
import { accessStatus } from "./lib/access";

export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === "/api/health") return NextResponse.next();
  const status = accessStatus(request.headers, process.env);
  if (status !== 200)
    return new NextResponse(
      status === 503
        ? "Authentication is not configured."
        : "Owner authentication required.",
      { status, headers: { "Cache-Control": "no-store" } },
    );
  const response = NextResponse.next();
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
