"use client";
import { useId, useState, type ReactNode } from "react";
import { ChevronDown } from "./icons";

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

/* ------------------------------------------------------------------ Switch */
export function Switch({
  checked,
  onChange,
  label,
  hint,
  disabled,
  id,
  hideLabel,
}: {
  hideLabel?: boolean;
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: ReactNode;
  disabled?: boolean;
  id?: string;
}) {
  const autoId = useId();
  const sid = id ?? autoId;
  return (
    <div className={cx("flex items-start justify-between gap-3 py-1.5", disabled && "opacity-50")}>
      <label htmlFor={sid} className={cx("min-w-0 text-[13px] leading-5 text-soft", !disabled && "cursor-pointer", hideLabel && "sr-only")}>
        {label}
        {hint && <span className="block text-[11.5px] leading-4 text-faint">{hint}</span>}
      </label>
      <button
        id={sid}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cx(
          "relative mt-0.5 h-5 w-[34px] shrink-0 rounded-full transition-colors duration-200",
          checked ? "bg-hit" : "bg-raised-2 shadow-[inset_0_0_0_1px_var(--color-line-strong)]",
          disabled ? "cursor-not-allowed" : "cursor-pointer",
        )}
      >
        <span
          className={cx(
            "absolute top-[3px] size-[14px] rounded-full transition-all duration-200 ease-out-soft",
            checked ? "left-[17px] bg-white" : "left-[3px] bg-muted",
          )}
        />
      </button>
    </div>
  );
}

/* --------------------------------------------------------------- Segmented */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  size = "md",
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode; title?: string; disabled?: boolean }[];
  label: string;
  size?: "sm" | "md";
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex w-full rounded-[10px] border border-line bg-ink p-[3px]">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            title={o.title}
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
            className={cx(
              "min-w-0 flex-1 truncate rounded-[7px] font-medium transition-all duration-150",
              size === "sm" ? "px-2 py-1 text-[12px]" : "px-2.5 py-1.5 text-[12.5px]",
              on
                ? "bg-raised text-text shadow-[inset_0_0_0_1px_var(--color-line-strong)]"
                : "text-muted hover:text-text disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-muted",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ----------------------------------------------------------------- Section */
export function Section({
  title,
  meta,
  children,
  defaultOpen = true,
}: {
  title: string;
  meta?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <section className="border-b border-line">
      <h2>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen(!open)}
          className="group flex w-full items-center gap-2 px-5 py-3.5 text-left"
        >
          <span className="eyebrow transition-colors group-hover:text-text">{title}</span>
          {meta && <span className="ml-auto truncate font-mono text-[11px] text-faint">{meta}</span>}
          <ChevronDown
            className={cx("shrink-0 text-faint transition-transform duration-200", !meta && "ml-auto", open ? "rotate-0" : "-rotate-90")}
          />
        </button>
      </h2>
      <div id={id} hidden={!open} className="space-y-4 px-5 pb-5">
        {children}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ Field */
export function FieldLabel({ children, htmlFor, aside }: { children: ReactNode; htmlFor?: string; aside?: ReactNode }) {
  return (
    <div className="mb-1.5 flex items-baseline justify-between gap-2">
      <label htmlFor={htmlFor} className="text-[12px] font-medium text-muted">
        {children}
      </label>
      {aside && <span className="font-mono text-[11px] text-faint">{aside}</span>}
    </div>
  );
}

/* ----------------------------------------------------------------- Button */
export function Button({
  children,
  variant = "ghost",
  className,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "quiet" }) {
  return (
    <button
      type="button"
      {...rest}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-ctl text-[13.5px] font-semibold transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-45",
        variant === "primary" &&
          "bg-hit px-4 py-2.5 text-hit-ink hover:shadow-[0_0_0_4px_color-mix(in_srgb,var(--color-hit)_22%,transparent)] active:scale-[.98] disabled:hover:shadow-none",
        variant === "ghost" && "border border-line px-4 py-2.5 text-text hover:border-line-strong hover:bg-raised",
        variant === "quiet" && "px-2 py-1.5 text-[12.5px] font-medium text-muted hover:bg-raised hover:text-text",
        className,
      )}
    >
      {children}
    </button>
  );
}
