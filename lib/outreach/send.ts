import { updateLead } from "@/lib/leads/store";
import { connectionState, hasWhatsApp, sendText } from "@/lib/whatsapp/evolution";
import { claim, markFailed, markInboxHandled, markSent, type OutreachItem } from "./store";

/** Pausa entre os balões de uma mesma mensagem (pedido do Caique: 30 s). */
export const BUBBLE_GAP_MS = 30_000;
/** Pausa entre um lead e o próximo no lote de hora em hora (pedido do Caique: 1 min). */
export const LEAD_GAP_MS = 60_000;

/** Erro que deve parar o lote inteiro (WhatsApp desconectado / deslogado). */
export class StopAll extends Error {}

/**
 * Garante WhatsApp "open". Logo após o Render acordar a instância passa alguns segundos em "connecting":
 * espera até `waitMs` (padrão 2 min, checando a cada 10 s) antes de parar o lote.
 */
export async function ensureOpen(waitMs = 120_000) {
  const until = Date.now() + waitMs;
  let s = "";
  for (;;) {
    s = await connectionState().catch((e) => `erro: ${(e as Error).message}`);
    if (s === "open") return;
    if (Date.now() >= until) break;
    await new Promise((r) => setTimeout(r, 10_000));
  }
  throw new StopAll(`WhatsApp não está conectado (estado: ${s})`);
}

/**
 * Envia um item APROVADO da fila: balões separados por linha "---", pausa de digitação entre eles.
 * Cold → lead vira "abordado". Reply → marca a caixa de entrada do lead como respondida.
 */
export async function sendItem(item: OutreachItem): Promise<boolean> {
  if (item.status !== "approved") throw new Error(`item #${item.id} não está aprovado`);
  // reserva no banco: se o Caique voltou o item para rascunho/cancelou no meio da rodada, não envia
  if (!(await claim(item.id))) return false;
  const number = item.lead_whatsapp;
  if (!number) {
    await markFailed(item.id, "lead sem WhatsApp");
    return false;
  }
  if (item.kind === "cold" && !(await hasWhatsApp(number))) {
    await markFailed(item.id, "número sem WhatsApp");
    return false;
  }
  const parts = item.text.split(/^\s*---\s*$/m).map((p) => p.trim()).filter(Boolean);
  const ids: string[] = [];
  try {
    for (const [i, part] of parts.entries()) {
      if (i) await new Promise((r) => setTimeout(r, BUBBLE_GAP_MS));
      const r = await sendText(number, part);
      ids.push(r.key?.id ?? "?");
    }
  } catch (e) {
    const msg = (e as Error).message;
    await markFailed(item.id, msg);
    if (/401|403|close|not connected|Connection Closed/i.test(msg)) throw new StopAll(msg);
    return false;
  }
  await markSent(item.id, ids);
  const flat = parts.join(" ¶ ");
  if (item.kind === "cold") {
    await updateLead(item.lead_id, {
      status: "abordado",
      event_note: `WhatsApp (automação aprovada, ${parts.length} msg): ${flat.slice(0, 180)}${flat.length > 180 ? "…" : ""}`,
    });
  } else if (item.kind === "followup1") {
    await updateLead(item.lead_id, { event_note: `Follow-up (3º dia): ${flat.slice(0, 180)}` });
  } else if (item.kind === "followup2") {
    await updateLead(item.lead_id, { status: "sem_resposta", event_note: `Mensagem de encerramento (7º dia): ${flat.slice(0, 160)}` });
  } else {
    await markInboxHandled(item.lead_id);
    await updateLead(item.lead_id, { event_note: `Resposta enviada (aprovada no painel): ${flat.slice(0, 180)}` });
  }
  return true;
}
