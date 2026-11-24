import type { CardConfig } from "./config";

/** Compact, URL-safe encoding of a card config (base64url of UTF-8 JSON). Isomorphic. */
export function encodeConfig(config: CardConfig): string {
  const bytes = new TextEncoder().encode(JSON.stringify(config));
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function renderUrl(config: CardConfig, scale: number, download = false): string {
  const q = new URLSearchParams({ c: encodeConfig(config), scale: String(scale) });
  if (download) q.set("download", "1");
  return `/api/render?${q.toString()}`;
}
