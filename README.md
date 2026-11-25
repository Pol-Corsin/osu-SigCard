# Signature Card Studio

Design an osu! signature card with a live preview, and export a pixel-identical PNG for your profile.

An independent community tool, not affiliated with osu! or ppy Pty Ltd.

## Status

| Phase | Scope | State |
|---|---|---|
| 1 | Architecture & design system | Done |
| 2 | Studio editor, Player Card + Minimal templates, server PNG export | Done |
| 3 | osu! API v2 integration (search, all four modes, caching, rate limits) | Done |
| 4 | Cyberpunk, Editorial, Y2K, Artistic templates | Done |
| 5 | Publishing: Neon, image storage, permanent URLs, BBCode, QR codes, private edit links, stats refresh | **Done** |
| 6 | Sharing extras (the Markdown snippet exists in `share/links.ts` but isn't shown in the UI yet) | Mostly covered by Phase 5 |
| 7 | Tests, optimization, deployment | Next |

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

## Getting started (local development)

```bash
npm install
cp .env.example .env.local   # fill in OSU_CLIENT_ID and OSU_CLIENT_SECRET
npm run dev                  # http://localhost:3000/studio
```

Node 20+. With only the osu! credentials set, everything works locally, including publishing:

| | Local, nothing configured | Local, services configured | Production (Vercel) |
|---|---|---|---|
| Database | In-memory PGlite (real Postgres). **Cleared when the dev server restarts.** | `DATABASE_URL` (a Neon dev branch is ideal) | `DATABASE_URL` **required** |
| Images | Files in `~/.sigcard-studio/<project-hash>/images` | `BLOB_READ_WRITE_TOKEN` | `BLOB_READ_WRITE_TOKEN` **required** |
| Edit-token secret | Built-in development secret (logged warning) | `EDIT_TOKEN_SECRET` | `EDIT_TOKEN_SECRET` **required** |
| Public URLs | Request origin (`http://localhost:3000`) | `PUBLIC_BASE_URL` | `PUBLIC_BASE_URL`, else the production domain (production) or the deployment's own URL (previews) |

The local fallbacks refuse to run on Vercel: a deployment without the required variables returns a clear "Publishing isn't set up" error instead of silently writing to an ephemeral filesystem.

Check your configuration at any time with `npm run services:check`. It tests the osu! credentials, Neon connectivity and migrations, and a Blob upload, read and delete, without printing secrets.

## Publishing and editing

1. **Publish.** The studio sends the card settings plus a random idempotency key to `POST /api/cards`. The server:
   - validates the settings;
   - fetches the player's current stats itself (stats from the browser are never trusted; fictional sample players can't be published);
   - renders the PNG with the same template code as the preview and optimizes it losslessly;
   - uploads it to storage, then inserts the card row. If the insert fails, the uploaded image is deleted.

   It returns the public page URL, the direct PNG URL, BBCode, QR code links and the private edit link. Retrying with the same key returns the same card and the same edit link, never a duplicate.
2. **Share.** The success dialog shows the card, osu! BBCode (`[url=https://osu.ppy.sh/users/ID][img]…/c/ID.png[/img][/url]`, on one line because the osu! editor turns line breaks into `<br>`), the image and page URLs, both QR codes (PNG and SVG downloads) and the private edit link.
3. **Edit.** The edit link is `/edit/{publicId}#{token}`. The token sits in the URL fragment, which browsers never send to servers, so it can't end up in logs or `Referer` headers. The page reads it, checks it against `GET /api/cards/{id}` with an `Authorization: Bearer` header, loads the published design into the studio, and removes it from the address bar. Updates (`PATCH`) re-render the PNG at the **same** public URLs. The owner can also **reset** the edit link, which revokes the old one immediately.
4. **Stats refresh.** The owner can refresh stats from the studio. In addition, when someone loads `/c/{id}.png` and the stats are older than 12 hours, a background refresh runs after the response is sent (Next.js `after()`). An atomic claim in the database ensures only one request refreshes a given card. Viewing the public page never calls osu!.

### URL stability and storage

- `/c/{id}.png` is the permanent image URL. It streams the current PNG with a strong `ETag` (304 on `If-None-Match`), `Cache-Control: public, max-age=300, s-maxage=600, stale-while-revalidate=86400`, and `image/png`.
- Stored images are immutable and named after their content (`cards/{id}/{sha256}.png`). An update uploads the new image, moves the database pointer (with an optimistic `version` check), and only then deletes the old image. Leftovers from crashed requests can be removed with `npm run images:gc` (dry run by default).
- PNGs are optimized losslessly with `sharp` (alpha channel dropped because cards are opaque, maximum zlib effort). Pixels are byte-identical to the render; files are 16–55% smaller.

## Database (Neon)

Schema: `src/modules/db/migrations.ts`. Tables:

