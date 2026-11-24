"use client";
import { CARD_SIZES, type CardSizeId, type TemplateId } from "@/modules/cards/config";
import { contrast, ensureContrast } from "@/modules/color/color";
import { COLOR_PRESETS } from "@/modules/color/presets";
import { formatStat, STAT_LABELS } from "@/modules/player/format";
import { CardRenderer } from "@/modules/templates/CardRenderer";
import { TEMPLATE_ORDER, getTemplate } from "@/modules/templates/registry";
import { ColorField } from "../ui/ColorField";
import { Button, cx, FieldLabel, Section, Segmented, Switch } from "../ui/controls";
import { ArrowDown, ArrowUp, Reset } from "../ui/icons";
import { PlayerSection } from "./PlayerSection";
import { ALL_STATS, useStudio } from "./store";
import { useStudioData } from "./useStudioData";

export function ConfigPanel() {
  return (
    <div>
      <PlayerSection />
      <DesignSection />
      <ColorSection />
      <StatsSection />
      <AppearanceSection />
      <AdvancedSection />
    </div>
  );
}

/* ------------------------------------------------------------------ Design */
function DesignSection() {
  const { config, player, assets } = useStudioData();
  const setTemplate = useStudio((s) => s.setTemplate);
  const setSize = useStudio((s) => s.setSize);
  const setVariant = useStudio((s) => s.setVariant);
  const template = getTemplate(config.template);

  return (
    <Section title="Design" meta={template.name}>
      <p className="-mt-1 text-[11.5px] leading-4 text-faint">{template.tagline}.</p>
      <div role="radiogroup" aria-label="Template" className="grid grid-cols-2 gap-2">
        {TEMPLATE_ORDER.map((id: TemplateId) => {
          const t = getTemplate(id);
          const on = id === config.template;
          // Compact size reads better at thumbnail scale.
          const thumbConfig = { ...config, template: id, size: "compact" as const, variant: t.defaultVariant };
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setTemplate(id)}
              title={t.tagline}
              className={cx(
                "group w-full min-w-0 rounded-[9px] border p-1 text-left transition-all duration-200",
                on ? "border-hit bg-raised" : "border-line hover:-translate-y-px hover:border-line-strong",
              )}
            >
              <div className="pointer-events-none overflow-hidden rounded-[5px] [&>svg]:block [&>svg]:h-auto [&>svg]:w-full">
                <CardRenderer player={player} config={thumbConfig} assets={assets} idPrefix={`thumb-${id}`} />
              </div>
              <div className="px-1 pb-0.5 pt-1.5">
                <span className={cx("block truncate text-[12px] font-semibold", on ? "text-text" : "text-soft")}>{t.name}</span>
              </div>
            </button>
          );
        })}
      </div>
      <div>
        <FieldLabel aside={`${CARD_SIZES[config.size].width} × ${CARD_SIZES[config.size].height}`}>Card size</FieldLabel>
        <Segmented<CardSizeId>
          label="Card size"
          value={config.size}
          onChange={setSize}
          options={(Object.keys(CARD_SIZES) as CardSizeId[]).map((s) => ({
            value: s,
            label: CARD_SIZES[s].name,
            disabled: !template.sizes.includes(s),
          }))}
        />
      </div>
      {template.variants.length > 0 && (
        <div>
          <FieldLabel>Layout variant</FieldLabel>
          <Segmented<string>
            label="Layout variant"
            value={config.variant ?? template.defaultVariant ?? ""}
            onChange={setVariant}
            options={template.variants.map((v) => ({ value: v.id, label: v.name, title: v.description }))}
          />
        </div>
      )}
    </Section>
  );
}

