/**
 * Server-side asset resolution. resvg cannot fetch, so every image a card
 * uses is turned into a data URI before rendering. Failures resolve to null
 * and the template draws its designed fallback instead of a broken image.
 */
import fs from "node:fs/promises";
import path from "node:path";
import type { PlayerSnapshot } from "../player/types";
import type { TemplateAssets } from "../templates/types";

const PUBLIC_DIR = path.join(process.cwd(), "public");
const MAX_BYTES = 4 * 1024 * 1024;
const TIMEOUT_MS = 5000;
/** Only osu! image hosts may be fetched, so the renderer can't be used as an open proxy. */
const REMOTE_HOSTS = new Set(["a.ppy.sh", "assets.ppy.sh", "osu.ppy.sh"]);

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

function toDataUri(buf: Buffer, mime: string) {
  return `data:${mime};base64,${buf.toString("base64")}`;
}

async function resolveLocal(urlPath: string): Promise<string | null> {
  const resolved = path.normalize(path.join(PUBLIC_DIR, urlPath));
  if (!resolved.startsWith(PUBLIC_DIR)) return null; // path traversal guard
  const mime = MIME[path.extname(resolved).toLowerCase()];
  if (!mime) return null;
  try {
    return toDataUri(await fs.readFile(resolved), mime);
  } catch {
    return null;
  }
}

async function resolveRemote(url: URL): Promise<string | null> {
  if (url.protocol !== "https:" || !REMOTE_HOSTS.has(url.hostname)) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), redirect: "follow" });
    if (!res.ok) return null;
    const mime = (res.headers.get("content-type") ?? "").split(";")[0].trim();
    if (!mime.startsWith("image/")) return null;
    const len = Number(res.headers.get("content-length") ?? 0);
    if (len > MAX_BYTES) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength > MAX_BYTES) return null;
    return toDataUri(buf, mime);
  } catch {
    return null;
  }
}

export async function resolveImage(ref: string | null): Promise<string | null> {
  if (!ref) return null;
  if (ref.startsWith("data:")) return ref;
  if (ref.startsWith("/")) return resolveLocal(ref);
  try {
    return await resolveRemote(new URL(ref));
  } catch {
    return null;
  }
}

export async function resolveAssetsForRender(player: PlayerSnapshot): Promise<TemplateAssets> {
  const [avatar, cover, flag] = await Promise.all([
    resolveImage(player.avatarUrl),
    resolveImage(player.coverUrl),
    resolveImage(`/flags/${player.countryCode.toUpperCase()}.svg`),
  ]);
  return { avatar, cover, flag };
}
