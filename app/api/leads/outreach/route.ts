import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/guard";
import { getLead, updateLead } from "@/lib/leads/store";
import { coldMessage, DEFAULT_TEMPLATES, draftReply, TEMPLATE_FIELDS, type TemplateKey } from "@/lib/outreach/messages";
import { enqueueDueFollowups } from "@/lib/outreach/followups";
import { loadTemplates } from "@/lib/outreach/templates";
import { estimateEta } from "@/lib/outreach/schedule";
import { ensureOpen, sendItem, StopAll } from "@/lib/outreach/send";
import {
  addDraft,
  approve,
  cancel,
  coldCandidates,
  conversation,
  editDraft,
  getItem,
  listInbox,
  listQueue,
  nextApprovedOutbound,
  queueCounts,
  saveSettings,
} from "@/lib/outreach/store";

export const maxDuration = 60;

const unauthorized = () => NextResponse.json({ error: "Unauthorized" }, { status: 401 });

/** Painel /leads/disparos: rascunhos, fila aprovada, enviados recentes e caixa de entrada. */
export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) return unauthorized();
  const [drafts, approved, done, inbox, counts, templates] = await Promise.all([
    listQueue(["draft"]),
    nextApprovedOutbound(500),
    listQueue(["sent", "failed"], 60),
    listInbox(60),
    queueCounts(),
    loadTemplates(),
  ]);
  const eta = estimateEta(approved, { sentToday: counts.sent_today ?? 0, dailyCap: Number(process.env.OUTREACH_DAILY_CAP || 64) });
  return NextResponse.json({ drafts, approved, done: done.reverse(), inbox, counts, eta, templates, defaults: DEFAULT_TEMPLATES, fields: TEMPLATE_FIELDS });
}

type Body =
  | { action: "generate"; count?: number }
  | { action: "approve" | "cancel"; ids: number[] }
  | { action: "edit"; id: number; text: string }
  | { action: "redraft"; leadId: number }
  | { action: "send"; id: number; text?: string }
  | { action: "sendNow"; id: number }
  | { action: "saveTemplates"; templates: Partial<Record<TemplateKey, string>>; followups_enabled?: boolean }
  | { action: "applyTemplate" };

export async function POST(req: NextRequest) {
  if (!(await requireAdmin(req))) return unauthorized();
  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body?.action) return NextResponse.json({ error: "JSON inválido" }, { status: 400 });

  switch (body.action) {
    case "generate": {
      // Rascunhos de primeiro contato para os próximos leads da prioridade (nada é enviado sem aprovação).
      const n = Math.min(Math.max(Number(body.count) || 8, 1), 40);
      const ids = await coldCandidates(n);
      const { tpl_cold } = await loadTemplates();
      let created = 0;
      for (const { id } of ids) {
        const lead = await getLead(id);
        if (!lead) continue;
        if (!lead.whatsapp && lead.phone) {
          const d = lead.phone.replace(/\D/g, "");
          await updateLead(id, { whatsapp: d.startsWith("55") ? d : `55${d}` });
        }
        await addDraft(id, "cold", coldMessage(lead, tpl_cold));
        created++;
      }
      return NextResponse.json({ created });
    }
    case "approve":
      return NextResponse.json({ approved: await approve(body.ids ?? []) });
    case "cancel":
      return NextResponse.json({ cancelled: await cancel(body.ids ?? []) });
    case "edit":
      if (!body.text?.trim()) return NextResponse.json({ error: "texto vazio" }, { status: 400 });
      await editDraft(body.id, body.text.trim());
      return NextResponse.json({ ok: true });
    case "redraft": {
      const lead = await getLead(body.leadId);
      if (!lead) return NextResponse.json({ error: "lead não encontrado" }, { status: 404 });
      const pending = (await listQueue(["draft"])).filter((q) => q.lead_id === lead.id && q.kind === "reply");
      await cancel(pending.map((q) => q.id));
      const text = await draftReply({ lead, history: await conversation(lead.id) });
      return NextResponse.json({ id: await addDraft(lead.id, "reply", text) });
    }
    case "sendNow":
      return sendNow(body.id);
    case "saveTemplates": {
      const values: Record<string, string> = {};
      for (const k of Object.keys(DEFAULT_TEMPLATES) as TemplateKey[]) {
        const v = body.templates?.[k];
        if (typeof v === "string") values[k] = v.trim();
      }
      if (typeof body.followups_enabled === "boolean") values.followups_enabled = String(body.followups_enabled);
      await saveSettings(values);
      // ao ligar, já coloca na fila quem estiver vencido (sai na próxima rodada do horário comercial)
      const queued = body.followups_enabled ? await enqueueDueFollowups() : null;
      return NextResponse.json({ ok: true, queued });
    }
    case "applyTemplate": {
      // reescreve os rascunhos de 1º contato com o modelo atual (itens aprovados não mudam)
      const { tpl_cold } = await loadTemplates();
      let n = 0;
      for (const d of (await listQueue(["draft"])).filter((q) => q.kind === "cold")) {
        const lead = await getLead(d.lead_id);
        if (!lead) continue;
        await editDraft(d.id, coldMessage(lead, tpl_cold));
        n++;
      }
      return NextResponse.json({ updated: n });
    }
    case "send": {
      // Resposta a um lead: o clique em "Enviar" é a aprovação (com o texto que estiver na tela).
      const item = await getItem(body.id);
      if (!item || item.kind !== "reply") return NextResponse.json({ error: "rascunho de resposta não encontrado" }, { status: 404 });
      if (body.text?.trim()) await editDraft(item.id, body.text.trim());
      await approve([item.id]);
      try {
        await ensureOpen(15_000);
        await sendItem((await getItem(item.id))!);
      } catch (e) {
        const status = e instanceof StopAll ? 503 : 500;
        return NextResponse.json({ error: (e as Error).message }, { status });
      }
      return NextResponse.json({ ok: true, item: await getItem(item.id) });
    }
  }
  return NextResponse.json({ error: "ação desconhecida" }, { status: 400 });
}

/** "Enviar agora": dispara um item já aprovado da fila na hora, fora da rodada de hora em hora. */
async function sendNow(id: number) {
  const item = await getItem(id);
  if (!item || item.status !== "approved") return NextResponse.json({ error: "item não está na fila de aprovados" }, { status: 404 });
  try {
    await ensureOpen(15_000);
    await sendItem(item);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: e instanceof StopAll ? 503 : 500 });
  }
  const after = await getItem(id);
  if (after?.status !== "sent") return NextResponse.json({ error: after?.error ?? "não enviado" }, { status: 502 });
  return NextResponse.json({ ok: true, item: after });
}