- **`cards`:** public ID, osu! user ID and username, mode, template, template version, variant, size, width and height, the full validated config (`jsonb`), the player snapshot used for the current image (`jsonb`), image key, ETag and size, **edit token hash** (HMAC-SHA256, never the token), publish-key hash (idempotency), version, created, updated and stats-refreshed timestamps, last refresh attempt and error.
- **`rate_limits`:** fixed-window counters keyed by rule and hashed IP. Raw IPs are never stored.

Setup:

1. Create a project at [neon.tech](https://neon.tech) and copy the connection string.
2. Put it in `DATABASE_URL` (in `.env.local` for local use, in Vercel for production).
3. Run `npm run db:migrate` (reads `.env.local`). It's safe to run repeatedly. Run it again after pulling changes that add migrations.

The app uses Neon's HTTP driver: every query is one stateless HTTPS request, so serverless functions never exhaust a connection pool. Every write is a single SQL statement, so no interactive transactions are needed.

## Image storage (Vercel Blob)

1. In Vercel: **Storage → Create → Blob**, then connect it to the project. Vercel adds `BLOB_READ_WRITE_TOKEN` to the project's environment.
2. Private stores are recommended, because images are only ever served through `/c/{id}.png`. If you create a public store, set `BLOB_ACCESS=public`.
3. For local testing against the real store, copy the token into `.env.local`.

I chose Vercel Blob over Cloudflare R2 because the app is hosted on Vercel: no extra account, the token is injected automatically, and the stable URL is our own route anyway, so the storage choice is easy to change later. Swapping in R2 means writing one `ImageStore` implementation in `modules/storage/images.ts`.

## Deploying to Vercel

1. Import the repository in Vercel (framework: Next.js; defaults are fine).
2. Create the Blob store (above) and add the environment variables from `.env.example`: `OSU_CLIENT_ID`, `OSU_CLIENT_SECRET`, `EDIT_TOKEN_SECRET`, `PUBLIC_BASE_URL`, `DATABASE_URL`, `BLOB_READ_WRITE_TOKEN` (automatic), and `BLOB_ACCESS` if public. Use separate values for Preview and Production. Previews should use a Neon branch, not the production database.

   **Scope `PUBLIC_BASE_URL` to Production only.** When it's set, it wins in every environment. Without it, a preview deployment uses its own immutable deployment URL (`VERCEL_URL`) in BBCode, QR codes and edit links, so links to cards published from a preview point at the preview that stores them, not at production. Preview URLs sit behind Vercel Deployment Protection by default, so osu! can't load preview images. That's fine for testing, but only embed production cards in real profiles.
3. Run `npm run db:migrate` against the production `DATABASE_URL` once (and after future migrations).
4. Deploy, then open `/studio`, publish a card, and check its `/c/{id}.png` URL.

Choose the final domain before people start embedding cards: image URLs live in osu! profiles indefinitely.

## Security notes

- **Secrets stay server-side.** No variable uses `NEXT_PUBLIC_`. The production build is checked for credential and token code in browser bundles.
- **Edit tokens** are 256-bit and random (or derived from the publish request key with an HMAC of the server secret), are only ever shown to the publisher, and are stored as HMAC-SHA256 hashes. They're compared in constant time, checked on every owner request, and never included in public pages, public API responses, image URLs or logs.
- **The same error** is returned for "no such card" and "wrong token", so the edit API doesn't reveal which IDs exist.
- **Validation:** card settings are validated with Zod on every write. Request bodies are capped at 8 KB and read with a hard byte limit. Only osu! image hosts are fetched for avatars and covers, with timeouts and size caps.
- **Persistent rate limits** in Postgres (hold across serverless instances): publish 10/h per IP, owner requests 120 per 10 min per IP, updates 60/h and refreshes 10/h per card, edit-link resets 5/h per card, player search 60 per 10 min, renders 120 per 10 min.
- **Logs** contain error codes and messages only, never request bodies, tokens or connection strings.
- **Rotating `EDIT_TOKEN_SECRET`** invalidates all existing edit links. Public cards are unaffected.
- **Security headers** on every response: `X-Frame-Options: DENY` and `frame-ancestors 'none'`, so the studio and edit pages, which hold the edit token and the reset action, can't be framed for clickjacking. Also `X-Content-Type-Options: nosniff` and `Referrer-Policy: strict-origin-when-cross-origin`; the edit page sends no referrer at all. Card PNGs are embedded with `<img>`, which these headers don't affect.
- **Image cleanup is reference-checked.** Image keys are content hashes, so two concurrent saves of the same design produce the same key. An old or losing image is deleted only when no card row references it.
- **Edit tokens in the browser:** after publishing or opening an edit link, the token is kept in this browser's `localStorage` so the owner can keep editing. Anyone with access to that browser profile can edit the card. The owner can reset the link at any time.
- **Client IPs for rate limits** come from `X-Forwarded-For`, which Vercel overwrites with the real client address. Behind a different proxy that passes client-supplied values through, rate limits could be bypassed by spoofing that header.

## osu! API integration

- **Auth:** OAuth client-credentials grant, server only (`modules/osu/token.ts`). The token is reused until 90% of its lifetime, concurrent callers share one token request, and the token refreshes once automatically if osu! answers 401.
- **Lookup:** `GET /api/v2/users/@{username}/{mode}` or `/users/{id}/{mode}`, for `osu`, `taiko`, `fruits` and `mania`. Responses are checked against a lenient schema and normalized to a `PlayerSnapshot`. Cards store the numeric id, so renames don't break them.
- **Caching:** fresh for 30 min, kept as a stale fallback for 24 h. Concurrent lookups for the same player share one request, and username→id is cached too. The cache is in memory per server instance. Published cards also keep their own stored snapshot, so their images never depend on this cache.
- **Rate limits:** outgoing calls to osu! are capped at about 60/min (burst 20) per instance, and osu! 429s are passed on with `Retry-After`. Each visitor IP gets a 10-request burst, then one lookup every 2 s.
- **Errors:** invalid username (400), not found (404), rate limited (429), osu! unavailable or not configured (503). When osu! fails, cached data is served with a warning. "Player not found" is never hidden behind old data.
- **Fallback:** sample player ids never touch the API, so the studio always works.
- **Secrets:** `OSU_CLIENT_SECRET` is read only in server modules. The production build was checked for credential and token code in browser bundles.

### Endpoints

| Route | Purpose |
|---|---|
| `GET /api/player?username=…&mode=…` or `?id=…&mode=…` | Player snapshot + `source` (`api`, `cache`, `stale`, `sample`) |
| `GET /api/status` | `{ osuApi: boolean }`: whether live lookups are configured |
| `GET /api/render?c=…&scale=1..3` | PNG of an unpublished card config (preview, downloads) |
| `POST /api/cards` | Publish `{ config, publishKey }` → links, BBCode, edit link |
| `GET /api/cards/{id}` | Owner: full config (Bearer edit token) |
| `PATCH /api/cards/{id}` | Owner: update design `{ config, baseVersion }` |
| `POST /api/cards/{id}/refresh` | Owner: refresh stats now |
| `POST /api/cards/{id}/token` | Owner: reset the edit link |
| `GET /c/{id}.png` | Permanent public PNG (ETag, `?download=1`) |
| `GET /card/{id}` | Public card page (HTTP 404 for unknown IDs, set in `src/proxy.ts`) |
| `GET /edit/{id}#{token}` | Private edit link |
| `GET /api/qr?kind=card&id=…` / `?kind=profile&user=…` | QR code (`&format=png\|svg`, `&download=1`) |

### Testing

```bash
npm test                          # all unit + integration tests (no network, no credentials)
npm run check                     # typecheck, lint, tests, serializer parity, font metrics
npm run osu:check -- <username>   # live osu! API check + renders, using .env.local
npm run services:check            # verifies configured osu!/Neon/Blob/secrets
npm run dev  &  npm run test:e2e -- http://localhost:3000 <username>
                                  # full browser flow with real osu! data (local Edge/Chrome)
```

The publishing tests run against PGlite with the same migrations as Neon, plus an in-memory image store. The end-to-end script drives the real UI through these steps:
- search a player and publish;
- check the BBCode, image URL, ETag and 304 response;
- decode both QR codes;
- open the public page;
- edit through the private link in a fresh browser profile;
- update and refresh;
- reject a tampered link;
- reset the link and check that the old one stops working.

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
    card/[id]/           public card page (404 status comes from src/proxy.ts)
    edit/[id]/           private edit link loader
    c/[file]/            permanent PNG route
    api/                 player, status, render, cards (+ refresh, token), qr
  components/
    ui/                  design-system controls (incl. CopyField)
    share/               QR tile
    studio/              editor panels, publish panel, share dialog, store
  modules/
    cards/               CardConfig schema, card service (publish/update/refresh), API types
    db/                  Neon/PGlite client, migrations
    security/            tokens, hashing, persistent rate limits
    storage/             image stores (Vercel Blob, local, memory)
    share/               links, BBCode, QR
    server/              base URL, HTTP helpers, service wiring
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

| `npm run db:migrate` | Apply database migrations to `DATABASE_URL` |
| `npm run services:check` | Verify configured services and secrets |
| `npm run images:gc [-- --delete]` | List (or delete) stored images no card references |
| `npm run test:e2e -- <baseUrl> <username>` | Browser end-to-end publishing flow with real osu! data |

## Runtime notes

- Image and publishing routes use the Node.js runtime. `@resvg/resvg-js`, `sharp` and `@electric-sql/pglite` are server-external packages, and fonts and flags are traced into the function bundles (`next.config.ts`).

## Licenses

Card fonts (all SIL OFL, built by `scripts/fonts/build_fonts.py`): Hanken Grotesk, Saira Condensed, Chakra Petch, JetBrains Mono, Shippori Mincho, Zen Kaku Gothic New (both subset to the Japanese strings in `templates/editorial/japanese.json`), Michroma, Space Mono, Fraunces (static italic instances). Flags: country-flag-icons (MIT).
