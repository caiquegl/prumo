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

Env vars are documented in `env.example` (Neon `DATABASE_URL`, Meta app creds, `CRON_SECRET`, `ADMIN_PASSWORD`, `QUEUE_API_SECRET`, Vercel Blob, `APIFY_TOKEN`, `GOOGLE_PLACES_API_KEY`, `EVOLUTION_*`, `RENDER_API_KEY`, and optional AI/image provider keys). Never print secret values from `.env.local`; grep with masking.

## What this is

One Next.js app serving three things for the "Web Prumo" brand (freelance web dev focused on landing pages, content in pt-BR):

1. **Marketing site** — `app/page.tsx` plus SEO service pages (`app/criacao-de-sites`, `app/landing-pages`, …). Service pages share `app/components/ServicePage.tsx` and their copy/metadata lives in `lib/seo-pages.ts` (`SEO_PAGES`), which also feeds `app/sitemap.ts`. Adding a service page = add an entry there + a route folder.
2. **Instagram automation for @web.prumo** — queue, admin panel, crons, and Meta Graph publishing. This is most of the code (`lib/ig/`, `app/api/`).
3. **Lead prospecting (`/leads`)** — finds businesses in Greater São Paulo with no own website (Apify Google Maps scraper), tracks them through a sales funnel, links each one to a demo landing page in the sibling repo `../demos`, and sends the user-approved first WhatsApp message through Evolution API. See "Leads / prospecting" below.

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

Business model: collect local businesses without an own website → the user picks one lead → build a personalised demo landing page (`../demos`) → user approves the layout → publish → user approves the first WhatsApp message → Claude sends it (one lead) → user negotiates on the phone → sell the landing page (+ hosting/maintenance).

### Day-to-day commands (run in `prumo/`, Node 22, all write straight to Neon — no Vercel env needed)

```bash
npx tsx --env-file=.env.local scripts/collect-leads.mts --priority --areas "Tatuapé, São Paulo;Santo André, SP" [--only odonto,solar] --max 20
npx tsx --env-file=.env.local scripts/collect-leads.mts "barbearia|Mooca, São Paulo" --max 20   # explicit pairs
npx tsx --env-file=.env.local scripts/collect-leads.mts --reclassify                            # after editing niches
npx tsx --env-file=.env.local scripts/lead.mts get <id>                                         # lead + events
npx tsx --env-file=.env.local scripts/lead.mts details <id> [photos]                            # study data (Apify: reviews, photos)
npx tsx --env-file=.env.local scripts/lead.mts patch <id> '{"status":"criando","event_note":"..."}'
npx tsx --env-file=.env.local scripts/whatsapp.mts status | qr | draft <id>
npx tsx --env-file=.env.local scripts/whatsapp.mts send <id> --text-file msg.txt --approved     # ONLY after the user approved that text
```

Scripts run by `tsx` must be `.mts` (the package is CJS; top-level `await` fails in `.ts`).

