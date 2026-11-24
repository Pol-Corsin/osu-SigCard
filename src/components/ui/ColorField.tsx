"use client";
import { useId, useState } from "react";
import { normalizeHex, type Hex } from "@/modules/color/color";
import { cx } from "./controls";

/**
 * Swatch (native color picker) + hex text input. The text field accepts
 * 3- or 6-digit hex with or without "#", and only commits valid values.
 */
export function ColorField({ label, value, onChange, id }: { label: string; value: string; onChange: (v: Hex) => void; id?: string }) {
  const autoId = useId();
  const fid = id ?? autoId;
  const [draft, setDraft] = useState(value);
  const [invalid, setInvalid] = useState(false);
  // Reset the text field when the value changes from outside (presets, picker).
  const [synced, setSynced] = useState(value);
  if (synced !== value) {
    setSynced(value);
    setDraft(value);
    setInvalid(false);
  }

  const commit = (raw: string) => {
    const hex = normalizeHex(raw);
    if (hex) {
      setInvalid(false);
      onChange(hex);
    } else {
      setInvalid(true);
    }
  };

  return (
    <div>
      <label htmlFor={`${fid}-hex`} className="mb-1.5 block text-[12px] font-medium text-muted">
        {label}
      </label>
      <div
        className={cx(
          "flex items-center gap-2 rounded-ctl border bg-ink p-1 pr-2 transition-colors",
          invalid ? "border-miss" : "border-line focus-within:border-line-strong",
        )}
      >
        <span className="relative size-7 shrink-0 overflow-hidden rounded-[6px] shadow-[inset_0_0_0_1px_rgb(255_255_255/.12)]">
          <input
            type="color"
            aria-label={`${label} color picker`}
            value={value}
            onChange={(e) => onChange(e.target.value as Hex)}
            className="swatch-input absolute -inset-1 size-9"
          />
        </span>
        <input
          id={`${fid}-hex`}
          value={draft}
          spellCheck={false}
          autoComplete="off"
          onChange={(e) => {
            setDraft(e.target.value);
            if (normalizeHex(e.target.value)?.length === 7 && e.target.value.replace("#", "").length === 6) commit(e.target.value);
          }}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && commit((e.target as HTMLInputElement).value)}
          aria-invalid={invalid}
          aria-describedby={invalid ? `${fid}-err` : undefined}
          className="w-full min-w-0 bg-transparent font-mono text-[12.5px] uppercase text-text outline-none"
        />
      </div>
      {invalid && (
        <p id={`${fid}-err`} className="mt-1 text-[11.5px] text-miss">
          Use a hex color like #FF5C9E.
        </p>
      )}
    </div>
  );
}