/* ------------------------------------------------------------------ Colors */
function ColorSection() {
  const { config, template } = useStudioData();
  const setColor = useStudio((s) => s.setColor);
  const setAccent = useStudio((s) => s.setAccent);
  const applyPreset = useStudio((s) => s.applyPreset);
  const { primary, secondary, accent } = config.colors;

  const ground = template.ground(config);
  const ratio = contrast(primary, ground);
  const target = template.contrastTarget;
  const adjusted = target === null ? primary : ensureContrast(primary, ground, target);
  const guarded = adjusted !== primary;

  return (
    <Section title="Colors">
      <div className="grid grid-cols-4 gap-1.5">
        {COLOR_PRESETS.map((p) => {
          const on = p.primary === primary && p.secondary === secondary;
          return (
            <button
              key={p.id}
              type="button"
              title={p.name}
              aria-label={`${p.name} palette`}
              aria-pressed={on}
              onClick={() => applyPreset(p.id)}
              className={cx(
                "group relative h-9 overflow-hidden rounded-[8px] transition-transform duration-150 hover:-translate-y-px",
                on ? "ring-2 ring-text ring-offset-2 ring-offset-panel" : "ring-1 ring-line",
              )}
            >
              <span className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${p.primary} 0 50%, ${p.secondary} 50% 100%)` }} />
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <ColorField label="Primary" value={primary} onChange={(v) => setColor("primary", v)} id="color-primary" />
        <ColorField label="Secondary" value={secondary} onChange={(v) => setColor("secondary", v)} id="color-secondary" />
      </div>
      <div
        className={cx(
          "flex items-start gap-2 rounded-ctl border px-3 py-2 text-[11.5px] leading-4",
          guarded ? "border-j50/30 bg-j50/5 text-j50" : "border-line text-muted",
        )}
      >
        {target === null ? (
          <span>{template.name} uses your colors for shapes and fields. Text color is picked automatically for contrast.</span>
        ) : (
          <>
            <span className="mt-px font-mono">{ratio.toFixed(1)}:1</span>
            <span>
              {guarded
                ? `Primary is too faint on this card's ground, so text in it is darkened to ${contrast(adjusted, ground).toFixed(1)}:1. Shapes keep your exact color.`
                : `Primary text is readable on this card's ground (needs ${target}:1).`}
            </span>
          </>
        )}
      </div>
      <div>
        <Switch
          label="Accent color"
          hint="Optional third color. Used by templates that support it."
          checked={accent !== null}
          onChange={(v) => setAccent(v ? COLOR_PRESETS.find((p) => p.primary === primary)?.accent ?? "#f5c451" : null)}
          id="accent-toggle"
        />
        {accent !== null && (
          <div className="mt-2">
            <ColorField label="Accent" value={accent} onChange={(v) => setAccent(v)} id="color-accent" />
          </div>
        )}
      </div>
    </Section>
  );
}

