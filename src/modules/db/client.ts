/**
 * Database access.
 *
 * Production: Neon over HTTP (@neondatabase/serverless). Each query is one
 * stateless HTTPS request, so there is no connection pool to exhaust from
 * serverless functions. Every write in this app is a single statement, so no
 * interactive transactions are needed.
 *
 * Local development and tests: in-memory PGlite (real Postgres compiled to
 * WASM). Used only when DATABASE_URL is unset and never on Vercel.
 */
import { MIGRATIONS, splitStatements } from "./migrations";

export interface Db {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
  readonly kind: "neon" | "pglite";
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

export const isHostedDeployment = () => !!process.env.VERCEL;

export function neonDb(url: string): Db {
  // Imported lazily so the PGlite path never loads it and vice versa.
  let sqlPromise: Promise<(text: string, params?: unknown[]) => Promise<unknown[]>> | null = null;
  const getSql = () =>
    (sqlPromise ??= import("@neondatabase/serverless").then(({ neon }) => {
      const sql = neon(url);
      return (text: string, params?: unknown[]) => sql.query(text, params ?? []) as Promise<unknown[]>;
    }));
  return {
    kind: "neon",
    async query<T>(text: string, params?: unknown[]) {
      return (await (await getSql())(text, params)) as T[];
    },
  };
}

type PGliteLike = { query<T>(text: string, params?: unknown[]): Promise<{ rows: T[] }>; exec(sql: string): Promise<unknown> };

export function pgliteDb(pg: PGliteLike): Db {
  return {
    kind: "pglite",
    async query<T>(text: string, params?: unknown[]) {
      return (await pg.query<T>(text, params ?? [])).rows;
    },
  };
}

/** Applies pending migrations, recording each in schema_migrations. Safe to run repeatedly. */
export async function migrate(db: Db, log: (msg: string) => void = () => {}): Promise<string[]> {
  await db.query(`CREATE TABLE IF NOT EXISTS schema_migrations (id text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`);
  const done = new Set((await db.query<{ id: string }>(`SELECT id FROM schema_migrations`)).map((r) => r.id));
  const applied: string[] = [];
  for (const m of MIGRATIONS) {
    if (done.has(m.id)) continue;
    for (const stmt of splitStatements(m.sql)) await db.query(stmt);
    await db.query(`INSERT INTO schema_migrations (id) VALUES ($1)`, [m.id]);
    applied.push(m.id);
    log(`applied ${m.id}`);
  }
  return applied;
}

/*
 * Process-wide handle, kept on globalThis: Next.js loads separate module
 * instances for route handlers and pages, and a file-backed PGlite must only
 * be opened once per process or the instances won't see each other's writes.
 */
const g = globalThis as typeof globalThis & { __sigcardDb?: Promise<Db> | null };

export function getDb(): Promise<Db> {
  g.__sigcardDb ??= createDb().catch((e) => {
    g.__sigcardDb = null;
    throw e;
  });
  return g.__sigcardDb;
}

async function createDb(): Promise<Db> {
  const url = process.env.DATABASE_URL?.trim();
  if (url) return neonDb(url);
  if (isHostedDeployment()) {
    throw new ConfigError("DATABASE_URL is not set. Publishing needs a Neon database in deployed environments.");
  }
  // Local development fallback: in-memory PGlite, migrated automatically.
  // In-memory on purpose: a file-backed PGlite gets corrupted when the dev
  // server is killed mid-write. Data resets when the dev server restarts; set
  // DATABASE_URL (e.g. a free Neon development branch) for persistent local data.
  const { PGlite } = await import("@electric-sql/pglite");
  const db = pgliteDb(new PGlite());
  await migrate(db);
  console.info(`[db] using in-memory PGlite (pid ${process.pid}). Published cards last until the dev server restarts; set DATABASE_URL to persist.`);
  return db;
}

/** Test hook: replace the process-wide database. */
export function setDbForTests(db: Db | null) {
  g.__sigcardDb = db ? Promise.resolve(db) : null;
}
