# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Next.js version warning (from AGENTS.md)

This uses **Next.js 16.4 / React 19.3** with `cacheComponents`, `partialPrefetching` and Turbopack (`next.config.ts`). APIs and conventions may differ from training data — read the relevant guide in `node_modules/next/dist/docs/` before writing Next-specific code, and heed deprecation notices. `next dev` re-adds the agent-rules block to `AGENTS.md`; leave it alone.

## Deploy

**Always commit and push to `origin main` after finishing a change**: Vercel deploys production automatically from GitHub (`caiquegl/prumo`). The working tree often holds unrelated WIP (e.g. `public/ig/` media, IG cron files); stage only the files of the current task, never `git add -A`, and never commit deletions under `public/ig/` unless asked (queued posts reference those URLs).

## Commands

```bash
npm run dev      # next dev (localhost:3000)
npm run build    # next build — the only "test"; there is no test suite
npm run lint     # eslint (flat config, next core-web-vitals + typescript)
npx tsc --noEmit # type-check only (faster than a full build)
```

Run commands under nvm Node 22 (`export NVM_DIR=$HOME/.nvm; . $NVM_DIR/nvm.sh; nvm use 22`). Existing panels (`app/posts`, `app/ig`) fail the `react-hooks/set-state-in-effect` lint rule; `app/leads/page.tsx` shows the passing pattern (no synchronous setState in effects).

Package manager is declared as yarn 1 (`packageManager`), but both `yarn.lock` and `package-lock.json` exist. Path alias: `@/*` → repo root.

Instagram worker (GitHub Actions / local, Playwright + ffmpeg):

```bash
cd worker && npm install && npx playwright install chromium
DRY_RUN=true node run.mjs
```

Manually trigger publishing on the deployed app (prod URL `https://prumo-tawny.vercel.app`):

```bash
curl -sS "https://prumo-tawny.vercel.app/api/cron/instagram?secret=$CRON_SECRET&force=1"   # next feed item
curl -sS "https://prumo-tawny.vercel.app/api/cron/instagram?secret=$CRON_SECRET&id=42&force=1"  # specific queue id
```

Env vars are documented in `env.example` (Neon `DATABASE_URL`, Meta app creds, `CRON_SECRET`, `ADMIN_PASSWORD`, `QUEUE_API_SECRET`, Vercel Blob, and optional AI/image provider keys).

## What this is

One Next.js app serving three things for the "Web Prumo" brand (freelance web dev focused on landing pages, content in pt-BR):

1. **Marketing site** — `app/page.tsx` plus SEO service pages (`app/criacao-de-sites`, `app/landing-pages`, …). Service pages share `app/components/ServicePage.tsx` and their copy/metadata lives in `lib/seo-pages.ts` (`SEO_PAGES`), which also feeds `app/sitemap.ts`. Adding a service page = add an entry there + a route folder.
2. **Instagram automation for @web.prumo** — queue, admin panel, crons, and Meta Graph publishing. This is most of the code (`lib/ig/`, `app/api/`).
3. **Lead prospecting (`/leads`)** — finds businesses in Greater São Paulo with no website, tracks them through a sales funnel and links each one to a demo landing page built in the sibling repo `../demos`. See "Leads / prospecting" below.

`middleware.ts` is the deprecated name in Next 16 (now `proxy.ts`), but it is kept on purpose: it uses the edge runtime (`lib/admin/session-edge.ts`), which `proxy` does not support.

## Instagram pipeline architecture

