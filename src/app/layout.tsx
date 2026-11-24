import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Geist, Geist_Mono } from "next/font/google";
import { cardFontFaceCss, fontsFor } from "@/modules/render/fonts";
import "./globals.css";

const bricolage = Bricolage_Grotesque({ variable: "--font-bricolage", subsets: ["latin"], weight: ["400", "600", "800"] });
const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Signature Card Studio", template: "%s · Signature Card Studio" },
  description: "Design an osu! signature card for your profile, with live preview and pixel-identical PNG export.",
};

export const viewport: Viewport = {
  themeColor: "#100f16",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${bricolage.variable} ${geist.variable} ${geistMono.variable}`}>
      <head>
        {/* Card fonts: the exact TTFs the server renderer uses, so previews match exported PNGs.
            Only the default template's fonts are preloaded; the rest load on demand. */}
        {fontsFor(["Saira Condensed"]).map((f) => (
          <link key={f.file} rel="preload" href={`/${f.file}`} as="font" type="font/ttf" crossOrigin="anonymous" />
        ))}
        <style dangerouslySetInnerHTML={{ __html: cardFontFaceCss() }} />
      </head>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
