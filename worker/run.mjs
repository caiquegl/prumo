#!/usr/bin/env node
// Instagram autopost: picks the next content, renders it in the Prumo visual style and publishes it.
// Usage: node worker/run.mjs   (configuration via environment variables, see worker/README.md)
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { buildCaption, loadBank, pickItem, titleOf } from "./content.mjs";
import { render } from "./render.mjs";
import { instagram } from "./instagram.mjs";
import { mediaStore, originUrl } from "./storage.mjs";

const env = process.env;
const REPO_DIR = fileURLToPath(new URL("..", import.meta.url));
const SLOTS_UTC = [11, 15, 21]; // 08:00, 12:00 e 18:00 em Brasília (UTC-3, sem horário de verão)
const MAX_WAIT_MS = 45 * 60 * 1000;
const TRANSPOSE = [0, -3, 2, 5, -2, 3];
const flag = (v, def = false) => (v === undefined || v === "" ? def : /^(1|true|yes|sim)$/i.test(v));
const log = msg => console.log(`[${new Date().toISOString()}] ${msg}`);
const sleep = ms => new Promise(r => setTimeout(r, ms));

function nearestSlot(now) {
  const candidates = [-1, 0, 1].flatMap(day => SLOTS_UTC.map(h =>
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + day, h))));
  const best = candidates.reduce((a, b) => (Math.abs(b - now) < Math.abs(a - now) ? b : a));
  return Math.abs(best - now) <= 3 * 3600 * 1000 ? best : null;
}

async function main() {
  const dryRun = flag(env.DRY_RUN);
  const force = flag(env.FORCE);
  const now = new Date();
  const slot = nearestSlot(now);
  const slotKey = slot && !force ? slot.toISOString().slice(0, 13) : `manual-${now.toISOString().slice(0, 16)}`;

  const repo = env.GITHUB_REPOSITORY || "caiquegl/prumo";
  const remote = env.MEDIA_REMOTE
    || (env.GITHUB_TOKEN ? `https://x-access-token:${env.GITHUB_TOKEN}@github.com/${repo}.git` : await originUrl(REPO_DIR));
  const store = mediaStore({ repoDir: REPO_DIR, remote, repo });
  const state = await store.readState();

  if (state.published.some(p => p.slot === slotKey)) {
    log(`horário ${slotKey} já publicado, nada a fazer`);
    return;
  }

  const bank = await loadBank(join(REPO_DIR, "worker", "bank.json"));
  const item = await pickItem({ bank, state, apiKey: env.OPENAI_API_KEY, model: env.OPENAI_MODEL || "gpt-4o-mini", log });
  const last = state.published.at(-1);
  const format = ["post", "reel"].includes(env.FORMAT) ? env.FORMAT : last?.format === "reel" ? "post" : "reel";
  const reels = state.published.filter(p => p.format === "reel").length;
  const dark = state.published.length % 3 === 2;
  log(`conteúdo "${item.id}" (${item.layout}) como ${format}${dark ? " escuro" : ""}`);

  const outDir = env.OUT_DIR || join(REPO_DIR, "worker", "out");
  await mkdir(outDir, { recursive: true });
  const name = `prumo-auto-${now.toISOString().slice(0, 10)}-${item.id}`.slice(0, 90);
  const files = await render({ item, format, dark, transpose: TRANSPOSE[reels % TRANSPOSE.length], outDir, name });
  const caption = buildCaption(item);
  log(`renderizado: ${Object.values(files).join(", ")}`);

  if (dryRun) {
    console.log(`\n--- legenda ---\n${caption}\n`);
    log("DRY_RUN ativo: nada foi enviado nem publicado");
    return;
  }

  if (!env.META_PAGE_TOKEN) throw new Error("META_PAGE_TOKEN não configurado");
  const ig = instagram({ igId: env.IG_USER_ID || "17841427877735853", token: env.META_PAGE_TOKEN });
  log(`conta: ${JSON.stringify(await ig.account())}`);

  const media = format === "reel" ? [files.video, files.cover] : [files.image];
  const { url } = await store.commit(state, media, `media: ${name}`);
  log(`mídia enviada: ${media.map(url).join(" ")}`);

  const waitMs = slot && flag(env.WAIT, true) && !force ? slot - Date.now() : 0;
  if (waitMs > 0) {
    log(`aguardando ${Math.round(Math.min(waitMs, MAX_WAIT_MS) / 60000)} min até o horário de publicação`);
    await sleep(Math.min(waitMs, MAX_WAIT_MS));
  }

  const result = await ig.publish(format === "reel"
    ? { kind: "reel", url: url(files.video), coverUrl: url(files.cover), caption }
    : { kind: "post", url: url(files.image), caption });
  log(`publicado ${result.id} ${result.permalink}`);

  state.published.push({
    slot: slotKey, id: item.id, title: titleOf(item), layout: item.layout, format,
    media_id: result.id, permalink: result.permalink, published_at: new Date().toISOString(),
    ...(item.id.startsWith("ia-") ? { item } : {}),
  });
  state.published = state.published.slice(-500);
  await store.commit(state, [], `state: ${slotKey} ${item.id}`);
  log("histórico atualizado");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
