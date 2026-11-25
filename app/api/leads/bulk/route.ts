import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/guard";
import { getLead, parseLeadPatch, updateLead } from "@/lib/leads/store";
import type { Lead } from "@/lib/leads/types";
import { renderTemplate } from "@/lib/outreach/messages";
import { cancelQueuedForLeads, enqueueCold } from "@/lib/outreach/store";
import { loadTemplates } from "@/lib/outreach/templates";

/**
 * Ação em massa do painel /leads: aplica o mesmo PATCH (status, interesse, "touch", nota) a vários leads,
 * cada um pelo updateLead() (gera lead_events), e/ou tira esses leads da fila de disparos automáticos.
 * `enqueue`: coloca os leads na fila de primeiro contato já aprovada, com a mensagem padrão do painel; o runner de
 * hora em hora envia 1 por vez. Esta rota em si não envia mensagem nenhuma.
 */
export async function POST(req: NextRequest) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as {
    ids?: unknown;
    patch?: Record<string, unknown>;
    cancelQueue?: boolean;
    enqueue?: boolean;
  } | null;
  const ids = Array.isArray(body?.ids)
    ? [...new Set(body.ids.map(Number).filter((n) => Number.isInteger(n) && n > 0))].slice(0, 500)
    : [];
  if (!ids.length) return NextResponse.json({ error: "nenhum lead selecionado" }, { status: 400 });

  const cancelled = body?.cancelQueue ? await cancelQueuedForLeads(ids) : 0;
  let enqueued = 0;
  if (body?.enqueue) {
    const { tpl_manual } = await loadTemplates();
    enqueued = await enqueueCold(ids, (lead) => renderTemplate(tpl_manual, lead));
  }

  const leads: Lead[] = [];
  if (body?.patch && Object.keys(body.patch).length) {
    const patch = parseLeadPatch(body.patch);
    if (typeof patch === "string") return NextResponse.json({ error: patch }, { status: 400 });
    for (const id of ids) {
      const lead = await updateLead(id, patch);
      if (lead) leads.push(lead);
    }
  } else {
    for (const id of ids) {
      const lead = await getLead(id);
      if (lead) leads.push(lead);
    }
  }
  return NextResponse.json({ ok: true, updated: leads.length, cancelled, enqueued, leads });
}
