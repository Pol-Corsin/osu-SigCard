/**
 * GET /api/render?c=<base64url(JSON CardConfig)>&scale=1|2|3
 *
 * Renders a card through the production pipeline (CardRenderer → SVG → resvg)
 * and returns a PNG. Used by the studio for downloads and the "server render"
 * preview. Player data comes from the player service (osu! API, cache, or
 * sample fixtures). Permanent hosted URLs arrive in Phase 5.
 */
import { cardConfigSchema, EXPORT_SCALES, type ExportScale } from "@/modules/cards/config";
import { osuErrorResponse } from "@/modules/osu/http";
import { getPlayerService } from "@/modules/player/service";
import { renderCardPng } from "@/modules/render/render";
import { RULES } from "@/modules/security/rateLimit";
import { errorResponse, softLimit } from "@/modules/server/http";

function decodeConfig(raw: string | null) {
  if (!raw || raw.length > 4000) return null;
  try {
    const json = Buffer.from(raw, "base64url").toString("utf8");
    const parsed = cardConfigSchema.safeParse(JSON.parse(json));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const config = decodeConfig(url.searchParams.get("c"));
  if (!config) {
    return Response.json({ error: "The card settings in this link are missing or invalid." }, { status: 400 });
  }
  const scaleParam = Number(url.searchParams.get("scale") ?? 1);
  const scale = (EXPORT_SCALES as readonly number[]).includes(scaleParam) ? (scaleParam as ExportScale) : 1;

  try {
    await softLimit(request, RULES.render);
  } catch (err) {
    return errorResponse(err);
  }

  let player;
  try {
    player = (await getPlayerService().byId(config.player.id, config.player.mode)).player;
  } catch (err) {
    return osuErrorResponse(err);
  }

  try {
    const png = await renderCardPng(player, config, scale);
    const download = url.searchParams.get("download") === "1";
    return new Response(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=300, s-maxage=3600",
        ...(download
          ? { "Content-Disposition": `attachment; filename="${player.username.replace(/[^\w-]+/g, "_").replace(/^_+|_+$/g, "")}-${config.template}@${scale}x.png"` }
          : {}),
      },
    });
  } catch (err) {
    console.error("render failed", err);
    return Response.json({ error: "The card couldn't be rendered. Try again." }, { status: 500 });
  }
}
