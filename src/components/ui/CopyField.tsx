"use client";
import { useEffect, useId, useRef, useState } from "react";
import { cx } from "./controls";
import { Check } from "./icons";

type State = "idle" | "copied" | "failed";

export function useCopy() {
  const [state, setState] = useState<State>("idle");
  useEffect(() => {
    if (state === "idle") return;
    const t = setTimeout(() => setState("idle"), 2200);
    return () => clearTimeout(t);
  }, [state]);
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch {
      setState("failed");
    }
  };
  return { state, copy };
}

/** Read-only value with a copy button and a visible confirmation (or a fallback hint if the clipboard is blocked). */
export function CopyField({
  label,
  value,
  hint,
  tone = "default",
  mono = true,
  emphasis = false,
}: {
  label: string;
  value: string;
  hint?: React.ReactNode;
  tone?: "default" | "warning";
  mono?: boolean;
  emphasis?: boolean;
}) {
  const id = useId();
  const { state, copy } = useCopy();
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (state === "failed") input.current?.select();
  }, [state]);
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[12px] font-medium text-muted">
        {label}
      </label>
      <div
        className={cx(
          "flex items-stretch overflow-hidden rounded-ctl border bg-ink",
          tone === "warning" ? "border-j50/40" : emphasis ? "border-hit/50" : "border-line",
        )}
      >
        <input
          ref={input}
          id={id}
          readOnly
          value={value}
          onFocus={(e) => e.currentTarget.select()}
          className={cx("min-w-0 flex-1 bg-transparent px-3 py-2 text-[12.5px] text-soft outline-none", mono && "font-mono")}
        />
        <button
          type="button"
          onClick={() => copy(value)}
          className={cx(
            "flex shrink-0 items-center gap-1.5 border-l border-line px-3 text-[12.5px] font-semibold transition-colors",
            state === "copied" ? "bg-j100/10 text-j100" : state === "failed" ? "text-j50" : emphasis ? "bg-hit text-hit-ink hover:brightness-110" : "bg-raised text-text hover:bg-raised-2",
          )}
          aria-live="polite"
        >
          {state === "copied" ? (
            <>
              <Check /> Copied
            </>
          ) : state === "failed" ? (
            "Select & copy"
          ) : (
            "Copy"
          )}
        </button>
      </div>
      {state === "failed" ? (
        <p className="mt-1.5 text-[11.5px] text-j50">Your browser blocked clipboard access. The text is selected: press Ctrl+C (⌘C on Mac).</p>
      ) : (
        hint && <p className="mt-1.5 text-[11.5px] leading-4 text-faint">{hint}</p>
      )}
    </div>
  );
}
