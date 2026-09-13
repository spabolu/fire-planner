import { privateHeaders, sameOrigin } from "@/lib/http";
import { saveSettings } from "@/lib/storage";
import { isSettings } from "@/lib/validation";

export async function PUT(request: Request) {
  const denied = authorizeRequest(request);
  if (denied) return denied;
  if (!sameOrigin(request))
    return Response.json(
      { error: "Same-origin requests only." },
      { status: 403 },
    );
  const text = await request.text();
  if (text.length > 50000)
    return Response.json({ error: "Settings are too large." }, { status: 413 });
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    return Response.json(
      { error: "Settings must be valid JSON." },
      { status: 400 },
    );
  }
  if (!isSettings(payload))
    return Response.json(
      { error: "Invalid settings. Check ages, amounts, and rates." },
      { status: 400 },
    );
  await saveSettings(payload);
  return Response.json({ saved: true }, { headers: privateHeaders });
}

import { authorizeRequest } from "@/lib/auth";
