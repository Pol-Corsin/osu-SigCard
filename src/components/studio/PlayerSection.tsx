"use client";
import { useEffect, useState, type FormEvent } from "react";
import { SAMPLE_PROFILES } from "@/modules/player/fixtures";
import { GAME_MODES, GAME_MODE_LABELS, type GameMode } from "@/modules/player/types";
import { cx, FieldLabel, Section, Segmented } from "../ui/controls";
import { Check } from "../ui/icons";
import { fetchApiStatus, fetchPlayer, PlayerLookupError } from "./playerApi";
import { useStudio } from "./store";
import { isSampleId } from "./useStudioData";

type SearchState =
  | { kind: "idle" }
  | { kind: "loading"; username: string }
  | { kind: "error"; message: string; code: string };

function PlayerRow({
  on,
  onClick,
  avatar,
  name,
  countryCode,
  tag,
}: {
  on: boolean;
  onClick: () => void;
  avatar: string | null;
  name: string;
  countryCode: string;
  tag?: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onClick}
      className={cx(
        "flex items-center gap-2.5 rounded-ctl border px-2 py-1.5 text-left transition-colors",
        on ? "border-line-strong bg-raised" : "border-transparent hover:bg-raised/60",
      )}
    >
      {avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatar} alt="" width={26} height={26} className="size-[26px] rounded-full bg-raised object-cover" />
      ) : (
        <span className="grid size-[26px] place-items-center rounded-full bg-raised text-[11px] text-muted">{name[0]}</span>
      )}
      <span className="min-w-0 flex-1 truncate text-[13px] text-soft">{name}</span>
      {tag && <span className="font-mono text-[10px] text-faint">{tag}</span>}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/flags/${countryCode}.svg`} alt={countryCode} width={18} height={12} className="h-3 w-[18px] rounded-[2px]" />
      {on && <Check className="shrink-0 text-hit" />}
    </button>
  );
}

export function PlayerSection() {
  const config = useStudio((s) => s.config);
  const recent = useStudio((s) => s.recent);
  const setPlayer = useStudio((s) => s.setPlayer);
  const setMode = useStudio((s) => s.setMode);
  const selectLivePlayer = useStudio((s) => s.selectLivePlayer);

  const [apiOn, setApiOn] = useState<boolean | null>(null);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState<SearchState>({ kind: "idle" });

  useEffect(() => {
    fetchApiStatus().then(setApiOn);
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const username = query.trim();
    if (!username || search.kind === "loading") return;
    setSearch({ kind: "loading", username });
    try {
      const result = await fetchPlayer({ username }, config.player.mode);
      selectLivePlayer(result);
      setSearch({ kind: "idle" });
      setQuery("");
    } catch (err) {
      const e2 = err instanceof PlayerLookupError ? err : new PlayerLookupError("unknown", "Couldn't search right now. Try again.");
      setSearch({ kind: "error", message: e2.message, code: e2.code });
    }
  };

  const disabled = apiOn === false;
  const meta = isSampleId(config.player.id) ? "sample data" : "live";

  return (
    <Section title="Player" meta={meta}>
      <form onSubmit={submit} role="search" aria-label="Find an osu! player">
        <FieldLabel htmlFor="player-search" aside={apiOn === null ? "…" : apiOn ? `searches ${GAME_MODE_LABELS[config.player.mode].short}` : "offline"}>
          osu! username
        </FieldLabel>
        <div
          className={cx(
            "flex items-center rounded-ctl border bg-ink pr-1 transition-colors focus-within:border-line-strong",
            search.kind === "error" ? "border-miss/60" : "border-line",
          )}
        >
          <input
            id="player-search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (search.kind === "error") setSearch({ kind: "idle" });
            }}
            disabled={disabled}
            maxLength={32}
            autoComplete="off"
            spellCheck={false}
            placeholder={disabled ? "Live search isn't available" : "e.g. peppy"}
            aria-invalid={search.kind === "error"}
            aria-describedby="player-search-msg"
            className="min-w-0 flex-1 bg-transparent px-3 py-2 text-[13px] text-text outline-none placeholder:text-faint disabled:cursor-not-allowed"
          />
          <button
            type="submit"
            disabled={disabled || !query.trim() || search.kind === "loading"}
            className="rounded-[6px] bg-raised px-2.5 py-1 text-[12px] font-semibold text-text transition-colors hover:bg-raised-2 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {search.kind === "loading" ? "Searching…" : "Search"}
          </button>
        </div>
        <p
          id="player-search-msg"
          aria-live="polite"
          className={cx("mt-1.5 text-[11.5px] leading-4", search.kind === "error" ? "text-miss" : "text-faint")}
        >
          {search.kind === "error"
            ? search.message
            : disabled
              ? "Live osu! lookups aren't set up on this server. Sample players below still work."
              : "Public profile data from the official osu! API."}
        </p>
      </form>

      {recent.length > 0 && (
        <div>
          <FieldLabel>Recent</FieldLabel>
          <div role="radiogroup" aria-label="Recent players" className="grid gap-1">
            {recent.map((p) => (
              <PlayerRow
                key={p.id}
                on={p.id === config.player.id}
                onClick={() => setPlayer(p.id)}
                avatar={p.avatarUrl}
                name={p.username}
                countryCode={p.countryCode}
              />
            ))}
          </div>
        </div>
      )}

      <div>
        <FieldLabel aside="fictional">Sample players</FieldLabel>
        <div role="radiogroup" aria-label="Sample players" className="grid gap-1">
          {SAMPLE_PROFILES.map((p) => (
            <PlayerRow
              key={p.id}
              on={p.id === config.player.id}
              onClick={() => setPlayer(p.id)}
              avatar={p.avatarUrl}
              name={p.username}
              countryCode={p.countryCode}
            />
          ))}
        </div>
      </div>

      <div>
        <FieldLabel>Game mode</FieldLabel>
        <Segmented<GameMode>
          label="Game mode"
          value={config.player.mode}
          onChange={setMode}
          options={GAME_MODES.map((m) => ({ value: m, label: GAME_MODE_LABELS[m].short, title: GAME_MODE_LABELS[m].long }))}
        />
      </div>
    </Section>
  );
}
