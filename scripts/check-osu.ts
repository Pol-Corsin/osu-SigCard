/**
 * Live check of the osu! API integration with your real credentials.
 * Looks a player up in all four modes, shows cache behaviour, a not-found
 * case, and renders a PNG through the real pipeline.
 *
 * Run: npm run osu:check -- <username>      (reads .env.local)
 */
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_CONFIG } from "../src/modules/cards/config";
import { readOsuCredentials } from "../src/modules/osu/config";
import { OsuApiError } from "../src/modules/osu/errors";
import { formatStat } from "../src/modules/player/format";
import { getPlayerService } from "../src/modules/player/service";
import { GAME_MODES } from "../src/modules/player/types";
import { renderCardPng } from "../src/modules/render/render";
import { ALL_TEMPLATE_IDS } from "../src/modules/templates/registry";

const username = process.argv[2] ?? "peppy";

async function main() {
  if (!readOsuCredentials()) {
    console.error("✗ OSU_CLIENT_ID / OSU_CLIENT_SECRET are missing. Add them to .env.local (see .env.example).");
    process.exit(1);
  }
  const service = getPlayerService();

  for (const mode of GAME_MODES) {
    const t = Date.now();
    try {
      const { player, source } = await service.byUsername(username, mode);
      const s = player.stats;
      console.log(
        `✓ ${mode.padEnd(6)} ${player.username} (#${player.id}, ${player.countryCode}) ` +
          `rank ${formatStat("globalRank", s).value} · ${formatStat("pp", s).value}pp · ${formatStat("accuracy", s).value}% · ` +
          `lv ${s.level.current} · medals ${s.medals}  [${source}, ${Date.now() - t} ms]`,
      );
    } catch (e) {
      console.log(`✗ ${mode}: ${e instanceof OsuApiError ? `${e.code} – ${e.message}` : e}`);
    }
  }

  const again = await service.byUsername(username.toUpperCase(), "osu");
  console.log(`✓ repeat lookup (different case) served from: ${again.source}`);

  try {
    await service.byUsername("zz_nobody_9f3k2", "osu");
    console.log("✗ expected not_found");
  } catch (e) {
    console.log(`✓ unknown player → ${(e as OsuApiError).code}: ${(e as OsuApiError).message}`);
  }

  const out = path.join(process.cwd(), ".renders");
  fs.mkdirSync(out, { recursive: true });
  // Every template; two of them with taiko data to exercise a different mode.
  const taiko = await service.byUsername(username, "taiko");
  for (const template of ALL_TEMPLATE_IDS) {
    const pick = template === "editorial" || template === "y2k" ? taiko.player : again.player;
    const png = await renderCardPng(pick, { ...DEFAULT_CONFIG, template, variant: null, player: { id: pick.id, mode: pick.mode } }, 1);
    const file = path.join(out, `live-${pick.username.replace(/\W+/g, "_")}-${template}-${pick.mode}@1x.png`);
    fs.writeFileSync(file, png);
    console.log(`✓ rendered ${path.relative(process.cwd(), file)} (${(png.byteLength / 1024).toFixed(0)} KB)`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
