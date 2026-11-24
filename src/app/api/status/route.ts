/** GET /api/status — whether live osu! lookups are configured. Reveals nothing about the credentials. */
import { connection } from "next/server";
import { getPlayerService } from "@/modules/player/service";

export async function GET() {
  await connection(); // evaluate at request time, not at build time
  return Response.json({ osuApi: getPlayerService().apiConfigured }, { headers: { "Cache-Control": "no-store" } });
}