/* -------------------------------------------------------------- Statistics */
function StatsSection() {
  const { config, player, template } = useStudioData();
  const toggleStat = useStudio((s) => s.toggleStat);
  const moveStat = useStudio((s) => s.moveStat);
  const slots = template.statSlots[config.size];

  const enabled = config.stats;
  const regular = enabled.filter((k) => !template.heroStats.includes(k));
  const shown = new Set([...enabled.filter((k) => template.heroStats.includes(k)), ...regular.slice(0, slots)]);
  const ordered = [...enabled, ...ALL_STATS.filter((k) => !enabled.includes(k))];

  return (
    <Section title="Statistics" meta={`${Math.min(regular.length, slots)} of ${slots} slots`}>
      <p className="-mt-1 text-[11.5px] leading-4 text-faint">
        Order sets the order on the card. {template.name} fits {slots} regular stats at this size.
      </p>
      <ul className="grid gap-0.5">
        {ordered.map((key) => {
          const on = enabled.includes(key);
          const idx = enabled.indexOf(key);
          const role = template.statRoles[key];
          const overflow = on && !shown.has(key);
          const st = formatStat(key, player.stats);
          return (
            <li
              key={key}
              className={cx(
                "group flex items-center gap-1.5 rounded-ctl px-1.5 py-1 transition-colors hover:bg-raised/60",
                !on && "opacity-60",
              )}
            >
              <div className="flex flex-col">
                <button
                  type="button"
                  aria-label={`Move ${STAT_LABELS[key].label} up`}
                  disabled={!on || idx === 0}
                  onClick={() => moveStat(key, -1)}
                  className="rounded text-faint hover:text-text disabled:invisible"
                >
                  <ArrowUp width={12} height={12} />
                </button>
                <button
                  type="button"
                  aria-label={`Move ${STAT_LABELS[key].label} down`}
                  disabled={!on || idx === enabled.length - 1}
                  onClick={() => moveStat(key, 1)}
                  className="rounded text-faint hover:text-text disabled:invisible"
                >
                  <ArrowDown width={12} height={12} />
                </button>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-[13px] text-soft">{STAT_LABELS[key].label}</span>
                  {on && role && <span className="rounded-full border border-approach/40 px-1.5 text-[10px] leading-4 text-approach">{role}</span>}
                  {overflow && <span className="rounded-full border border-j50/40 px-1.5 text-[10px] leading-4 text-j50">No room</span>}
                </div>
                <span className="font-mono text-[11px] text-faint">
                  {st.value}
                  {st.unit}
                </span>
              </div>
              <Switch label={`Show ${STAT_LABELS[key].label}`} hideLabel checked={on} onChange={() => toggleStat(key)} id={`stat-${key}`} />
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

/* -------------------------------------------------------------- Appearance */
function AppearanceSection() {
  const { config, template, player } = useStudioData();
  const setAppearance = useStudio((s) => s.setAppearance);
  const ap = config.appearance;
  return (
    <Section title="Appearance">
      <div className="-my-1.5">
        <Switch label="Avatar" checked={ap.avatar} onChange={(v) => setAppearance({ avatar: v })} id="ap-avatar" hint={!ap.avatar ? "Shows a monogram instead" : undefined} />
        <Switch label="Country flag" checked={ap.flag} onChange={(v) => setAppearance({ flag: v })} id="ap-flag" />
        <Switch
          label="Cover image"
          checked={ap.cover && template.supports.cover && !!player.coverUrl}
          onChange={(v) => setAppearance({ cover: v })}
          disabled={!template.supports.cover || !player.coverUrl}
          id="ap-cover"
          hint={!template.supports.cover ? `${template.name} doesn't use covers` : !player.coverUrl ? "This player has no cover" : undefined}
        />
      </div>
      <div>
        <FieldLabel>Avatar shape</FieldLabel>
        <Segmented<"round" | "square">
          label="Avatar shape"
          value={ap.avatarShape}
          onChange={(v) => setAppearance({ avatarShape: v })}
          options={[
            { value: "round", label: "Round", disabled: !template.supports.avatarShape },
            { value: "square", label: "Square", disabled: !template.supports.avatarShape },
          ]}
        />
        {!template.supports.avatarShape && (
          <p className="mt-1.5 text-[11.5px] text-faint">{template.name} frames the avatar as part of its layout.</p>
        )}
      </div>
    </Section>
  );
}

/* ---------------------------------------------------------------- Advanced */
function AdvancedSection() {
  const { config, template } = useStudioData();
  const setAppearance = useStudio((s) => s.setAppearance);
  const reset = useStudio((s) => s.reset);
  const ap = config.appearance;
  return (
    <Section title="Advanced options" defaultOpen={false}>
      <div className="-my-1.5">
        <Switch
          label="Background effects"
          hint="Glows, textures and image treatments"
          checked={ap.effects}
          onChange={(v) => setAppearance({ effects: v })}
          disabled={!template.supports.effects}
          id="ap-effects"
        />
        <Switch
          label="Decorative elements"
          hint="Stripes, corner marks and ornaments"
          checked={ap.decorations}
          onChange={(v) => setAppearance({ decorations: v })}
          disabled={!template.supports.decorations}
          id="ap-decorations"
        />
      </div>
      <Button variant="quiet" onClick={reset} className="-ml-2">
        <Reset /> Reset everything to defaults
      </Button>
    </Section>
  );
}
