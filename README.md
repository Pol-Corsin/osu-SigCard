# Signature Card Studio

Design an osu! signature card with a live preview, and export a pixel-identical PNG for your profile.

An independent community tool, not affiliated with osu! or ppy Pty Ltd.

## Status

| Phase | Scope | State |
|---|---|---|
| 1 | Architecture & design system | Done |
| 2 | Studio editor, Player Card + Minimal templates, server PNG export | Done |
| 3 | osu! API v2 integration (search, all four modes, caching, rate limits) | Done |
| 4 | Cyberpunk, Editorial, Y2K, Artistic templates | **Done** |
| 5 | Permanent card URLs, Neon Postgres, private edit links | Next |
| 6 | BBCode, Markdown, QR codes | |
| 7 | Tests, optimization, deployment | |

Search any osu! username once credentials are configured. Five fictional sample players are always available, including when the osu! API is not configured or is down.

### Templates

All six are implemented in both sizes (Standard 900×300, Compact 640×200), for all four modes, with two variants each except Player Card.

Every template has its own composition, typography, hierarchy, avatar treatment and ornament. None is a recolored or rearranged version of another.

- **Player Card** (default): esports roster card, full-height slanted portrait, team stripes, condensed type, stat box grid.
- **Minimal** (variants Paper / Ink): identity as a byline, one thin oversized rank numeral, hairline stat row, level as a 2 px rule.
- **Cyberpunk** (Grid / Data rain): cut-corner HUD frame over a perspective grid, hexagon avatar with scanlines, RGB-split glitch name, monospace meter readouts.
- **Editorial** (Washi / Sumi): Japanese-inspired magazine/poster layout. Asymmetric composition with the rank as the headline, expressive mincho typography, vertical Japanese text for the mode, a red hanko-style pp seal, and a bilingual stat table under a double rule.
- **Y2K** (Chrome / Candy): brushed chrome, a translucent desktop window titled `<name>.sig`, glossy bubble avatar, pill-shaped stats, chrome lettering, sparkles.
- **Artistic** (Dusk / Paper): oversized italic username, blurred color patches, film grain, the avatar centered inside osu!-style approach circles, and stats set on a circular path around the avatar.

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in osu! credentials (needed from Phase 3)
npm run dev                  # http://localhost:3000/studio
```

Node 20+.

## osu! API integration

- **Auth:** OAuth client-credentials grant, server only (`modules/osu/token.ts`). The token is reused until 90% of its lifetime, concurrent callers share one token request, and the token refreshes once automatically if osu! answers 401.
- **Lookup:** `GET /api/v2/users/@{username}/{mode}` or `/users/{id}/{mode}`, for `osu`, `taiko`, `fruits` and `mania`. Responses are checked against a lenient schema and normalized to a `PlayerSnapshot`. Cards store the numeric id, so renames don't break them.
- **Caching:** fresh for 30 min, kept as a stale fallback for 24 h. Concurrent lookups for the same player share one request, and username→id is cached too. The cache is in memory per server instance; Phase 5 adds a Postgres snapshot table.
- **Rate limits:** outgoing calls to osu! are capped at about 60/min (burst 20) per instance, and osu! 429s are passed on with `Retry-After`. Each visitor IP gets a 10-request burst, then one lookup every 2 s.
- **Errors:** invalid username (400), not found (404), rate limited (429), osu! unavailable or not configured (503). When osu! fails, cached data is served with a warning. "Player not found" is never hidden behind old data.
- **Fallback:** sample player ids never touch the API, so the studio always works.
- **Secrets:** `OSU_CLIENT_SECRET` is read only in server modules. The production build was checked for credential and token code in browser bundles.

### Endpoints

| Route | Purpose |
|---|---|
| `GET /api/player?username=…&mode=…` or `?id=…&mode=…` | Player snapshot + `source` (`api`, `cache`, `stale`, `sample`) |
| `GET /api/status` | `{ osuApi: boolean }`: whether live lookups are configured |
| `GET /api/render?c=…&scale=1..3` | PNG of a card config |

### Testing

```bash
npm test                          # unit tests against a mocked osu! API
npm run osu:check -- <username>   # live check using your .env.local credentials
```

To click through the whole UI without real credentials, use the bundled fake osu! server:

```bash
node scripts/mock-osu.mjs 3299
OSU_CLIENT_ID=1 OSU_CLIENT_SECRET=test OSU_BASE_URL=http://localhost:3299 npm run dev
# try: mockplayer · slowpoke (unranked in mania) · ratelimited (429) · broken (500) · anything else (404)
```

`OSU_BASE_URL` exists only for this test setup. Leave it unset in production.

## How rendering works

A template is a pure React component that returns `<svg>`. The same component renders:

- **in the browser**, as the live preview, and
- **on the server**, serialized to an SVG string (`modules/render/serialize.ts`) and rasterized with resvg (`modules/render/render.tsx`).

Consistency between the two is enforced by:

- **Fonts.** Both sides load the same TTF files from `public/fonts/card/` (`modules/render/fonts.ts`). resvg runs with system fonts disabled. `npm run build:assets` fails if a font's internal family name doesn't match its declared name, because resvg would otherwise fall back silently.
- **Text fitting.** SVG has no text layout, so templates use `fitText` / `measureText` (`modules/render/measure.ts`). These read glyph-width and kerning tables generated from those same font files, so both sides make identical shrink and truncate decisions.
- **Images.** The browser probes avatar, cover and flag URLs. The server inlines them as data URIs, fetching remote images only from osu! hosts, with a timeout and a size cap. Any image that fails becomes `null`, and the template draws its designed fallback instead.
- **Serializer parity.** `npm run test:serializer` checks that the server serializer produces exactly what `react-dom/server` would, across every template, size, variant, sample player and mode. Next.js doesn't allow `react-dom/server` inside route handlers, which is why the serializer exists.

Export resolutions (1×, 2×, 3×) are rasterized from vector, so text and shapes stay sharp. osu! avatars are at most 256 px, which limits how sharp the avatar can be at large scales.

## Project layout

```
src/
  app/
    studio/              editor page
    api/render/          GET → PNG (config in query, scale 1–3)
  components/
    ui/                  design-system controls
    studio/              editor panels, store (zustand, draft persisted locally)
  modules/
    cards/               CardConfig schema (zod), sizes, URL encoding
    color/               contrast guard, presets
    player/              snapshot types, stat formatting, sample fixtures
    render/              fonts, metrics, measure, serializer, assets, resvg
    templates/           registry, shared primitives, one folder per template