### Code
- **Data**: `lib/leads/store.ts` creates `leads` and `lead_events` lazily (`ensureLeadsSchema()`, same pattern as `ig_queue`). `leads.place_id` is UNIQUE: collection upserts by it and only refreshes Google data, never status/notes. Types/labels in `lib/leads/types.ts` (client-safe). Columns worth knowing: `source` (apify|google|manual), `niche`/`niche_rank`, `whatsapp` (E.164 when mobile), `demo_slug`/`demo_url`, `logo_url`, `brand_colors`, `contacted_at`.
- **Status flow**: `sem_site → criando → publicado → abordado → respondeu → aceitou | recusou | sem_resposta | descartado`. Every change goes through `updateLead()` (PATCH route or `scripts/lead.mts patch`), which writes a `lead_events` row; `contacted_at` is set the first time a lead becomes `abordado`. Never update `leads.status` with raw SQL.
- **Collection**: default source is **Apify** (`lib/leads/apify.ts`, actor `compass/crawler-google-places`, env `APIFY_TOKEN`, ~15–40 s per 20 places, ~US$4 per 1,000; free plan US$5/month — check usage at `api.apify.com/v2/users/me/limits`). Places API (`lib/leads/places.ts`, env `GOOGLE_PLACES_API_KEY`, FieldMask mandatory, Enterprise SKU) is the fallback and is **not configured**. "No own site" = no website, or a social/link-aggregator/booking host (`isSocialOnly()` in `lib/leads/score.ts`: instagram, linktree, appbarber, booksy, trinks, tiny.cc…). `scoreLead()` ranks by rating, reviews, mobile phone and Instagram.
- **Priority niches** (user's order) in `lib/leads/niches.ts`: 1 dental clinics, 2 aesthetics/dermatology, 3 solar energy, 4 car detailing, 5 event venues/buffets, 6 pools & renovations, 7 physiotherapy, 8 private schools/courses, 9 architects. `classifyNiche()` (Google category first, then search term; regex order matters) sets `niche`/`niche_rank`; lists sort by `niche_rank` (null = "fora da prioridade") then score. Collected so far: Mooca/Tatuapé/Vila Mariana/Ipiranga/Santana (first test niches) + the 9 priority niches in Tatuapé and Santo André (~200 leads). Pools, schools and architects in Tatuapé mostly already have sites — try other areas.
- **Study details**: `fetchLeadDetailsApify()` (default) / `fetchLeadDetails()` (Places) → reviews, photos, categories, review tags. Route `GET /api/leads/[id]/details`. Once per lead that gets a demo, never in bulk.
- **API** (`requireAdmin()`: session cookie or Bearer `QUEUE_API_SECRET`/`ADMIN_PASSWORD`/`CRON_SECRET`; all listed in `middleware.ts` `needsAuth` + Bearer bypass + `matcher`): `GET /api/leads?status=&q=&niche=`, `POST /api/leads/collect {query, city, max, source?}`, `GET|PATCH|DELETE /api/leads/[id]`, `GET /api/leads/[id]/details`. Production `/api/leads/collect` and `/details` need `APIFY_TOKEN` in Vercel env (**not set yet** — use the CLI scripts meanwhile).
- **Panel** `app/leads/page.tsx`: niche chips + status filters, funnel cards, collect form (niche selector + suggested areas), logo/brand colors, demo link, `wa.me` button with an editable template (viewer's localStorage), "copy `/landing-demo <id>`", event timeline, warning when a `recusou` lead still has a demo after 7 days.

### WhatsApp (Evolution API)
- Container `prumo-whatsapp` on **Render free plan** (`https://prumo-whatsapp.onrender.com`, service `srv-dbuqgpgjo6nc73asangg`), image `evoapicloud/evolution-api:v2.3.7`, created by `scripts/render-evolution.mts --free` through the Render REST API (the Render MCP can't create image-backed services; it is only for logs/deploys/env). Free plan: no disk, sleeps after 15 min and wakes in ~1 min — fine for one approved message at a time. Paid alternative (`starter` + 1 GB disk) needs a card on Render.
- DB = this Neon, direct (non-pooler) host, schema `evolution_api`, instance data only (no message history). Manager: `https://prumo-whatsapp.onrender.com/manager` with the global key `EVOLUTION_API_KEY` (in `.env.local`; never print or paste it in chat).
- Instance `webprumo` is paired with the user's WhatsApp Business. If `whatsapp.mts status` isn't `open`, run `whatsapp.mts qr` and send the user `tmp/whatsapp-qr.png` (gitignored; expires in ~1 min).
- Client: `lib/whatsapp/evolution.ts` (env `EVOLUTION_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE=webprumo`). Evolution uses the unofficial WhatsApp Web protocol (Baileys): low volume, personalised, approved messages only.

### Rules (business/legal)
- **Demos are never created automatically**: collection only fills `/leads`; the user names each lead, and approves its layout before publishing (see `../demos/CLAUDE.md`).
- **Outreach format under test (user-chosen 2026-11-19, from lead #141 on): ONE short "permission" message, no link.** Greeting + who Caique is + specific compliment (Google rating/review) + "Montei uma página de demonstração para vocês… Posso te mandar o link para dar uma olhada?". The user sends the link + full disclaimer on the phone when they reply. Reason: links from unknown numbers look like scams; 3 bubbles feel like a blast. Compare reply rate against the first 16 leads (3-bubble format) before deciding. Tips given to the user: one manual follow-up after 3–4 days, send Tue–Thu mornings (buffets) / start of business hours (clinics), Instagram DM for IG-heavy businesses.
- **Previous format (user-approved 2026-11-18, leads up to #62): 3 short WhatsApp bubbles**, not one long text: (1) greeting + who Caique is; (2) specific compliment from real reviews + "não encontrei um site" + demo link; (3) demo disclaimer (modelo de apresentação, informações públicas, não é o site oficial) + "Posso te mandar os valores? Se não fizer sentido agora, sem problema 🙂". In the text file, separate bubbles with a line containing only `---`; `whatsapp.mts send` sends them in sequence with a typing pause. **Always show the exact bubbles and wait for "aprovado" before sending.**
- **Outreach: one lead at a time, only the exact text the user approved**, sent once. Show the text first (`whatsapp.mts draft <id>` is a starting point), wait for "aprovado", then `send --approved`. Never loop, batch, schedule, follow up or reply on the user's behalf — the user handles the conversation on the phone. Use the short business name (e.g. "O+ Odontologia", not the Google listing title).
- **Approved message pattern** (user-approved for lead #55): who Caique is (web developer in São Paulo, Web Prumo) → a true compliment (Google rating) → "não encontrei um site de vocês" → "preparei um modelo de página como proposta comercial" + link → it is only a demonstration/template, not the official site, not on Google, built only from public info, removed immediately on request → offer values/details, no commitment → "Obrigado!". The user removed the opt-out line; if a business asks not to be contacted, set `descartado` and note it. Tone must be natural/conversational (user's own #84 text: greeting with 😊, who Caique is, "Conheci a <nome> pelo Google… Parabéns pelos 4,8 ⭐", "resolvi preparar uma demonstração", link, "É só um modelo de apresentação, feito com informações públicas… Não é um site oficial", how it helps get new clients, values without commitment, "O que acham? 😊"). **Always** state the link is only a demo. `whatsapp.mts draft <id> --name "<nome curto>"` follows this.
- **Demos never pass as the official site**: banner, `noindex` (meta + `X-Robots-Tag` + `robots.txt`), no invented testimonials/prices/awards/FAQs, only real Google rating/reviews. Remove a demo within 7 days when the lead is `recusou` (`/remove-demo <id>` in `../demos`), or immediately on request.
- Store only public business data needed for the approach.

### Pricing (commercial proposal)
- Private proposal PDF at `prumo/proposta-comercial-web-prumo.pdf`, generated from `prumo/proposta-comercial.html` (both **gitignored — never commit, push or send**; regenerate with Playwright `page.pdf` A4, fonts from `lib/ig/fonts`, logo `public/logo.png`). Cover leaves client/date/demo link blank.
- Landing page **R$ 400 à vista (Pix) or 4x R$ 100 sem juros** (1st installment on acceptance). Included: 2 adjustment rounds before publishing + 3 small changes in the 30 days after; domain setup once; hosting 12 months; HTTPS; basic SEO.
- Changes after that: simple R$ 40 · medium (new section/layout) R$ 120 · extra pre-publish round R$ 60 · big changes on quote. Hosting after 12 months R$ 20/month or R$ 200/year. Maintenance optional, value agreed per client (reference: Essencial from R$ 59/month, Completo from R$ 119/month). Domain bought/renewed in the client's account; Web Prumo configures DNS (domain change later R$ 60). Optional extras: contact form R$ 80, Analytics/Pixel R$ 60, Google Business Profile R$ 100, professional e-mail setup R$ 80, extra page R$ 200. Delivery ≤ 7 business days after payment + materials. Proposal valid 15 days.
- Advice given: card installments' fees come out of the R$ 400 (prefer Pix); push maintenance plans for recurring revenue; consider R$ 500–600 after 3–5 clients; host client sites somewhere that allows commercial use (Cloudflare Pages free) — Vercel Hobby forbids it.

### Current state (2026-11-18)
- Lead **#55 O+ Odontologia** (Parque Novo Mundo, dental): demo published at `https://prumo-demos.vercel.app/o-mais-odontologia-parque-novo-mundo`, first WhatsApp sent 2026-11-18 13:42, status `abordado`. Waiting for the clinic's reply (user updates via chat/panel).
- Lead **#84 Constance Saúde e Estética** (Campestre, Santo André, aesthetics): bespoke 3D demo at `https://prumo-demos.vercel.app/clinica-constance-campestre`, first WhatsApp sent 2026-11-18 (text written by the user), status `abordado`. Waiting for reply.
- Lead **#132 Buffet Espaço K** (Mooca/Cambuci, kids party venue): bespoke 3D demo at `https://prumo-demos.vercel.app/buffet-espaco-k-mooca`, first WhatsApp sent 2026-11-18 to **(11) 92155-3968** (number from their Instagram posts, set as the lead's `whatsapp`; Google lists 93940-5025 — a re-collection may overwrite it), status `abordado`. Waiting for reply.
- Lead **#148 Espaço Deks Banheiras** (Vila Prudente, spas/decks): bespoke demo (no 3D) at `https://prumo-demos.vercel.app/espaco-deks-banheiras-vila-prudente`; first WhatsApp sent **manually by the user** on 2026-11-18 (Evolution timed out), status `abordado`.
- Lead **#107 Oliver Studio Car** (Vila Formosa, car detailing): bespoke demo at `https://prumo-demos.vercel.app/oliver-studio-car-vila-formosa`, first WhatsApp sent 2026-11-18 via Evolution, status `abordado`. Improved message pattern: specific compliment quoting a real review, concrete benefit (people searching "PPF"/"vitrificação" on Google), easy closing question + low-pressure out. Wake Render first (`curl` the base URL until it answers) before `whatsapp.mts`.
- Lead **#77 Studio Amarante** (Jardim Japão, pós-op/lipedema): bespoke demo at `https://prumo-demos.vercel.app/studio-amarante-jardim-japao`, first contact sent 2026-11-18 as **3 short messages** (new format), status `abordado`.
- Lead **#166 Clínica Chazak** (Vila Maria Baixa, pilates/fisio): demo at `https://prumo-demos.vercel.app/clinica-chazak-vila-maria`, 3 short messages sent 2026-11-18; **replied with interest, user sent the commercial proposal** → status `respondeu`. First lead to respond.
- Lead **#167 Restore Clínica de Especialidades** (Parque Capuava, Santo André, fisio): demo at `https://prumo-demos.vercel.app/restore-clinica-parque-capuava`, 3 short messages sent 2026-11-18, status `abordado`. Leads #49 (Dra. Ana Lúcia — not enough material) and #85 (Patricia Bertolle — Instagram gone) set `descartado` by the user.
- Lead **#176 Colégio Maria Neri** (Vila Maria, escola infantil): demo at `https://prumo-demos.vercel.app/colegio-maria-neri-vila-maria`, 3 short messages sent 2026-11-18 with a softer close ("Se gostarem da ideia, vou adorar conversar com calma sobre ela." — no price question, no "se não for o momento"), status `abordado`.
- Lead **#169 Clínica Fokus** (Bangú, Santo André, fisio + pilates — picked because it matches Chazak, the first lead that replied): demo at `https://prumo-demos.vercel.app/clinica-fokus-santo-andre`, 3 short messages (soft close + quoting their own IG line) sent 2026-11-18, status `abordado`.
- Lead **#66 BG Saúde e Estética** (Vila Maria Alta, integrative clinic): demo at `https://prumo-demos.vercel.app/bg-saude-estetica-vila-maria`, 3 short messages in the same format as #169 (user pre-approved "como na anterior") sent 2026-11-18, status `abordado`.
- Lead **#81 Renata Arantes Estética** (Vila Maria, sobrancelhas/limpeza de pele/cílios/depilação; 5,0 · 122 reviews): demo at `https://prumo-demos.vercel.app/renata-arantes-estetica-vila-maria` (2026-11-19), 3 short messages (soft close, quoting the 20-year client and the client who found her on Google) sent 2026-11-19 via Evolution, status `abordado`.
- Lead **#165 Integra Fisioterapia Humanizada** (Tatuapé, fisio + Rolfing + acupuntura + pilates + RPG; 4,9 · 69 reviews): demo at `https://prumo-demos.vercel.app/integra-fisioterapia-tatuape` (2026-11-19), 3 short messages (Patricia quote "me arrastando… desfilando", Rolfing benefit, soft close) sent 2026-11-19 via Evolution, status `abordado`. Lead **#170 Fisioterapia Integrada São Nicolau** set `descartado` (convênio policlinic with no vacancies, no digital presence).
- Lead **#62 Clínica Odontológica Gerações** (Parque Novo Oratório, Santo André, family dentistry, IG @odonto.geracoes, 26 years; 5,0 · 57 reviews): demo at `https://prumo-demos.vercel.app/geracoes-odontologia-santo-andre` (2026-11-19), 3 short messages (20-year patient + "trauma de dentista… quase dormindo", Google search benefit, soft close) sent 2026-11-19 via Evolution, status `abordado`. Picked to balance niches (user asked to alternate odonto/fisio/other).
- Lead **#141 Buffet SR Kids** (Vila Homero Thon, Santo André, kids party venue, IG @buffet_srkids; 4,9 · 460 reviews): demo at `https://prumo-demos.vercel.app/buffet-sr-kids-santo-andre` (2026-11-19); **first lead with the new 1-message permission format** (no link) sent 2026-11-19 via Evolution, status `abordado`.
- Lead **#61 Clínica Kanashiro Odontologia** (Utinga, Santo André, IG @clinicakanashiro; 4,9 · 54 reviews, 4 patients say they found it on Google): demo at `https://prumo-demos.vercel.app/kanashiro-odontologia-santo-andre` (2026-11-19), status `publicado`, outreach pending approval (user asked to send WITH the link this time).
- Pending (user side): `APIFY_TOKEN` (and optionally `GOOGLE_PLACES_API_KEY`) in Vercel env; rotate the Apify token (it was pasted in chat); point `demos.webprumo.com.br` to the demos project; Next 16.4.3 has a moderate advisory fixed in 16.4.6 (`next upgrade`), not applied yet; Render MCP was added by the user but wasn't visible in this session — check `claude mcp list`.

### Skills and MCPs
- Design skills live in the **Windows** profile (`C:\Users\Hitss\.claude\skills`) and are symlinked into `demos/.claude/skills/` (`design-taste-frontend`, `impeccable`, `frontend-design`, `web-design-guidelines`).
- The Windows `.claude.json` MCP entries `google-leads` and `maps-harvest` have empty URLs (broken) — don't use them.
- Playwright for screenshots/PDF: `worker/node_modules/playwright` (Chromium in `~/.cache/ms-playwright`). Docker is available in WSL if a local service is ever needed.
- `vercel` CLI under nvm v20/v24. Both repos auto-deploy from GitHub pushes.

## Reels / media production (local, outside Next)

- Reels are HTML animations in `media/` (`media/formats/*.html`, `reel-*.html`) captured frame-by-frame with Playwright and encoded with ffmpeg (audio from `media/synth-music.js`) by `scripts/render-*.mjs`. Per-week manifests are `media/reels-weekN.json`; output goes to `public/ig/...` and is enqueued with `scripts/queue-reels-weekN.mjs` (via public site URL or GitHub raw fallback).
- Planning/briefs/caption drafts for each content week live in `content/*.md` (pt-BR).
- Many `scripts/*.sh|mjs` are one-off helpers and **hardcode `ROOT=/home/hitss/prumo` and `/home/hitss/.local/bin/ffmpeg`**; the repo now lives at `/home/hitss/webPrumo/prumo`, so fix the path before reusing one. `commit-*.sh` scripts are ad-hoc commit helpers, not part of any workflow.
