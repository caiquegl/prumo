import { authorized } from "@/lib/ig/http";
import { refreshStoredTokens } from "@/lib/ig/auth";
import { publishClaimedQueueItem } from "@/lib/ig/dispatch";
import { claimNextPending, claimQueuePost, markQueueFailed } from "@/lib/ig/queue";
import { logEvent, publishedState } from "@/lib/ig/store";

export const maxDuration = 300;

async function run(req: Request) {
  if (!authorized(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "1";
  const idParam = Number(url.searchParams.get("id"));
  const now = new Date();
  const slot = force || Number.isFinite(idParam)
    ? `manual-${now.toISOString().slice(0, 16)}`
    : slotKey(now);

  await logEvent("info", "cron", "cron iniciado (fila)", { slot, force });

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

  const claimed = Number.isFinite(idParam) && idParam > 0
    ? await claimQueuePost(idParam)
    : await claimNextPending();
  if (!claimed) {
    const reason = Number.isFinite(idParam) && idParam > 0
      ? `post ${idParam} não está pending/failed`
      : "fila vazia";
    await logEvent("info", "cron", reason, { slot, idParam });
    return Response.json({ ok: true, skipped: true, slot, reason });
  }

  await logEvent("info", "queue", "claim pending", {
    id: claimed.id,
    mediaType: claimed.media_type,
    sort: claimed.sort_order,
  });

  try {
    const published = await publishClaimedQueueItem(claimed, slot);
    return Response.json(published);
  } catch (err) {
    const message = err instanceof Error ? err.message : "falhou ao publicar fila";
    await markQueueFailed(claimed.id, message);
    await logEvent("error", "publish", message, { queueId: claimed.id });
    return Response.json({ error: message, queueId: claimed.id }, { status: 500 });
  }
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
