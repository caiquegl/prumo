import { produceManagedPost } from "@/lib/ig/manager";
import { assertNoRepeat, titleOf } from "@/lib/ig/content";
import { authorized } from "@/lib/ig/http";
import { refreshStoredTokens } from "@/lib/ig/auth";
import { account, publishImage, recentCaptions } from "@/lib/ig/publish";
import { insertPublication, logEvent, publishedState, saveDraft } from "@/lib/ig/store";

export const maxDuration = 300;

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

  const captions = await recentCaptions(30).catch(() => [] as string[]);
  const origin = new URL(req.url).origin;
  const managed = await produceManagedPost({
    state,
    captions,
    reqOrigin: origin,
    saveDraft,
  });

  assertNoRepeat(state, managed.item);
  await logEvent("info", "agency", "gerente fechou a peça", {
    id: managed.item.id,
    layout: managed.item.layout,
    angle: managed.item.angle,
    artist: managed.artist,
    attempts: managed.attempts,
  });

  const ig = await account();
  const published = await publishImage(managed.imageUrl, managed.caption);

  await insertPublication({
    slot,
    itemId: managed.item.id,
    title: titleOf(managed.item),
    layout: managed.item.layout,
    format: "post",
    mediaId: published.id,
    permalink: published.permalink,
    imageUrl: managed.imageUrl,
    caption: managed.caption,
    dark: false,
    photoId: managed.item.concept
      ? `concept:${managed.item.concept}`
      : managed.item.photoId ?? null,
  });
  await logEvent("info", "publish", "post publicado", {
    slot,
    item: managed.item.id,
    layout: managed.item.layout,
    angle: managed.item.angle,
    artist: managed.artist,
    permalink: published.permalink,
  });

  return Response.json({
    ok: true,
    slot,
    item: managed.item.id,
    layout: managed.item.layout,
    angle: managed.item.angle,
    pillar: managed.item.pillar,
    artist: managed.artist,
    attempts: managed.attempts,
    image: managed.imageUrl,
    permalink: published.permalink,
    account: ig.username,
  });
}

function slotKey(now = new Date()) {
  const hour = now.getUTCHours();
  const slots = [11, 15, 21];
  const nearest = slots.reduce((a, b) => (Math.abs(b - hour) < Math.abs(a - hour) ? b : a));
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), nearest));
  return d.toISOString().slice(0, 13);
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
