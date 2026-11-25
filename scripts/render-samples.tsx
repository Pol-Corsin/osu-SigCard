/**
 * Renders every template × size × variant against the sample players through
 * the real server pipeline (CardRenderer → SVG → resvg) into .renders/.
 * Used to review visual quality and to catch layout regressions.
 *
 * Run with: npm run render:samples [-- --scale 2]
 */
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_CONFIG, type CardConfig, type ExportScale } from "../src/modules/cards/config";
import { sampleSnapshot, SAMPLE_PROFILES } from "../src/modules/player/fixtures";
import type { GameMode } from "../src/modules/player/types";
import { rasterize, renderCardSvg } from "../src/modules/render/render";
import { ALL_TEMPLATE_IDS, TEMPLATES } from "../src/modules/templates/registry";

const scaleArg = process.argv.indexOf("--scale");
const scale = (scaleArg > -1 ? Number(process.argv[scaleArg + 1]) : 1) as ExportScale;
const only = process.argv.includes("--quick");
const stressOnly = process.argv.includes("--stress");

const outDir = path.join(process.cwd(), ".renders");
fs.mkdirSync(outDir, { recursive: true });

const cases: { player: number; mode: GameMode; tag: string; patch?: Partial<CardConfig>; stress?: boolean }[] = [
  { player: 90000001, mode: "osu", tag: "kairo" },
  { player: 90000002, mode: "mania", tag: "vellichor-mania", patch: { colors: { primary: "#2ed59a", secondary: "#3d7bff", accent: null } } },
  { player: 90000003, mode: "fruits", tag: "saffron-catch", patch: { colors: { primary: "#ff7a3d", secondary: "#ff3d7f", accent: null } } },
  { player: 90000004, mode: "fruits", tag: "ostrander-inactive", patch: { colors: { primary: "#e9e7ef", secondary: "#8a8796", accent: null } } },
  { player: 90000005, mode: "osu", tag: "noel-top", patch: { colors: { primary: "#a07bff", secondary: "#58e1ff", accent: null } } },
  // Worst case: widest legal name, every stat on, 7-digit ranks, huge numbers.
  { player: 90000001, mode: "taiko", tag: "stress", stress: true, patch: { stats: ["globalRank", "countryRank", "pp", "accuracy", "playCount", "level", "rankedScore", "medals"], colors: { primary: "#9bd36a", secondary: "#2f6f5e", accent: "#f0e68c" } } },
];

async function main() {
  let n = 0;
  for (const id of ALL_TEMPLATE_IDS) {
    const t = TEMPLATES[id];
    const variants = t.variants.length ? t.variants.map((v) => v.id) : [null];
    for (const size of t.sizes)
      for (const variant of variants)
        for (const c of stressOnly ? cases.filter((x) => x.stress) : only ? cases.slice(0, 1) : cases) {
          const base = sampleSnapshot(c.player, c.mode);
          const player = c.stress
            ? { ...base, username: "WWWWWWWWWWWWWWW", countryName: "Bosnia and Herzegovina", countryCode: "BA", stats: { globalRank: 1234567, countryRank: 123456, pp: 99999.9, accuracy: 100, playCount: 9999999, level: { current: 120, progress: 99 }, rankedScore: 999_900_000_000, medals: 999 } }
            : base;
          const config: CardConfig = { ...DEFAULT_CONFIG, ...c.patch, template: id, size, variant, player: { id: c.player, mode: c.mode } };
          const svg = await renderCardSvg(player, config);
          const png = rasterize(svg, scale);
          const file = `${id}-${size}${variant ? "-" + variant : ""}-${c.tag}@${scale}x.png`;
          fs.writeFileSync(path.join(outDir, file), png);
          n++;
        }
  }
  console.log(`rendered ${n} cards → .renders/ (scale ${scale}x)`);
  void SAMPLE_PROFILES;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
