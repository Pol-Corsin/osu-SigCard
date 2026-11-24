/**
 * Typed failures from the osu! API layer. Route handlers map these to HTTP
 * responses; messages are written for end users and never contain secrets.
 */
export type OsuErrorCode =
  | "not_configured" // credentials missing on the server
  | "auth_failed" // credentials rejected by osu!
  | "invalid_username" // not a possible osu! username
  | "not_found" // no such user (or restricted)
  | "rate_limited" // osu! or our own outgoing limiter said slow down
  | "unavailable" // network error, timeout, 5xx
  | "bad_response"; // response didn't match the expected shape

export class OsuApiError extends Error {
  constructor(
    public readonly code: OsuErrorCode,
    message: string,
    public readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "OsuApiError";
  }
}

export const isOsuError = (e: unknown): e is OsuApiError => e instanceof OsuApiError;
