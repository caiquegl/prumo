import { put } from "@vercel/blob";
import { assertNoRepeat, bank, buildCaption, pickItem, slotKey, titleOf } from "@/lib/ig/content";
import { account, publishImage, recentCaptions } from "@/lib/ig/publish";
import { renderFeedImage } from "@/lib/ig/render";
import { readState, writeState } from "@/lib/ig/state";
import type { IgState } from "@/lib/ig/types";

export const maxDuration = 60;

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  const header = req.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const query = new URL(req.url).searchParams.get("secret") || "";
  return token === secret || query === secret;
}

async function run(req: Request) {
  if (!authorized(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!process.env.META_PAGE_TOKEN) {
    return Response.json(
      { error: "META_PAGE_TOKEN ausente. Gere o token da Página e coloque no .env da Vercel." },
      { status: 500 },
    );
  }

  const force = new URL(req.url).searchParams.get("force") === "1";
  const now = new Date();
  const slot = force ? `manual-${now.toISOString().slice(0, 16)}` : slotKey(now);
  const state = await loadState();

  if (!force && state.published.some((p) => p.slot === slot)) {
    return Response.json({ ok: true, skipped: true, slot, reason: "já publicado neste horário" });
  }

  const item = pickItem(state);
  assertNoRepeat(state, item);
  const inverted = state.published.length % 3 === 2 && item.layout !== "quote";
  const png = await renderFeedImage(item, inverted);
  const imageUrl = await uploadOrPublicUrl(req, png, item.id, inverted);

  const caption = buildCaption(item);
  const ig = await account();
  const published = await publishImage(imageUrl, caption);

  state.published.push({
    slot,
    id: item.id,
    title: titleOf(item),
    layout: item.layout,
    format: "post",
    media_id: published.id,
    permalink: published.permalink,
    published_at: new Date().toISOString(),
  });
  try {
    await writeState(state);
  } catch (err) {
    console.error("[ig-cron] não gravou estado no Blob:", err);
  }

  return Response.json({
    ok: true,
    slot,
    item: item.id,
    layout: item.layout,
    dark: inverted,
    image: imageUrl,
    permalink: published.permalink,
    account: ig.username,
    remaining: bank.filter((it) => !state.published.some((p) => p.id === it.id)).length,
  });
}

async function loadState(): Promise<IgState> {
  const fromBlob = await readState();
  if (fromBlob.published.length) return fromBlob;
  try {
    const captions = await recentCaptions();
    const used = bank.filter((it) => captions.some((c) => c.includes(it.hook) || c.includes(titleOf(it))));
    return {
      published: used.map((it, i) => ({
        slot: `inferred-${i}`,
        id: it.id,
        title: titleOf(it),
        layout: it.layout,
        format: "post" as const,
        published_at: new Date().toISOString(),
      })),
    };
  } catch {
    return fromBlob;
  }
}

async function uploadOrPublicUrl(req: Request, png: Buffer, id: string, inverted: boolean) {
  try {
    const blob = await put(`ig-auto/${id}-${Date.now()}.png`, png, {
      access: "public",
      contentType: "image/png",
      addRandomSuffix: true,
    });
    return blob.url;
  } catch (err) {
    console.error("[ig-cron] Blob indisponível, usando /api/og/feed:", err);
    const origin = new URL(req.url).origin;
    return `${origin}/api/og/feed?id=${encodeURIComponent(id)}&dark=${inverted ? "1" : "0"}&t=${Date.now()}`;
  }
}

export async function GET(req: Request) {
  try {
    return await run(req);
  } catch (err) {
    const message = err instanceof Error ? err.message : "falhou";
    console.error("[ig-cron]", message);
    return Response.json({ error: message }, { status: 500 });
  }
}

export const POST = GET;
