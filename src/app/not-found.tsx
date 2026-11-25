/**
 * 404 page (served with HTTP 404). Unknown card IDs are routed here by
 * src/proxy.ts, so the message covers both missing cards and other pages.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { BrandMark } from "@/components/ui/icons";

export const metadata: Metadata = {
  title: "Card not found",
  robots: { index: false },
};

export default function NotFound() {
  return (
    <div className="min-h-dvh px-4 sm:px-6">
      <header className="mx-auto flex h-14 max-w-[1040px] items-center gap-3 border-b border-line">
        <Link href="/studio" className="flex items-center gap-3">
          <BrandMark />
          <span className="font-display text-[15px] font-extrabold tracking-[-0.01em]">Signature Card Studio</span>
        </Link>
      </header>
      <div className="mx-auto max-w-[520px] py-24 text-center">
        <h1 className="font-display text-[28px] font-semibold">Card not found</h1>
        <p className="mt-2 text-[14px] text-muted">This link doesn&apos;t point to a published card. Check that it was copied completely.</p>
        <Link href="/studio" className="mt-6 inline-block rounded-ctl bg-hit px-4 py-2.5 text-[13.5px] font-semibold text-hit-ink">
          Make a card
        </Link>
      </div>
    </div>
  );
}
