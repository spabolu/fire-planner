interface AccessEnvironment {
  [key: string]: string | undefined;
  APP_AUTH_MODE?: string;
  APP_ALLOWED_PRINCIPAL_ID?: string;
  APP_ALLOWED_PRINCIPAL_IDS?: string;
  WEBSITE_SITE_NAME?: string;
}

export function accessStatus(
  headers: Headers,
  env: AccessEnvironment,
): 200 | 401 | 403 | 503 {
  const cloud = Boolean(env.WEBSITE_SITE_NAME) || env.APP_AUTH_MODE === "azure";
  if (cloud) {
    const allowed = (
      env.APP_ALLOWED_PRINCIPAL_IDS ??
      env.APP_ALLOWED_PRINCIPAL_ID ??
      ""
    )
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
    if (env.APP_AUTH_MODE !== "azure" || allowed.length === 0) return 503;
    // These headers are trustworthy only behind Azure App Service Easy Auth.
    // Platform authentication and its owner allowlist must also be enabled.
    const principal = headers.get("x-ms-client-principal-id");
    if (!principal) return 401;
    if (
      headers.get("x-ms-client-principal-idp") !== "aad" ||
      !allowed.includes(principal)
    )
      return 403;
    return 200;
  }
  if (env.APP_AUTH_MODE && env.APP_AUTH_MODE !== "local") return 503;
  return /^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(
    headers.get("host") ?? "",
  )
    ? 200
    : 403;
}
