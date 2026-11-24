"use client";
import { useState } from "react";
import { CARD_SIZES, EXPORT_SCALES, type ExportScale } from "@/modules/cards/config";
import { renderUrl } from "@/modules/cards/encode";
import { Button, FieldLabel, Segmented } from "../ui/controls";
import { Download, Lock } from "../ui/icons";
import { useStudioData } from "./useStudioData";

export function ExportPanel() {
  const { config, template } = useStudioData();
  const [scale, setScale] = useState<ExportScale>(2);
  const size = CARD_SIZES[template.sizes.includes(config.size) ? config.size : template.sizes[0]];

  return (
    <section className="space-y-4 px-5 py-5">
      <h2 className="eyebrow">Export</h2>
      <div>
        <FieldLabel aside={`${size.width * scale} × ${size.height * scale} px`}>Resolution</FieldLabel>
        <Segmented<string>
          label="Export resolution"
          value={String(scale)}
          onChange={(v) => setScale(Number(v) as ExportScale)}
          options={EXPORT_SCALES.map((s) => ({ value: String(s), label: `${s}×` }))}
        />
        <p className="mt-1.5 text-[11.5px] leading-4 text-faint">
          Cards are vector until export, so text and shapes stay sharp at every scale. Avatars are limited by their source size (256 px on osu!).
        </p>
      </div>
      <a
        href={renderUrl(config, scale, true)}
        download
        className="inline-flex w-full items-center justify-center gap-2 rounded-ctl border border-line px-4 py-2.5 text-[13.5px] font-semibold text-text transition-colors hover:border-line-strong hover:bg-raised"
      >
        <Download /> Download PNG
      </a>

      <div className="rounded-[12px] border border-dashed border-line-strong p-4">
        <Button variant="primary" disabled className="w-full">
          <Lock /> Publish card
        </Button>
        <p className="mt-2.5 text-[11.5px] leading-4 text-faint">
          Not available yet. Permanent card links, private edit links, BBCode and QR codes come in Phases 5 and 6. Your design is saved as a draft in this browser.
        </p>
      </div>
    </section>
  );
}
