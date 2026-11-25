import { ConfigError, isHostedDeployment } from "../db/client";

/**
 * Absolute origin used in public URLs, BBCode and QR codes.
 *
 * 1. PUBLIC_BASE_URL, when set for the current environment, always wins.
 * 2. Vercel preview deployments fall back to their own immutable deployment
 *    URL (VERCEL_URL), never the production domain: a card published from a
 *    preview lives in the preview's database and storage, so links pointing at
 *    production would 404.
 * 3. Vercel production falls back to the project's production domain.
 * 4. Locally, the request's own origin is used.
 */
export function baseUrl(request?: Request): string {
  const configured = configuredBaseUrl();
  if (configured) return configured;
  if (request) return new URL(request.url).origin;
  return "http://localhost:3000";
}

/** The deployment's base URL from the environment, or null when running locally without one. Throws when hosted and unresolvable. */
function configuredBaseUrl(): string | null {
  const explicit = process.env.PUBLIC_BASE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  const env = process.env.VERCEL_ENV;
  const host =
    env === "production"
      ? process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim()
      : env === "preview"
        ? process.env.VERCEL_URL?.trim()
        : undefined;
  if (host) return `https://${host.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`;
  if (isHostedDeployment()) throw new ConfigError("PUBLIC_BASE_URL is not set.");
  return null;
}

/** Same as baseUrl(), for Server Components (derives the origin from request headers locally). */
export async function baseUrlFromHeaders(): Promise<string> {
  const configured = configuredBaseUrl();
  if (configured) return configured;
  const { headers } = await import("next/headers");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}
