export function sameOrigin(
  request: Request,
  configuredOrigin = process.env.APP_ORIGIN,
) {
  const origin = request.headers.get("origin");
  if (configuredOrigin)
    return (
      origin === configuredOrigin && /^https:\/\/[^/]+$/.test(configuredOrigin)
    );
  const host = request.headers.get("host");
  if (
    !origin ||
    !host ||
    !/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(host)
  ) {
    return false;
  }
  // Next's internal request URL can use localhost even when the browser uses 127.0.0.1.
  return origin === `http://${host}` || origin === `https://${host}`;
}
export const privateHeaders = { "Cache-Control": "private, no-store" };
