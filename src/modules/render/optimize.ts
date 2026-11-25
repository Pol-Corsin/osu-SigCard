/**
 * Lossless PNG optimisation for published cards.
 *
 * Cards are fully opaque, so the alpha channel is dropped (RGBA → RGB) and
 * the image is re-encoded with maximum zlib effort and adaptive filtering.
 * Pixels are unchanged — tests decode both versions and compare them — so
 * blur, gradients, grain and avatars keep their exact quality.
 */
import sharp from "sharp";

export async function optimizePng(png: Buffer): Promise<Buffer> {
  const img = sharp(png);
  const [{ hasAlpha }, { isOpaque }] = await Promise.all([img.metadata(), img.stats()]);
  const pipeline = hasAlpha && isOpaque ? img.removeAlpha() : img;
  const out = await pipeline.png({ compressionLevel: 9, adaptiveFiltering: true, effort: 10, palette: false }).toBuffer();
  return out.byteLength < png.byteLength ? out : png;
}
