/**
 * GET /api/qr?kind=card&id={publicId}[&format=svg|png][&download=1]
 * GET /api/qr?kind=profile&user={osuUserId}[&format=svg|png][&download=1]
 *
 * Only these two kinds of URL can be encoded, so this isn't an open QR
 * generator. QR content is deterministic, so responses are cached long.
 */
import { baseUrl } from "@/modules/server/baseUrl";
import { qrPng, qrSvg } from "@/modules/share/qr";
import { cardLinks, OSU_PROFILE } from "@/modules/share/links";

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const kind = q.get("kind");
  const format = q.get("format") === "png" ? "png" : "svg";
  let text: string;
  let name: string;
  if (kind === "card" && /^[0-9A-Za-z]{10}$/.test(q.get("id") ?? "")) {
    const id = q.get("id")!;
    text = cardLinks(baseUrl(request), id, 0).page;
    name = `card-${id}-qr`;
  } else if (kind === "profile" && /^\d{1,10}$/.test(q.get("user") ?? "")) {
    text = OSU_PROFILE(Number(q.get("user")));
    name = `osu-profile-${q.get("user")}-qr`;
  } else {
    return Response.json({ error: { code: "bad_request", message: "Use kind=card&id=… or kind=profile&user=…" } }, { status: 400 });
  }

  const headers: Record<string, string> = {
    "Cache-Control": "public, max-age=86400, s-maxage=604800",
    "X-QR-Content": text,
  };
  if (q.get("download") === "1") headers["Content-Disposition"] = `attachment; filename="${name}.${format}"`;
  if (format === "png") {
    return new Response(new Uint8Array(await qrPng(text)), { headers: { ...headers, "Content-Type": "image/png" } });
  }
  return new Response(await qrSvg(text), { headers: { ...headers, "Content-Type": "image/svg+xml" } });
}
