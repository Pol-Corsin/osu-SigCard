/**
 * Generates illustrated sample avatars (256×256, osu!'s avatar size) and
 * covers for the fictional sample players. Raster PNGs on purpose: they
 * exercise the same image path real osu! avatars will take.
 *
 * Run with: npx tsx scripts/generate-samples.ts
 */
import fs from "node:fs";
import path from "node:path";
import { Resvg } from "@resvg/resvg-js";

const out = path.join(process.cwd(), "public", "samples");
fs.mkdirSync(out, { recursive: true });

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

type Art = (w: number, h: number) => string;

const city: Art = (w, h) => {
  const r = rng(7);
  let towers = "";
  let x = -10;
  while (x < w) {
    const tw = 18 + r() * 34;
    const th = h * (0.25 + r() * 0.4);
    towers += `<rect x="${x}" y="${h - th}" width="${tw}" height="${th}" fill="#1a0b2b"/>`;
    for (let wy = h - th + 8; wy < h - 6; wy += 9)
      for (let wx = x + 4; wx < x + tw - 4; wx += 7)
        if (r() > 0.62) towers += `<rect x="${wx}" y="${wy}" width="3" height="4" fill="#ffd1e6" fill-opacity="${0.5 + r() * 0.5}"/>`;
    x += tw + 2;
  }
  let stars = "";
  for (let i = 0; i < w / 6; i++) stars += `<circle cx="${r() * w}" cy="${r() * h * 0.5}" r="${r() * 1.2 + 0.3}" fill="#fff" fill-opacity="${r()}"/>`;
  return `<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#160a2e"/><stop offset=".6" stop-color="#7a1f5c"/><stop offset="1" stop-color="#ff6aa2"/></linearGradient></defs>
  <rect width="${w}" height="${h}" fill="url(#s)"/>${stars}
  <circle cx="${w * 0.7}" cy="${h * 0.3}" r="${Math.min(w, h) * 0.16}" fill="#ffe6f0"/>
  <circle cx="${w * 0.7 + Math.min(w, h) * 0.06}" cy="${h * 0.3 - Math.min(w, h) * 0.03}" r="${Math.min(w, h) * 0.15}" fill="#3a1240" fill-opacity=".25"/>
  ${towers}`;
};

const bauhaus: Art = (w, h) => {
  const s = Math.min(w, h);
  const reps = Math.ceil(w / h);
  let g = "";
  for (let i = 0; i < reps; i++) {
    const ox = i * h;
    g += `<circle cx="${ox + h * 0.38}" cy="${h * 0.42}" r="${s * 0.3}" fill="#1f8a8a"/>
    <path d="M${ox + h} ${h}A${s * 0.55} ${s * 0.55} 0 0 0 ${ox + h - s * 0.55} ${h - s * 0.55}V${h}Z" fill="#f26b3a"/>
    <rect x="${ox + h * 0.08}" y="${h * 0.8}" width="${s * 0.5}" height="${s * 0.07}" fill="#14141a"/>
    <circle cx="${ox + h * 0.78}" cy="${h * 0.2}" r="${s * 0.07}" fill="#f2c14e"/>
    <path d="M${ox + h * 0.55} ${h * 0.08}L${ox + h * 0.9} ${h * 0.6}" stroke="#14141a" stroke-width="${s * 0.025}"/>`;
  }
  return `<rect width="${w}" height="${h}" fill="#ece6d8"/>${g}`;
};

const sunset: Art = (w, h) => {
  let waves = "";
  for (let i = 0; i < 9; i++) {
    const y = h * 0.6 + i * h * 0.05;
    waves += `<path d="M0 ${y}${Array.from({ length: Math.ceil(w / 40) + 1 }, (_, k) => `Q${k * 40 + 20} ${y + (k % 2 ? 5 : -5)} ${k * 40 + 40} ${y}`).join("")}V${h}H0Z" fill="${["#1b4b7a", "#215a8f", "#2a6aa3", "#3279b4"][i % 4]}" fill-opacity=".85"/>`;
  }
  return `<defs><linearGradient id="k" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffb347"/><stop offset=".55" stop-color="#ff6b3d"/><stop offset="1" stop-color="#c2305a"/></linearGradient></defs>
  <rect width="${w}" height="${h}" fill="url(#k)"/>
  <circle cx="${w * 0.5}" cy="${h * 0.62}" r="${Math.min(w, h) * 0.28}" fill="#ffe08a"/>
  ${waves}`;
};

const mountains: Art = (w, h) => {
  const layers = ["#c9dccb", "#8fb39a", "#5e8a70", "#3c6650", "#243f33"];
  const r = rng(3);
  let m = "";
  layers.forEach((c, i) => {
    const base = h * (0.42 + i * 0.12);
    let d = `M0 ${base}`;
    for (let x = 0; x <= w; x += w / 8) d += `L${x} ${base - r() * h * 0.18}`;
    m += `<path d="${d}L${w} ${h}H0Z" fill="${c}"/>`;
  });
  return `<rect width="${w}" height="${h}" fill="#eef3ea"/><circle cx="${w * 0.25}" cy="${h * 0.28}" r="${Math.min(w, h) * 0.09}" fill="#f6c56b"/>${m}`;
};

const aurora: Art = (w, h) => {
  const r = rng(11);
  let stars = "";
  for (let i = 0; i < w / 5; i++) stars += `<circle cx="${r() * w}" cy="${r() * h * 0.6}" r="${r() * 1.1 + 0.2}" fill="#fff" fill-opacity="${r() * 0.8}"/>`;
  return `<defs><filter id="b" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="${Math.min(w, h) * 0.06}"/></filter>
  <linearGradient id="n" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#050b24"/><stop offset="1" stop-color="#16285a"/></linearGradient></defs>
  <rect width="${w}" height="${h}" fill="url(#n)"/>${stars}
  <g filter="url(#b)"><path d="M${-w * 0.1} ${h * 0.55}C${w * 0.25} ${h * 0.1} ${w * 0.6} ${h * 0.6} ${w * 1.1} ${h * 0.2}" stroke="#3dffb0" stroke-width="${h * 0.12}" fill="none" stroke-opacity=".8"/>
  <path d="M${-w * 0.1} ${h * 0.4}C${w * 0.3} ${h * 0.05} ${w * 0.7} ${h * 0.45} ${w * 1.1} ${h * 0.05}" stroke="#9b6bff" stroke-width="${h * 0.08}" fill="none" stroke-opacity=".7"/></g>
  <path d="M0 ${h * 0.8}Q${w * 0.3} ${h * 0.68} ${w * 0.6} ${h * 0.78}T${w} ${h * 0.74}V${h}H0Z" fill="#dfe9ff"/>
  <path d="M0 ${h * 0.9}Q${w * 0.4} ${h * 0.8} ${w} ${h * 0.88}V${h}H0Z" fill="#b8c8ee"/>`;
};

const SETS: [string, Art, boolean][] = [
  ["kairo", city, true],
  ["vellichor", bauhaus, true],
  ["saffron", sunset, true],
  ["ostrander", mountains, false],
  ["noel", aurora, true],
];

function render(svgBody: string, w: number, h: number, file: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${svgBody}</svg>`;
  const png = new Resvg(svg, { font: { loadSystemFonts: false } }).render().asPng();
  fs.writeFileSync(path.join(out, file), png);
  console.log(`${file}  ${(png.byteLength / 1024).toFixed(1)} KB`);
}

for (const [name, art, cover] of SETS) {
  render(art(256, 256), 256, 256, `avatar-${name}.png`);
  if (cover) render(art(1400, 360), 1400, 360, `cover-${name}.png`);
}
