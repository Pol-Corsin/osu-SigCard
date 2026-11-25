/**
 * Public IDs, private edit tokens and keyed hashes.
 *
 * - Public card IDs: 10 random base62 chars (~59 bits). Public, not secret.
 * - Edit tokens: 256-bit secrets, base64url (43 chars). Never stored; the
 *   database keeps HMAC-SHA256(EDIT_TOKEN_SECRET, token) only.
 * - A publish request's idempotency key deterministically derives the first
 *   edit token (HMAC with the server secret), so a retried publish returns
 *   the same working edit link instead of creating a duplicate card.
 */
import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { ConfigError, isHostedDeployment } from "../db/client";

const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
export const PUBLIC_ID_RE = /^[0-9A-Za-z]{10}$/;
export const EDIT_TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;
export const PUBLISH_KEY_RE = /^[A-Za-z0-9_-]{22,64}$/;

const DEV_SECRET = "dev-only-edit-token-secret-do-not-use-in-production!!";
let warned = false;

export function editSecret(): string {
  const s = process.env.EDIT_TOKEN_SECRET?.trim();
  if (s && s.length >= 32) return s;
  if (s) throw new ConfigError("EDIT_TOKEN_SECRET must be at least 32 characters.");
  if (isHostedDeployment()) throw new ConfigError("EDIT_TOKEN_SECRET is not set.");
  if (!warned) {
    warned = true;
    console.warn("[security] EDIT_TOKEN_SECRET is not set; using a development-only secret.");
  }
  return DEV_SECRET;
}

const hmac = (label: string, value: string) => createHmac("sha256", editSecret()).update(`${label}\u0000${value}`).digest("base64url");

export function newPublicId(): string {
  let id = "";
  for (let i = 0; i < 10; i++) id += BASE62[randomInt(62)];
  return id;
}

export const randomEditToken = () => randomBytes(32).toString("base64url");

export const deriveEditToken = (publicId: string, publishKey: string) => hmac("edit-token:v1", `${publicId}:${publishKey}`);

export const hashEditToken = (token: string) => hmac("edit-token-hash:v1", token);

export const hashPublishKey = (key: string) => hmac("publish-key:v1", key);

/** Hashed client IP for rate-limit buckets (raw IPs are never stored). */
export const hashIp = (ip: string) => hmac("ip:v1", ip).slice(0, 22);

/** Constant-time check of a presented token against a stored hash. */
export function verifyEditToken(token: string | null | undefined, storedHash: string): boolean {
  if (!token || !EDIT_TOKEN_RE.test(token)) return false;
  const a = Buffer.from(hashEditToken(token));
  const b = Buffer.from(storedHash);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Extracts the token from an `Authorization: Bearer <token>` header. */
export function bearerToken(request: Request): string | null {
  const h = request.headers.get("authorization");
  const m = h ? /^Bearer\s+(\S+)$/i.exec(h) : null;
  return m ? m[1] : null;
}
