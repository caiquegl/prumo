import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/guard";
import { getLead, updateLead } from "@/lib/leads/store";
import { coldMessage, draftReply } from "@/lib/outreach/messages";
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
  queueCounts,
} from "@/lib/outreach/store";

export const maxDuration = 60;

const unauthorized = () => NextResponse.json({ error: "Unauthorized" }, { status: 401 });

/** Painel /leads/disparos: rascunhos, fila aprovada, enviados recentes e caixa de entrada. */
export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) return unauthorized();
  const [drafts, approved, done, inbox, counts] = await Promise.all([
    listQueue(["draft"]),
    listQueue(["approved"]),
    listQueue(["sent", "failed"], 60),
    listInbox(60),
    queueCounts(),
  ]);
  return NextResponse.json({ drafts, approved, done: done.reverse(), inbox, counts });
}

type Body =
  | { action: "generate"; count?: number }
  | { action: "approve" | "cancel"; ids: number[] }
  | { action: "edit"; id: number; text: string }
  | { action: "redraft"; leadId: number }
  | { action: "send"; id: number; text?: string };

export async function POST(req: NextRequest) {
  if (!(await requireAdmin(req))) return unauthorized();
  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body?.action) return NextResponse.json({ error: "JSON inválido" }, { status: 400 });

  switch (body.action) {
    case "generate": {
      // Rascunhos de primeiro contato para os próximos leads da prioridade (nada é enviado sem aprovação).
      const n = Math.min(Math.max(Number(body.count) || 8, 1), 40);
      const ids = await coldCandidates(n);
      let created = 0;
      for (const { id } of ids) {
        const lead = await getLead(id);
        if (!lead) continue;
        if (!lead.whatsapp && lead.phone) {
          const d = lead.phone.replace(/\D/g, "");
          await updateLead(id, { whatsapp: d.startsWith("55") ? d : `55${d}` });
        }
        await addDraft(id, "cold", coldMessage(lead));
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
    case "send": {
      // Resposta a um lead: o clique em "Enviar" é a aprovação (com o texto que estiver na tela).
      const item = await getItem(body.id);
      if (!item || item.kind !== "reply") return NextResponse.json({ error: "rascunho de resposta não encontrado" }, { status: 404 });
      if (body.text?.trim()) await editDraft(item.id, body.text.trim());
      await approve([item.id]);
      try {
        await ensureOpen();
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
