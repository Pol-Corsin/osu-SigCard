/**
 * Public card page: /card/{publicId}
 *
 * Reads the stored card only. It never calls osu!: stats refresh happens via
 * the image route's background refresh or the owner's manual refresh.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { QrTile } from "@/components/share/QrTile";
import { CopyField } from "@/components/ui/CopyField";
import { BrandMark, Download } from "@/components/ui/icons";
import { GAME_MODE_LABELS } from "@/modules/player/types";
import { baseUrlFromHeaders } from "@/modules/server/baseUrl";
import { getCardService } from "@/modules/server/context";
import { bbcode, cardLinks } from "@/modules/share/links";
import { getTemplate } from "@/modules/templates/registry";
import type { TemplateId } from "@/modules/cards/config";

type Props = { params: Promise<{ id: string }> };

async function load(id: string) {
  await connection(); // always read the current card at request time
  try {
    return await (await getCardService()).getPublic(id);
  } catch (e) {
    console.error("[card page] load failed", (e as Error).message);
    return "error" as const;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const card = await load(id);
  if (!card || card === "error") return { title: "Card not found", robots: { index: false } };
  const base = await baseUrlFromHeaders();
  const links = cardLinks(base, card.publicId, card.osuUserId);
  const title = `${card.username}'s osu! signature card`;
  return {
    title,
    description: `${card.username} · ${GAME_MODE_LABELS[card.mode].long} · made with Signature Card Studio`,
    alternates: { canonical: links.page },
    openGraph: { title, url: links.page, images: [{ url: links.image, width: card.width, height: card.height }] },
    twitter: { card: "summary_large_image", title, images: [links.image] },
  };
}

const date = (iso: string) => new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }) + " UTC";

async function CardView({ params }: Props) {
  const { id } = await params;
  const card = await load(id);

  if (card === "error" || !card) {
    return (
      <div className="mx-auto max-w-[520px] py-24 text-center">
        <h1 className="font-display text-[28px] font-semibold">{card === "error" ? "This card can't be shown right now" : "Card not found"}</h1>
        <p className="mt-2 text-[14px] text-muted">
          {card === "error" ? "Try again in a moment." : "This link doesn't point to a published card. Check that it was copied completely."}
        </p>
        <Link href="/studio" className="mt-6 inline-block rounded-ctl bg-hit px-4 py-2.5 text-[13.5px] font-semibold text-hit-ink">
          Make a card
        </Link>
      </div>
    );
  }

  const base = await baseUrlFromHeaders();
  const links = cardLinks(base, card.publicId, card.osuUserId);
  const template = getTemplate(card.template as TemplateId);
  const variant = template.variants.find((v) => v.id === card.variant)?.name;
  const qrCard = `/api/qr?kind=card&id=${card.publicId}`;
  const qrProfile = `/api/qr?kind=profile&user=${card.osuUserId}`;

  return (
    <div className="mx-auto grid w-full max-w-[1040px] gap-8 py-10">
      <div className="stage card-in rounded-[18px] border border-line px-4 py-10 sm:px-10">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`${links.image}?v=${card.imageEtag}`}
          alt={`${card.username}'s osu! signature card`}
          width={card.width}
          height={card.height}
          className="card-shadow mx-auto h-auto w-full rounded-[4px]"
          style={{ maxWidth: card.width }}
        />
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section className="grid content-start gap-6">
          <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
            <div className="min-w-0">
              <p className="eyebrow">osu! signature card</p>
              <h1 className="mt-1 flex items-center gap-3 font-display text-[34px] font-extrabold leading-none tracking-[-0.02em]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/flags/${card.player.countryCode}.svg`} alt={card.player.countryName} width={30} height={20} className="h-5 w-[30px] rounded-[3px]" />
                <span className="truncate">{card.username}</span>
              </h1>
              <p className="mt-2 text-[13px] text-muted">
                {GAME_MODE_LABELS[card.mode].long} · {template.name}
                {variant ? ` (${variant})` : ""} · stats from {date(card.statsRefreshedAt)}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <a href={links.profile} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-ctl bg-hit px-4 py-2.5 text-[13.5px] font-semibold text-hit-ink hover:shadow-[0_0_0_4px_color-mix(in_srgb,var(--color-hit)_22%,transparent)]">
              Open osu! profile ↗
            </a>
            <a href={`${links.image}?download=1`} download className="inline-flex items-center gap-2 rounded-ctl border border-line px-4 py-2.5 text-[13.5px] font-semibold hover:border-line-strong hover:bg-raised">
              <Download /> Download PNG
            </a>
            <a href={links.image} className="inline-flex items-center gap-2 rounded-ctl px-3 py-2.5 text-[13.5px] text-muted hover:text-text">
              Direct PNG link
            </a>
          </div>

          <CopyField label="Image URL" value={links.image} hint="A direct link to the PNG. It always shows the card's latest version." />
          <CopyField
            label="osu! BBCode"
            value={bbcode(links.profile, links.image)}
            hint={
              <>
                Paste into the <strong className="text-soft">me!</strong> section of an osu! profile.
              </>
            }
          />
        </section>

        <aside className="grid content-start gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <QrTile title="This card" caption={links.page} src={qrCard} />
          <QrTile title="osu! profile" caption={links.profile} src={qrProfile} />
        </aside>
      </div>
    </div>
  );
}

export default function CardPage({ params }: Props) {
  return (
    <div className="min-h-dvh px-4 sm:px-6">
      <header className="mx-auto flex h-14 max-w-[1040px] items-center gap-3 border-b border-line">
        <Link href="/studio" className="flex items-center gap-3">
          <BrandMark />
          <span className="font-display text-[15px] font-extrabold tracking-[-0.01em]">Signature Card Studio</span>
        </Link>
        <Link href="/studio" className="ml-auto rounded-ctl border border-line px-3 py-1.5 text-[12.5px] font-semibold hover:bg-raised">
          Make your own
        </Link>
      </header>
      <Suspense
        fallback={
          <div className="mx-auto grid max-w-[1040px] gap-8 py-10">
            <div className="skeleton aspect-[3/1] w-full rounded-[18px]" />
            <div className="skeleton h-10 w-64 rounded-ctl" />
          </div>
        }
      >
        <CardView params={params} />
      </Suspense>
      <footer className="mx-auto max-w-[1040px] border-t border-line py-6 text-[12px] text-faint">
        Signature Card Studio is an independent community tool, not affiliated with osu! or ppy Pty Ltd.
      </footer>
    </div>
  );
}
