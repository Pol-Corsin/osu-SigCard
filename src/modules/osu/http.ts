/** Maps osu! layer failures to HTTP responses with user-facing messages. */
import { OsuApiError, type OsuErrorCode } from "./errors";

const STATUS: Record<OsuErrorCode, number> = {
  not_configured: 503,
  auth_failed: 503,
  invalid_username: 400,
  not_found: 404,
  rate_limited: 429,
  unavailable: 503,
  bad_response: 502,
};

export function osuErrorResponse(err: unknown): Response {
  const e = err instanceof OsuApiError ? err : new OsuApiError("unavailable", "Something went wrong loading that player.");
  if (e.code === "auth_failed" || e.code === "bad_response" || !(err instanceof OsuApiError)) {
    console.error("[osu]", e.code, err);
  }
  // Credential problems are an operator issue; don't describe server config to visitors.
  const message = e.code === "auth_failed" ? "Live osu! lookups are temporarily unavailable. Sample players still work." : e.message;
  const headers: Record<string, string> = { "Cache-Control": "no-store" };
  if (e.retryAfterSeconds) headers["Retry-After"] = String(e.retryAfterSeconds);
  return Response.json({ error: { code: e.code, message, retryAfter: e.retryAfterSeconds ?? null } }, { status: STATUS[e.code], headers });
}

export function clientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}
