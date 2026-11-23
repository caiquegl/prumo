/**
 * Disparo de hora em hora (GitHub Actions `.github/workflows/outreach.yml`, ou manual):
 * coloca na fila os follow-ups vencidos (se ligados no painel) e envia até N itens JÁ APROVADOS (follow-ups primeiro,
 * depois primeiros contatos).
 *
 *   npx tsx --env-file=.env.local scripts/outreach-run.mts [--max 8] [--force] [--dry]
 *
 * Ritmo (pedido do Caique): 1 min entre um lead e o próximo, 30 s entre os balões de cada mensagem.
 *
 * Travas: só horário comercial (America/Sao_Paulo: seg–sex 9h–18h, sáb 9h–12h) salvo --force; teto diário
 * OUTREACH_DAILY_CAP (padrão 64); para o lote inteiro se o WhatsApp não estiver "open" ou cair no meio.
 * Nunca envia rascunho: só itens com status "approved".
 */
import { ensureOpen, LEAD_GAP_MS, sendItem, StopAll } from "@/lib/outreach/send";
import { enqueueDueFollowups } from "@/lib/outreach/followups";
import { nextApprovedOutbound, queueCounts } from "@/lib/outreach/store";
import { notifyNumber, sendText } from "@/lib/whatsapp/evolution";
import { shortName } from "@/lib/outreach/messages";

const args = process.argv.slice(2);
const flag = (n: string, d: number) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? Number(args[i + 1]) : d;
};
const MAX = flag("max", 8);
const FORCE = args.includes("--force");
const DRY = args.includes("--dry");
const CAP = Number(process.env.OUTREACH_DAILY_CAP || 64);

function spNow() {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", weekday: "short", hour: "numeric", hour12: false }).formatToParts(new Date());
  const wd = parts.find((p) => p.type === "weekday")?.value ?? "";
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  return { wd, h };
}

function businessHours() {
  const { wd, h } = spNow();
  if (["Mon", "Tue", "Wed", "Thu", "Fri"].includes(wd)) return h >= 9 && h < 18;
  if (wd === "Sat") return h >= 9 && h < 12;
  return false;
}

async function wakeEvolution() {
  const url = process.env.EVOLUTION_URL?.replace(/\/$/, "");
  if (!url) throw new Error("EVOLUTION_URL ausente");
  for (let i = 0; i < 18; i++) {
    const ok = await fetch(url, { signal: AbortSignal.timeout(20_000) }).then((r) => r.ok).catch(() => false);
    if (ok) return;
    await new Promise((r) => setTimeout(r, 10_000));
  }
  throw new StopAll("Evolution não acordou em 3 min");
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  if (!FORCE && !businessHours()) {
    console.log("fora do horário comercial — nada a fazer", spNow());
    return;
  }
  const fu = await enqueueDueFollowups();
  if (fu.enabled) console.log(`follow-ups colocados na fila: ${fu.followup1} lembretes (3º dia), ${fu.followup2} encerramentos (7º dia)`);
  const counts = await queueCounts();
  const room = Math.max(0, CAP - (counts.sent_today ?? 0));
  const items = await nextApprovedOutbound(Math.min(MAX, room));
  console.log(`aprovados na fila: ${counts.approved ?? 0} · enviados hoje: ${counts.sent_today ?? 0}/${CAP} · neste lote: ${items.length}`);
  if (!items.length) return;
  if (DRY) {
    for (const it of items) console.log(`[dry] #${it.id} → ${it.lead_name} (+${it.lead_whatsapp})`);
    return;
  }

  const results: Result[] = [];
  try {
    await wakeEvolution();
    await ensureOpen();
    for (const [i, it] of items.entries()) {
      if (i) await sleep(LEAD_GAP_MS);
      try {
        await ensureOpen();
        const sent = await sendItem(it);
        results.push({ it, status: sent ? "ok" : "pulado", why: sent ? undefined : "não está mais aprovado ou sem WhatsApp" });
        console.log(sent ? `enviado #${it.id} → ${it.lead_name}` : `pulado #${it.id} (${it.lead_name}): não está mais aprovado ou sem WhatsApp`);
      } catch (e) {
        results.push({ it, status: "erro", why: (e as Error).message });
        console.error(`falhou #${it.id} (${it.lead_name}): ${(e as Error).message}`);
        if (e instanceof StopAll) throw e;
      }
    }
  } catch (e) {
    if (!(e instanceof StopAll)) throw e;
    console.error("PARANDO o lote: WhatsApp desconectado/deslogado. Reparear (whatsapp.mts qr) antes de continuar.");
    process.exitCode = 1;
    const done = new Set(results.map((r) => r.it.id));
    for (const it of items) if (!done.has(it.id)) results.push({ it, status: "nao_enviado", why: "lote parado" });
    await notifySummary(results, `⚠️ Lote parado: ${(e as Error).message}`);
    return;
  }
  await notifySummary(results);
}

type Item = Awaited<ReturnType<typeof nextApprovedOutbound>>[number];
type Result = { it: Item; status: "ok" | "pulado" | "erro" | "nao_enviado"; why?: string };

const KIND: Record<string, string> = { cold: "1º contato", followup1: "lembrete", followup2: "encerramento", reply: "resposta" };
const ICON = { ok: "✅", pulado: "⏭️", erro: "❌", nao_enviado: "⏸️" };

/** Resumo do lote no WhatsApp pessoal do Caique. Se o próprio WhatsApp caiu, a mensagem não sai (fica só no log). */
async function notifySummary(results: Result[], header?: string) {
  if (!results.length) return;
  const ok = results.filter((r) => r.status === "ok").length;
  const hora = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }).format(new Date());
  const lines = results.map(
    (r) => `${ICON[r.status]} ${shortName(r.it.lead_name)} (${KIND[r.it.kind] ?? r.it.kind})${r.why ? ` — ${r.why}` : ""}`,
  );
  const fails = results.length - ok;
  const text = [
    header,
    `📤 Lote das ${hora}: ${ok} de ${results.length} enviados${fails ? `, ${fails} com problema` : ""}.`,
    "",
    ...lines,
    "",
    "Painel: https://prumo-tawny.vercel.app/leads/disparos",
  ]
    .filter((l) => l !== undefined)
    .join("\n");
  try {
    await sendText(notifyNumber(), text);
    console.log("resumo enviado ao WhatsApp do Caique");
  } catch (e) {
    console.error(`não consegui mandar o resumo: ${(e as Error).message}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
