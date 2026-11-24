import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { DEFAULT_CONFIG, STAT_KEYS_ALL, type CardConfig } from "./helpers";
import { compact } from "@/modules/player/format";
import { sampleSnapshot, SAMPLE_PROFILES } from "@/modules/player/fixtures";
import { GAME_MODES } from "@/modules/player/types";
import { CARD_FONTS } from "@/modules/render/fonts";
import { serializeSvg } from "@/modules/render/serialize";
import { CardRenderer } from "@/modules/templates/CardRenderer";
import { TEMPLATE_ORDER, TEMPLATES } from "@/modules/templates/registry";
import type { TemplateAssets } from "@/modules/templates/types";

const ASSETS: TemplateAssets = { avatar: "data:image/png;base64,AA", cover: "data:image/png;base64,BB", flag: "data:image/svg+xml;base64,CC" };
const NO_ASSETS: TemplateAssets = { avatar: null, cover: null, flag: null };

const appearances: CardConfig["appearance"][] = [
  DEFAULT_CONFIG.appearance,
  { avatar: false, avatarShape: "square", flag: false, cover: false, effects: false, decorations: false },
];
const statSets = [DEFAULT_CONFIG.stats, STAT_KEYS_ALL, [], ["pp"]] as CardConfig["stats"][];

function render(config: CardConfig, playerId: number, mode: (typeof GAME_MODES)[number], assets = ASSETS) {
  return serializeSvg(createElement(CardRenderer, { player: sampleSnapshot(playerId, mode), config, assets, idPrefix: "t" }));
}

/** Every <text>/<tspan> font declaration (family + weight + style) in an SVG string. */
function fontsUsed(svg: string) {
  const out: { family: string; weight: number; style: string }[] = [];
  for (const m of svg.matchAll(/<text\b([^>]*)>/g)) {
    const attrs = m[1];
    const family = /font-family="([^"]+)"/.exec(attrs)?.[1];
    if (!family) continue;
    const weight = Number(/font-weight="(\d+)"/.exec(attrs)?.[1] ?? 400);
    const style = /font-style="(\w+)"/.exec(attrs)?.[1] ?? "normal";
    out.push({ family, weight, style });
  }
  return out;
}

describe.each(TEMPLATE_ORDER)("template %s", (id) => {
  const t = TEMPLATES[id];

  it("supports both card sizes", () => {
    expect(t.sizes).toEqual(expect.arrayContaining(["standard", "compact"]));
  });

  it("renders every size, variant, mode, player, stat set and appearance without invalid values", () => {
    let n = 0;
    for (const size of t.sizes)
      for (const variant of t.variants.length ? t.variants.map((v) => v.id) : [null])
        for (const mode of GAME_MODES)
          for (const p of SAMPLE_PROFILES)
            for (const appearance of appearances)
              for (const stats of statSets) {
                const config = { ...DEFAULT_CONFIG, template: id, size, variant, stats, appearance };
                const svg = render(config, p.id, mode, n % 2 ? ASSETS : NO_ASSETS);
                expect(svg.startsWith("<svg")).toBe(true);
                expect(svg).not.toMatch(/NaN|undefined|Infinity|\[object Object\]/);
                n++;
              }
    expect(n).toBeGreaterThan(100);
  });

  it("only uses registered fonts that it declares, at registered weights and styles", () => {
    const config = { ...DEFAULT_CONFIG, template: id, stats: STAT_KEYS_ALL };
    const used = new Set<string>();
    for (const variant of t.variants.length ? t.variants.map((v) => v.id) : [null])
      for (const size of t.sizes) {
        const svg = render({ ...config, size, variant }, 90000001, "osu");
        for (const f of fontsUsed(svg)) {
          used.add(`${f.family}|${f.weight}|${f.style}`);
          expect(t.fonts, `${f.family} not declared by ${id}`).toContain(f.family);
          const registered = CARD_FONTS.some((c) => c.family === f.family && c.weight === f.weight && c.style === f.style);
          expect(registered, `${f.family} ${f.weight} ${f.style} not registered`).toBe(true);
        }
      }
    expect(used.size).toBeGreaterThan(0);
  });

  it("declares sensible editor metadata", () => {
    expect(t.statSlots.standard).toBeGreaterThan(0);
    expect(t.statSlots.compact).toBeGreaterThan(0);
    for (const k of t.heroStats) expect(t.statRoles[k]).toBeTruthy();
    if (t.variants.length) expect(t.variants.map((v) => v.id)).toContain(t.defaultVariant);
  });
});

describe("compact numbers", () => {
  it.each([
    [9999, "9,999"],
    [48213907552, "48.2B"],
    [999_400_000_000, "999B"],
    [999_900_000_000, "1T"],
    [999_960_000_000, "1T"],
    [999_999, "1M"],
    [152330, "152K"],
    [12345, "12.3K"],
  ])("%d → %s", (n, s) => {
    expect(compact(n)).toBe(s);
  });
});
