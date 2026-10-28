import { put } from "@vercel/blob";
import { assertNoRepeat, bank, buildCaption, pickItem, slotKey, titleOf } from "@/lib/ig/content";
import { authorized } from "@/lib/ig/http";
import { refreshStoredTokens } from "@/lib/ig/auth";
import { account, publishImage } from "@/lib/ig/publish";
import { renderFeedImage } from "@/lib/ig/render";
import { insertPublication, logEvent, publishedState } from "@/lib/ig/store";

export const maxDuration = 60;

async function run(req: Request) {
  if (!authorized(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const force = new URL(req.url).searchParams.get("force") === "1";
  const now = new Date();
  const slot = force ? `manual-${now.toISOString().slice(0, 16)}` : slotKey(now);

  await logEvent("info", "cron", "cron iniciado", { slot, force });

  try {
    const refresh = await refreshStoredTokens();
    await logEvent("info", "token_refresh", refresh.refreshed ? "token renovado" : "token válido", refresh);
  } catch (err) {
    const message = err instanceof Error ? err.message : "falhou ao renovar token";
    await logEvent("error", "token_refresh", message);
    return Response.json({ error: message }, { status: 500 });
  }

  const state = await publishedState();
  if (!force && state.published.some((p) => p.slot === slot)) {
    await logEvent("info", "cron", "já publicado neste horário", { slot });
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

  await insertPublication({
    slot,
    itemId: item.id,
    title: titleOf(item),
    layout: item.layout,
    format: "post",
    mediaId: published.id,
    permalink: published.permalink,
    imageUrl,
    caption,
    dark: inverted,
  });
  await logEvent("info", "publish", "post publicado", {
    slot,
    item: item.id,
    layout: item.layout,
    permalink: published.permalink,
  });

  return Response.json({
    ok: true,
    slot,
    item: item.id,
    layout: item.layout,
    dark: inverted,
    image: imageUrl,
    permalink: published.permalink,
    account: ig.username,
    remaining: bank.filter((it) => !state.published.some((p) => p.id === it.id)).length - 1,
  });
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
    await logEvent("error", "cron", message);
    return Response.json({ error: message }, { status: 500 });
  }
}

export const POST = GET;
