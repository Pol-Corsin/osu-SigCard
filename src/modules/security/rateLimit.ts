/**
 * Persistent fixed-window rate limiting in Postgres, so limits hold across
 * serverless instances and cold starts. One upsert per check.
 */
import type { Db } from "../db/client";

export type RateRule = { name: string; limit: number; windowSeconds: number };

export const RULES = {
  publish: { name: "publish", limit: 10, windowSeconds: 3600 },
  editAuth: { name: "edit-auth", limit: 120, windowSeconds: 600 },
  update: { name: "update", limit: 60, windowSeconds: 3600 },
  refresh: { name: "refresh", limit: 10, windowSeconds: 3600 },
  rotate: { name: "rotate", limit: 5, windowSeconds: 3600 },
  search: { name: "search", limit: 60, windowSeconds: 600 },
  render: { name: "render", limit: 120, windowSeconds: 600 },
} satisfies Record<string, RateRule>;

export type RateResult = { ok: true } | { ok: false; retryAfter: number };

export async function rateLimit(db: Db, rule: RateRule, subject: string, now = new Date()): Promise<RateResult> {
  const windowMs = rule.windowSeconds * 1000;
  const start = new Date(Math.floor(now.getTime() / windowMs) * windowMs);
  const rows = await db.query<{ count: number }>(
    `INSERT INTO rate_limits (bucket, window_start, count) VALUES ($1, $2, 1)
     ON CONFLICT (bucket, window_start) DO UPDATE SET count = rate_limits.count + 1
     RETURNING count`,
    [`${rule.name}:${subject}`, start.toISOString()],
  );
  // Opportunistic cleanup of old windows (about 1% of calls).
  if (Math.random() < 0.01) {
    void db.query(`DELETE FROM rate_limits WHERE window_start < $1`, [new Date(now.getTime() - 86_400_000).toISOString()]).catch(() => {});
  }
  if (Number(rows[0]?.count ?? 0) <= rule.limit) return { ok: true };
  return { ok: false, retryAfter: Math.max(1, Math.ceil((start.getTime() + windowMs - now.getTime()) / 1000)) };
}