scripts/                 asset generation, sample renders, parity test, screenshots
```

## Adding a template

1. Create `src/modules/templates/<name>/` with a component and a `CardTemplate` export (see `types.ts`).
2. Add its id to `TEMPLATE_IDS` in `modules/cards/config.ts` and register it in `templates/registry.ts`.
3. Register any new fonts in `modules/render/fonts.ts`, then run `npm run build:assets`.
4. Run `npm run render:samples` and review `.renders/`. Then run `npm run test:serializer`.

Template rules: emit only SVG elements, no hooks, no fetching; measure all text with `fitText`; handle `null` assets and unranked players (`globalRank: null`).

The editor builds its controls from template metadata (`sizes`, `variants`, `statSlots`, `statRoles`, `supports`), so a new template needs no UI changes. Community templates would be added through code review (they run on the server), not uploaded at runtime.

## Scripts

| Script | Purpose |
|---|---|
| `npm run build:assets` | Flags → `public/flags`, font checks + metrics JSON |
| `npm run samples:generate` | Regenerate sample avatars and covers |
| `npm run render:samples` | Render every template × size × variant × sample to `.renders/` (`-- --scale 2`) |
| `npm run check` | Typecheck, lint, unit tests, serializer parity, font metrics |
| `npm run test:serializer` | Server SVG serializer == react-dom/server, every template combination |
| `npm run test:metrics` | Text measurement tables vs resvg, every card font |
| `npm run test:parity` | Same SVG in Edge/Chrome vs resvg, pixel diff per template (writes failures to `.renders/parity/`) |
| `npx tsx scripts/contact-sheet.ts <filter>` | Tile renders from `.renders/` into one image for review |
| `npm run fonts:build` | Rebuild static and subset card fonts (needs Python + `pip install fonttools brotli`) |
| `npm test` | Unit tests (osu! client, token, cache, player service, limiter) |
| `npm run osu:check -- <name>` | Live API check + PNG renders with real credentials |
| `npm run typecheck` / `npm run lint` | Static checks |

## Deployment (planned: Vercel + Neon)

- Image routes use the Node.js runtime. `@resvg/resvg-js` is a server-external package, and fonts, flags and samples are traced into the function bundle (`next.config.ts`).
- Environment variables: see `.env.example`. `OSU_CLIENT_SECRET` must never use the `NEXT_PUBLIC_` prefix.

## Licenses

Card fonts (all SIL OFL, built by `scripts/fonts/build_fonts.py`): Hanken Grotesk, Saira Condensed, Chakra Petch, JetBrains Mono, Shippori Mincho, Zen Kaku Gothic New (both subset to the Japanese strings in `templates/editorial/japanese.json`), Michroma, Space Mono, Fraunces (static italic instances). Flags: country-flag-icons (MIT).
