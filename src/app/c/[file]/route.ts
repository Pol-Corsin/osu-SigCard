/**
 * GET /c/{publicId}.png — the permanent public image URL used in BBCode.
 *
 * Streams the card's current PNG from durable storage with a strong ETag
 * (304 on If-None-Match). The URL never changes; updates and stats refreshes
 * change the bytes and the ETag. When stats are older than the refresh
 * interval, a background refresh is scheduled after the response is sent,
 * so the request itself never waits on osu!.
 */
import { after } from "next/server";
import { getCardService } from "@/modules/server/context";

const FILE_RE = /^([0-9A-Za-z]{10})\.png$/;

const CACHE = "public, max-age=300, s-maxage=600, stale-while-revalidate=86400";

export async function GET(request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const m = FILE_RE.exec(file);
  if (!m) return new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain" } });
  const publicId = m[1];

  try {
    const service = await getCardService();
    const image = await service.getImage(publicId);
    if (!image) return new Response("Card not found", { status: 404, headers: { "Content-Type": "text/plain", "Cache-Control": "public, max-age=60" } });

    try {
      after(async () => {
        try {
          await service.refresh(publicId, { automatic: true });
        } catch (e) {
          console.error("[refresh] background refresh failed for", publicId, (e as Error).message);
        }
      });
    } catch {
      // Outside a Next.js request scope (unit tests): skip the background refresh.
    }

    const etag = `"${image.etag}"`;
    const headers: Record<string, string> = {
      "Content-Type": "image/png",
      ETag: etag,
      "Cache-Control": CACHE,
      "Last-Modified": new Date(image.card.updatedAt).toUTCString(),
      "X-Content-Type-Options": "nosniff",
      "Access-Control-Allow-Origin": "*",
    };
    if (new URL(request.url).searchParams.get("download") === "1") {
      headers["Content-Disposition"] = `attachment; filename="${image.card.username.replace(/[^\w-]+/g, "_").replace(/^_+|_+$/g, "") || "card"}-${publicId}.png"`;
    }
    const inm = request.headers.get("if-none-match");
    if (inm && inm.split(",").some((t) => t.trim().replace(/^W\//, "") === etag)) {
      return new Response(null, { status: 304, headers });
    }
    headers["Content-Length"] = String(image.png.byteLength);
    return new Response(new Uint8Array(image.png), { status: 200, headers });
  } catch (err) {
    console.error("[image] failed to serve", publicId, err instanceof Error ? err.message : "");
    return new Response("Image temporarily unavailable", { status: 503, headers: { "Content-Type": "text/plain", "Cache-Control": "no-store", "Retry-After": "30" } });
  }
}