- **Storage**: Neon Postgres via `lib/db.ts` (`db()` returns a tagged-template `sql`). There are no migration files — tables are created lazily with `CREATE TABLE/ALTER ... IF NOT EXISTS` inside `ensureSchema()` (`lib/ig/store.ts`: `ig_auth`, `ig_publications`, `ig_logs`, drafts) and `ensureQueueSchema()` (`lib/ig/queue.ts`: `ig_queue`). Add columns there the same way.
- **Queue is the source of truth** (`ig_queue`): rows with `media_type` ∈ `image | video | carousel | story`, `status` ∈ `pending → publishing → published | failed`, ordered by `sort_order, id`. Media URLs must be publicly fetchable by Meta (Vercel Blob, or files under `public/ig/`).
- **Crons** (`vercel.json`, UTC): `/api/cron/ig-token` refreshes the Meta token stored in `ig_auth`; `/api/cron/instagram` claims the next pending `image|carousel` (`?kind=story` for stories); `/api/cron/instagram-story` for stories. Each cron run computes a `slot` key and skips if `ig_publications` already has it (idempotency). Reels are currently published manually / via the panel, not by the Vercel cron.
- **Publish flow**: cron/route → `claimNextPending`/`claimQueuePost` (`queue.ts`) → `publishClaimedQueueItem` (`dispatch.ts`) → `publishQueueMedia` (`publish.ts`, Graph API v26) → `markQueuePublished` + `insertPublication` + `logEvent`. Failures call `markQueueFailed`. Captions get hashtags/polish via `caption.ts` / `hashtags.ts` / `captionWithTags`.
- **Auth**:
  - Cron routes use `authorized()` (`lib/ig/http.ts`): `CRON_SECRET` as Bearer or `?secret=`; open in non-production when unset.
  - Admin UI (`/posts`, `/ig`) uses an HMAC session cookie (`lib/admin/`), enforced in `middleware.ts`. `/api/posts*` and `/api/ig/dashboard` also accept Bearer `QUEUE_API_SECRET | ADMIN_PASSWORD | CRON_SECRET`. Media files under `/ig/*.mp4|jpg|…` are deliberately public (Meta fetches them without cookies) — keep that exemption.
- **Uploading to the queue**: `POST /api/upload` (Blob + enqueue) or `/api/posts`; CLI wrapper `scripts/queue-upload.mjs <file> --caption ... --tags a,b [--story]`.
- **Image rendering**: Satori via `next/og` `ImageResponse` at 1080×1350 with fonts in `lib/ig/fonts/`. `FeedCard.tsx` (bank/agency layouts, preview at `/api/og/feed?id=...`) and the layered scene graph `scene.ts` + `SceneCompose.tsx` (`renderScenePost` in `compose.tsx`). Satori supports only a subset of CSS (flexbox, no grid) — keep JSX in these components Satori-compatible.
- **AI generation modules** (`manager.ts`, `agency.ts`, `artists.ts`, `gemini.ts`, `orshot.ts`, `unsplash.ts`, `json2video.ts`) implement copy/art generation with provider fallback cascades (Gemini → Pollinations → HF → …). The current crons publish only from the queue; these are used by preview/draft routes and scripts.
- `worker/` is a separate older Node package (GitHub Actions workflow `.github/workflows/instagram-autopost.yml`, manual dispatch) that renders `worker/template.html` with Playwright and publishes directly; content bank in `worker/bank.json`.

## Leads / prospecting

Business model: collect local businesses without a site → build a personalised single-page demo → approach the owner manually on WhatsApp with the link → sell the landing page (+ monthly hosting/maintenance plan).

