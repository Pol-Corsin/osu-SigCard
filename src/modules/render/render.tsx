/**
 * Server renderer: same CardRenderer as the browser preview → SVG string →
 * PNG via resvg, using only the bundled card fonts (system fonts disabled, so
 * output is identical on every machine).
 */
import path from "node:path";
import { Resvg } from "@resvg/resvg-js";
import type { CardConfig, ExportScale } from "../cards/config";
import type { PlayerSnapshot } from "../player/types";
import { CardRenderer } from "../templates/CardRenderer";
import type { TemplateAssets } from "../templates/types";
import { resolveAssetsForRender } from "./assets";
import { CARD_FONTS } from "./fonts";
import { serializeSvg } from "./serialize";

const FONT_FILES = CARD_FONTS.map((f) => path.join(process.cwd(), "public", f.file));

export async function renderCardSvg(player: PlayerSnapshot, config: CardConfig, assets?: TemplateAssets): Promise<string> {
  const resolved = assets ?? (await resolveAssetsForRender(player));
  return serializeSvg(<CardRenderer player={player} config={config} assets={resolved} idPrefix="c" />);
}

export function rasterize(svg: string, scale: ExportScale = 1): Buffer {
  const resvg = new Resvg(svg, {
    fitTo: { mode: "zoom", value: scale },
    font: {
      fontFiles: FONT_FILES,
      loadSystemFonts: false,
      defaultFontFamily: "Hanken Grotesk",
    },
    imageRendering: 0, // optimizeQuality
    shapeRendering: 2, // geometricPrecision
    textRendering: 2, // geometricPrecision
  });
  return resvg.render().asPng();
}

export async function renderCardPng(player: PlayerSnapshot, config: CardConfig, scale: ExportScale = 1): Promise<Buffer> {
  return rasterize(await renderCardSvg(player, config), scale);
}
