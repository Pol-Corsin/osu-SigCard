/**
 * Server-only osu! credentials. Read from environment variables at call time;
 * never import this from client components (it would also be empty there,
 * since these variables deliberately lack the NEXT_PUBLIC_ prefix).
 */
export type OsuCredentials = { clientId: string; clientSecret: string };

export function readOsuCredentials(env: NodeJS.ProcessEnv = process.env): OsuCredentials | null {
  const clientId = env.OSU_CLIENT_ID?.trim();
  const clientSecret = env.OSU_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret || !/^\d+$/.test(clientId)) return null;
  return { clientId, clientSecret };
}

/** OSU_BASE_URL exists only to point local end-to-end tests at a fake osu! server. Leave unset in production. */
export const OSU_BASE = process.env.OSU_BASE_URL?.replace(/\/$/, "") || "https://osu.ppy.sh";
export const OSU_API = `${OSU_BASE}/api/v2`;
