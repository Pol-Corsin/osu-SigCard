/** QR code preview with independent PNG/SVG downloads. Works in server and client components. */
export function QrTile({ title, caption, src }: { title: string; caption: string; src: string }) {
  return (
    <figure className="flex flex-col gap-2.5 rounded-[12px] border border-line bg-ink p-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={`QR code: ${caption}`} width={160} height={160} className="aspect-square w-full rounded-[6px] bg-white" />
      <figcaption className="min-w-0">
        <span className="block text-[12.5px] font-semibold text-text">{title}</span>
        <span className="block truncate font-mono text-[11px] text-faint" title={caption}>
          {caption}
        </span>
      </figcaption>
      <div className="flex gap-1.5">
        <a href={`${src}&format=png&download=1`} download className="flex-1 rounded-[7px] border border-line py-1.5 text-center text-[12px] font-semibold text-text transition-colors hover:border-line-strong hover:bg-raised">
          PNG
        </a>
        <a href={`${src}&format=svg&download=1`} download className="flex-1 rounded-[7px] border border-line py-1.5 text-center text-[12px] font-semibold text-text transition-colors hover:border-line-strong hover:bg-raised">
          SVG
        </a>
      </div>
    </figure>
  );
}
