/**
 * Shared helpers for route handlers: bounded JSON bodies, rate limits and
 * error → response mapping. Responses never include stack traces, tokens,
 * hashes or environment details.
 */
import { CardError, type CardErrorCode } from "../cards/service";
import { ConfigError, getDb } from "../db/client";
import { OsuApiError } from "../osu/errors";
import { clientIp, osuErrorResponse } from "../osu/http";
import { rateLimit, type RateRule } from "../security/rateLimit";
import { hashIp } from "../security/tokens";

export const NO_STORE = { "Cache-Control": "no-store" };

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

/** Reads a JSON body with a hard size cap (checked on the actual bytes, not just Content-Length). */
export async function readJson(request: Request, maxBytes = 16_384): Promise<unknown> {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > maxBytes) throw new HttpError(413, "too_large", "Request is too large.");
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "bad_request", "Request body is missing.");
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new HttpError(413, "too_large", "Request is too large.");
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HttpError(400, "bad_request", "Request body must be valid JSON.");
  }
}

/** Applies a persistent rate limit; throws a 429 HttpError when exceeded. */
export async function limit(request: Request, rule: RateRule, extraKey = ""): Promise<void> {
  const db = await getDb();
  const subject = `${hashIp(clientIp(request))}${extraKey ? ":" + extraKey : ""}`;
  const r = await rateLimit(db, rule, subject);
  if (!r.ok) {
    const e = new HttpError(429, "rate_limited", `Too many requests. Try again in ${formatWait(r.retryAfter)}.`);
    (e as HttpError & { retryAfter?: number }).retryAfter = r.retryAfter;
    throw e;
  }
}

const formatWait = (s: number) => (s < 90 ? `${s} seconds` : `${Math.ceil(s / 60)} minutes`);

const CARD_STATUS: Record<CardErrorCode, number> = {
  invalid_config: 400,
  sample_player: 400,
  player_mismatch: 400,
  not_found: 404,
  unauthorized: 401,
  conflict: 409,
  token_rotated: 409,
};

export function errorResponse(err: unknown): Response {
  if (err instanceof OsuApiError) return osuErrorResponse(err);
  if (err instanceof CardError) {
    return Response.json({ error: { code: err.code, message: err.message } }, { status: CARD_STATUS[err.code], headers: NO_STORE });
  }
  if (err instanceof HttpError) {
    const retryAfter = (err as HttpError & { retryAfter?: number }).retryAfter;
    return Response.json(
      { error: { code: err.code, message: err.message, retryAfter: retryAfter ?? null } },
      { status: err.status, headers: { ...NO_STORE, ...(retryAfter ? { "Retry-After": String(retryAfter) } : {}) } },
    );
  }
  if (err instanceof ConfigError) {
    console.error("[config]", err.message);
    return Response.json(
      { error: { code: "not_configured", message: "Publishing isn't set up on this server yet." } },
      { status: 503, headers: NO_STORE },
    );
  }
  console.error("[server] unexpected error:", err instanceof Error ? `${err.name}: ${err.message}` : "unknown");
  return Response.json({ error: { code: "server_error", message: "Something went wrong on our side. Try again." } }, { status: 500, headers: NO_STORE });
}

/**
 * Like limit(), but for read-only endpoints that must keep working before a
 * database is configured: configuration/database errors skip the check
 * (those routes also keep their per-instance in-memory limiter).
 */
export async function softLimit(request: Request, rule: RateRule): Promise<void> {
  try {
    await limit(request, rule);
  } catch (e) {
    if (e instanceof HttpError) throw e;
    if (!(e instanceof ConfigError)) console.error("[rate-limit] skipped:", (e as Error).message);
  }
}
