/**
 * Ordered SQL migrations. Embedded in code (not .sql files) so they run the
 * same way from the CLI, in tests and in serverless functions without
 * filesystem tracing. Statements are separated by `--> statement-breakpoint`
 * because the Neon HTTP driver runs one statement per request.
 *
 * Never edit a shipped migration; add a new one.
 */
export type Migration = { id: string; sql: string };

export const MIGRATIONS: Migration[] = [
  {
    id: "0001_cards_and_rate_limits",
    sql: `
CREATE TABLE cards (
  public_id            text PRIMARY KEY,
  osu_user_id          integer NOT NULL,
  username             text NOT NULL,
  mode                 text NOT NULL,
  template             text NOT NULL,
  template_version     integer NOT NULL,
  variant              text,
  size                 text NOT NULL,
  width                integer NOT NULL,
  height               integer NOT NULL,
  config               jsonb NOT NULL,
  player               jsonb NOT NULL,
  image_key            text NOT NULL,
  image_etag           text NOT NULL,
  image_bytes          integer NOT NULL,
  edit_token_hash      text NOT NULL,
  publish_key_hash     text UNIQUE,
  version              integer NOT NULL DEFAULT 1,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  stats_refreshed_at   timestamptz NOT NULL,
  refresh_attempted_at timestamptz,
  refresh_error        text
);
--> statement-breakpoint
CREATE INDEX cards_osu_user_id_idx ON cards (osu_user_id);
--> statement-breakpoint
CREATE INDEX cards_stats_refreshed_at_idx ON cards (stats_refreshed_at);
--> statement-breakpoint
CREATE TABLE rate_limits (
  bucket       text NOT NULL,
  window_start timestamptz NOT NULL,
  count        integer NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket, window_start)
);
--> statement-breakpoint
CREATE INDEX rate_limits_window_start_idx ON rate_limits (window_start);
`,
  },
];

export const splitStatements = (sql: string) =>
  sql
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter(Boolean);
