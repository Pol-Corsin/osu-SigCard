/**
 * QR codes for the public card page and the osu! profile.
 * Dark modules on white with a 4-module quiet zone and medium error
 * correction: the most reliably scannable combination.
 */
import { Resvg } from "@resvg/resvg-js";
import QRCode from "qrcode";

export async function qrSvg(text: string): Promise<string> {
  return QRCode.toString(text, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 4,
    color: { dark: "#111014ff", light: "#ffffffff" },
  });
}

export async function qrPng(text: string, size = 768): Promise<Buffer> {
  const svg = await qrSvg(text);
  return new Resvg(svg, { fitTo: { mode: "width", value: size }, shapeRendering: 1, font: { loadSystemFonts: false } }).render().asPng();
}
