/**
 * GET /api/player?username=<name>&mode=<osu|taiko|fruits|mania>
 * GET /api/player?id=<osu user id>&mode=<…>
 *
 * Public, read-only player lookup for the studio. osu! credentials stay on the
 * server; the response only contains the normalized public snapshot.
 */
import { z } from "zod";
import { OsuApiError } from "@/modules/osu/errors";
import { clientIp, osuErrorResponse } from "@/modules/osu/http";
import { KeyedLimiter } from "@/modules/osu/limiter";
import { getPlayerService } from "@/modules/player/service";
import { RULES } from "@/modules/security/rateLimit";
import { errorResponse, softLimit } from "@/modules/server/http";
import { GAME_MODES } from "@/modules/player/types";

// 10 lookups burst, then 1 every 2 seconds per IP (per server instance).
const perIp = new KeyedLimiter(10, 0.5);

const query = z.union([
  z.object({ id: z.coerce.number().int().positive(), mode: z.enum(GAME_MODES).default("osu") }),
  z.object({ username: z.string().trim().min(1).max(32), mode: z.enum(GAME_MODES).default("osu") }),
]);

export async function GET(request: Request) {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = query.safeParse(params);
  if (!parsed.success) {
    return Response.json(
      { error: { code: "bad_request", message: "Enter an osu! username, and a mode of osu, taiko, fruits or mania.", retryAfter: null } },
      { status: 400 },
    );
  }

  const wait = perIp.take(clientIp(request));
  if (wait > 0) {
    return osuErrorResponse(new OsuApiError("rate_limited", `Too many searches. Try again in ${wait}s.`, wait));
  }

  try {
    await softLimit(request, RULES.search);
  } catch (err) {
    return errorResponse(err);
  }

  const service = getPlayerService();
  try {
    const q = parsed.data;
    const result = "id" in q ? await service.byId(q.id, q.mode) : await service.byUsername(q.username, q.mode);
    return Response.json(result, {
      headers: { "Cache-Control": result.source === "sample" ? "public, max-age=3600" : "private, max-age=60" },
    });
  } catch (err) {
    return osuErrorResponse(err);
  }
}