- **Data**: `lib/leads/store.ts` creates `leads` and `lead_events` lazily (`ensureLeadsSchema()`, same pattern as `ig_queue`). `leads.place_id` is UNIQUE: collection upserts by it and only refreshes Google data, never status/notes. Types and status labels in `lib/leads/types.ts` (safe to import from client components).
- **Status flow**: `sem_site → criando → publicado → abordado → respondeu → aceitou | recusou | sem_resposta | descartado`. Every change goes through `updateLead()` (`PATCH /api/leads/[id]`), which writes a `lead_events` row; `contacted_at` is set the first time a lead becomes `abordado`. Don't update `leads.status` with raw SQL elsewhere.
- **Collection sources**: default is **Apify** (`lib/leads/apify.ts`, actor `compass/crawler-google-places`, env `APIFY_TOKEN`, ~1–2 min per run via `run-sync-get-dataset-items`); Places API is the fallback (`source: "google"` or no Apify token). `leads.source` records which. Booking/link-shortener hosts (appbarber, booksy, trinks, tiny.cc…) also count as "no own site".
- **Places API**: `lib/leads/places.ts` calls Google **Places API (New)** `places:searchText` (env `GOOGLE_PLACES_API_KEY`). The `X-Goog-FieldMask` header is mandatory; `websiteUri`/phone fields are billed at the Enterprise SKU, so don't add fields casually. Max 60 results per query (3 pages). A business counts as "no site" when `websiteUri` is missing **or** points to a social/link-aggregator host (`isSocialOnly()` in `lib/leads/score.ts`); closed businesses are skipped. `scoreLead()` ranks by rating, review count, mobile phone (→ WhatsApp E.164 via `whatsappFrom()`) and Instagram.
- **Details for the study**: `fetchLeadDetails()` / `GET /api/leads/[id]/details?photos=N` — Place Details with `reviews`, `editorialSummary`, `photos` (resolved via `media?skipHttpRedirect=true`, so the key is never exposed). Costs more (Atmosphere SKU + photo media); call it once per lead that gets a demo, never in bulk.
- **Brand**: `leads.logo_url` and `leads.brand_colors` (JSONB array of `#rrggbb`) are filled by `/landing-demo` and shown in the panel.
- **API**: `GET /api/leads?status=&q=`, `POST /api/leads/collect {query, city, max}`, `GET|PATCH|DELETE /api/leads/[id]`, `GET /api/leads/[id]/details`. All use `requireAdmin()` (session cookie or Bearer `QUEUE_API_SECRET`/`ADMIN_PASSWORD`/`CRON_SECRET`) and are listed in `middleware.ts` (`needsAuth`, Bearer bypass and `matcher`). The `../demos` skills call these with Bearer `QUEUE_API_SECRET`.
- **Panel** `app/leads/page.tsx`: funnel cards, collect form, status filters, demo link, WhatsApp button (`wa.me` with the approach message; the template is editable and kept in the viewer's localStorage), "copy `/landing-demo <id>`", event timeline, and a warning when a `recusou` lead still has a demo online after 7 days.

### Rules (business/legal, not just code)
- **Outreach is always manual.** The panel only opens a `wa.me` link; never automate WhatsApp/DM sending (bans the number, LGPD). The first message includes an opt-out; on opt-out set `descartado` and note it.
- **Demos are never created automatically**: collection only fills `/leads`; the user picks leads one by one, asks for each demo, and approves its layout before it is published.
- **Every demo is studied individually** (what the business does, audience, identity) and uses **the business's own identity**: its logo and a palette extracted from it, never Web Prumo's palette.
- **Demos must never pass as the business's official site**: "Demonstração Web Prumo — não oficial" banner and `noindex` (meta + `X-Robots-Tag` + `robots.txt Disallow`). No invented testimonials, prices, awards or "X years in business"; only real Google rating/reviews (verbatim, attributed).
- Demo of a lead in `recusou` must be removed within 7 days (`/remove-demo <id>` in `../demos`).
- Store only public business data needed for the approach.

### Demos repo (`../demos`)
Separate Next.js app, Vercel project `prumo-demos`, served at `demos.webprumo.com.br/<slug>`. Each demo = `briefs/<slug>.md` (study) + `public/brands/<slug>/` (logo) + `content/<slug>.ts` (`DemoContent`) + `app/<slug>/page.tsx`. Created with the skill `/landing-demo <leadId>`, removed with `/remove-demo <leadId>` (both in `demos/.claude/skills/`). See `../demos/CLAUDE.md`.

### Skills and MCPs
- Design skills live in the **Windows** profile (`C:\Users\Hitss\.claude\skills`), which WSL Claude Code doesn't read. They are symlinked into `demos/.claude/skills/`: `design-taste-frontend` (direction/page plan) → build → `impeccable` (audit/polish, mode *Persuade*) → `web-design-guidelines` (final review); `frontend-design` for palette/type choices.
- The Windows `.claude.json` has MCP entries `google-leads` and `maps-harvest`, but their URL is empty (broken). Don't rely on them; lead collection goes through `/api/leads/collect`. Playwright (for screenshots) uses `worker/node_modules/playwright`; Chromium is installed under `~/.cache/ms-playwright`.
- Vercel: the `vercel` CLI is in WSL under nvm (node v20/v24). Vercel Hobby forbids commercial use, so demos need a Pro team (or another host).

## Reels / media production (local, outside Next)

- Reels are HTML animations in `media/` (`media/formats/*.html`, `reel-*.html`) captured frame-by-frame with Playwright and encoded with ffmpeg (audio from `media/synth-music.js`) by `scripts/render-*.mjs`. Per-week manifests are `media/reels-weekN.json`; output goes to `public/ig/...` and is enqueued with `scripts/queue-reels-weekN.mjs` (via public site URL or GitHub raw fallback).
- Planning/briefs/caption drafts for each content week live in `content/*.md` (pt-BR).
- Many `scripts/*.sh|mjs` are one-off helpers and **hardcode `ROOT=/home/hitss/prumo` and `/home/hitss/.local/bin/ffmpeg`**; the repo now lives at `/home/hitss/webPrumo/prumo`, so fix the path before reusing one. `commit-*.sh` scripts are ad-hoc commit helpers, not part of any workflow.
