/**
 * Verifies the server SVG serializer produces exactly what react-dom/server
 * would, for every template × size × variant × sample player × appearance
 * combination worth checking. Run: npm run test:serializer
 */
import { renderToStaticMarkup } from "react-dom/server";
import { DEFAULT_CONFIG, type CardConfig } from "../src/modules/cards/config";
import { sampleSnapshot, SAMPLE_PROFILES } from "../src/modules/player/fixtures";
import { GAME_MODES } from "../src/modules/player/types";
import { serializeSvg } from "../src/modules/render/serialize";
import { CardRenderer } from "../src/modules/templates/CardRenderer";
import { TEMPLATE_ORDER, TEMPLATES } from "../src/modules/templates/registry";

// React self-closes empty elements; the serializer always writes a closing tag. Both are equivalent XML.
const normalize = (s: string) => s.replace(/<([a-zA-Z]+)([^<>]*?)\/>/g, "<$1$2></$1>");

let checked = 0;
let failed = 0;
const appearances = [
  DEFAULT_CONFIG.appearance,
  { avatar: false, avatarShape: "square", flag: false, cover: false, effects: false, decorations: false } as const,
];

for (const id of TEMPLATE_ORDER) {
  const t = TEMPLATES[id];
  for (const size of t.sizes)
    for (const variant of t.variants.length ? t.variants.map((v) => v.id) : [null])
      for (const p of SAMPLE_PROFILES)
        for (const mode of GAME_MODES)
          for (const appearance of appearances) {
            const player = sampleSnapshot(p.id, mode);
            const config: CardConfig = { ...DEFAULT_CONFIG, template: id, size, variant, appearance: { ...appearance } };
            const assets = { avatar: "data:image/png;base64,AAA", cover: "data:image/png;base64,BBB", flag: "data:image/svg+xml;base64,CCC" };
            const el = <CardRenderer player={player} config={config} assets={assets} idPrefix="c" />;
            const a = normalize(renderToStaticMarkup(el));
            const b = normalize(serializeSvg(el));
            checked++;
            if (a !== b) {
              failed++;
              if (failed <= 3) {
                let i = 0;
                while (i < a.length && a[i] === b[i]) i++;
                console.error(`MISMATCH ${id}/${size}/${variant}/${p.username}/${mode}\n react: …${a.slice(Math.max(0, i - 80), i + 80)}\n ours:  …${b.slice(Math.max(0, i - 80), i + 80)}`);
              }
            }
          }
}
console.log(`${checked - failed}/${checked} renders identical`);
process.exit(failed ? 1 : 0);
