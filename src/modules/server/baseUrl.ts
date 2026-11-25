import { ConfigError, isHostedDeployment } from "../db/client";

/**
 * Absolute origin used in public URLs, BBCode and QR codes.
 * PUBLIC_BASE_URL wins; on Vercel the production domain is the fallback;
 * locally the request's own origin is used.
 */
export function baseUrl(request?: Request): string {
  const explicit = process.env.PUBLIC_BASE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (prod) return `https://${prod}`;
  if (isHostedDeployment()) throw new ConfigError("PUBLIC_BASE_URL is not set.");
  if (request) return new URL(request.url).origin;
  return "http://localhost:3000";
}

/** Same as baseUrl(), for Server Components (derives the origin from request headers locally). */
export async function baseUrlFromHeaders(): Promise<string> {
  if (process.env.PUBLIC_BASE_URL?.trim() || process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() || isHostedDeployment()) return baseUrl();
  const { headers } = await import("next/headers");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}
