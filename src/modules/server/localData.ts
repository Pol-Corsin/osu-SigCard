/**
 * Where local-development data lives (PGlite database, uploaded images).
 * Deliberately OUTSIDE the project folder: files written inside it would
 * trigger the Next.js dev server's file watcher and cause reload loops.
 * Override with LOCAL_DATA_DIR. Never used on Vercel.
 */
import { createHash } from "node:crypto";
import os from "node:os";
import path from "node:path";

export function localDataDir(...sub: string[]): string {
  const root =
    process.env.LOCAL_DATA_DIR?.trim() ||
    path.join(os.homedir(), ".sigcard-studio", createHash("sha1").update(process.cwd()).digest("hex").slice(0, 10));
  return path.join(root, ...sub);
}
