import { db } from "@/lib/db";
import { ensureLeadsSchema } from "@/lib/leads/store";

/**
 * Fila de disparos de WhatsApp aprovados pelo Caique + caixa de entrada das respostas dos leads.
 *
 * - `outreach_queue`: cada mensagem a enviar. `kind` = "cold" (primeiro contato, pergunta de permissão) ou
 *   "reply" (resposta a um lead que escreveu). Fluxo: draft → approved → sent | failed | cancelled.
 *   Nada sai sem `approved` (aprovação explícita no painel /leads/disparos).
 * - `wa_inbox`: mensagens recebidas de números de leads (via webhook da Evolution).
 *
 * Tabelas criadas sob demanda, no mesmo padrão de `leads` (sem arquivos de migração).
 */

export type OutreachKind = "cold" | "reply";
export type OutreachStatus = "draft" | "approved" | "sending" | "sent" | "failed" | "cancelled";

export type OutreachItem = {
  id: number;
  lead_id: number;
  kind: OutreachKind;
  text: string;
  status: OutreachStatus;
  error: string | null;
  created_at: string;
  approved_at: string | null;
  sent_at: string | null;
  lead_name: string;
  lead_whatsapp: string | null;
  lead_neighborhood: string | null;
  lead_status: string;
};

export type InboxItem = {
  id: number;
  lead_id: number | null;
  number: string;
  text: string;
  received_at: string;
  handled: boolean;
  lead_name: string | null;
  lead_status: string | null;
};

let ready = false;

export async function ensureOutreachSchema() {
  if (ready) return;
  await ensureLeadsSchema();
  const sql = db();
  await sql`
    CREATE TABLE IF NOT EXISTS outreach_queue (
      id SERIAL PRIMARY KEY,
      lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
      kind TEXT NOT NULL DEFAULT 'cold',
      text TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      error TEXT,
      wa_ids TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      approved_at TIMESTAMPTZ,
      sent_at TIMESTAMPTZ
    )`;
  await sql`CREATE INDEX IF NOT EXISTS outreach_queue_status_idx ON outreach_queue (status, approved_at)`;
  await sql`
    CREATE TABLE IF NOT EXISTS wa_inbox (
      id SERIAL PRIMARY KEY,
      lead_id INTEGER REFERENCES leads(id) ON DELETE SET NULL,
      number TEXT NOT NULL,
      text TEXT NOT NULL,
      wa_message_id TEXT UNIQUE,
      handled BOOLEAN NOT NULL DEFAULT false,
      received_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
  ready = true;
}

const ITEM_COLS = (sql: ReturnType<typeof db>) => sql`
  q.id, q.lead_id, q.kind, q.text, q.status, q.error, q.created_at, q.approved_at, q.sent_at,
  l.name AS lead_name, l.whatsapp AS lead_whatsapp, l.neighborhood AS lead_neighborhood, l.status AS lead_status`;

export async function listQueue(statuses: OutreachStatus[], limit = 200): Promise<OutreachItem[]> {
  await ensureOutreachSchema();
  const sql = db();
  return (await sql`
    SELECT ${ITEM_COLS(sql)}
    FROM outreach_queue q JOIN leads l ON l.id = q.lead_id
    WHERE q.status = ANY(${statuses})
    ORDER BY q.approved_at ASC NULLS LAST, q.id ASC
    LIMIT ${limit}`) as OutreachItem[];
}

export async function queueCounts(): Promise<Record<string, number>> {
  await ensureOutreachSchema();
  const rows = (await db()`
    SELECT status, COUNT(*)::int AS n FROM outreach_queue GROUP BY status`) as Array<{ status: string; n: number }>;
  const today = (await db()`
    SELECT COUNT(*)::int AS n FROM outreach_queue
    WHERE status = 'sent' AND kind = 'cold' AND sent_at >= date_trunc('day', now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo'`) as Array<{ n: number }>;
  return { ...Object.fromEntries(rows.map((r) => [r.status, r.n])), sent_today: today[0]?.n ?? 0 };
}

/** Leads que podem receber o primeiro contato: sem site, sem demo, nunca abordados, com celular. */
export async function coldCandidates(limit: number): Promise<Array<{ id: number }>> {
  await ensureOutreachSchema();
  return (await db()`
    SELECT l.id FROM leads l
    WHERE l.status = 'sem_site' AND l.contacted_at IS NULL
      AND (l.whatsapp IS NOT NULL OR l.phone ~ '9[0-9]{4}-?[0-9]{4}$')
      AND NOT EXISTS (SELECT 1 FROM outreach_queue q WHERE q.lead_id = l.id AND q.status <> 'cancelled')
    ORDER BY l.niche_rank ASC NULLS LAST, l.score DESC, l.id DESC
    LIMIT ${limit}`) as Array<{ id: number }>;
}

export async function addDraft(leadId: number, kind: OutreachKind, text: string): Promise<number> {
  await ensureOutreachSchema();
  const r = (await db()`
    INSERT INTO outreach_queue (lead_id, kind, text) VALUES (${leadId}, ${kind}, ${text}) RETURNING id`) as Array<{ id: number }>;
  return r[0].id;
}

export async function editDraft(id: number, text: string) {
  await ensureOutreachSchema();
  await db()`UPDATE outreach_queue SET text = ${text} WHERE id = ${id} AND status IN ('draft', 'approved')`;
}

export async function approve(ids: number[]) {
  await ensureOutreachSchema();
  if (!ids.length) return 0;
  const r = (await db()`
    UPDATE outreach_queue SET status = 'approved', approved_at = now()
    WHERE id = ANY(${ids}) AND status = 'draft' RETURNING id`) as Array<{ id: number }>;
  return r.length;
}

export async function cancel(ids: number[]) {
  await ensureOutreachSchema();
  if (!ids.length) return 0;
  const r = (await db()`
    UPDATE outreach_queue SET status = 'cancelled'
    WHERE id = ANY(${ids}) AND status IN ('draft', 'approved') RETURNING id`) as Array<{ id: number }>;
  return r.length;
}

/** Próximos itens aprovados do tipo pedido, na ordem de aprovação (o runner trava cada um ao enviar). */
export async function nextApproved(kind: OutreachKind, limit: number): Promise<OutreachItem[]> {
  await ensureOutreachSchema();
  const sql = db();
  return (await sql`
    SELECT ${ITEM_COLS(sql)}
    FROM outreach_queue q JOIN leads l ON l.id = q.lead_id
    WHERE q.status = 'approved' AND q.kind = ${kind}
    ORDER BY q.approved_at ASC, q.id ASC
    LIMIT ${limit}`) as OutreachItem[];
}

export async function getItem(id: number): Promise<OutreachItem | null> {
  await ensureOutreachSchema();
  const sql = db();
  const r = (await sql`
    SELECT ${ITEM_COLS(sql)} FROM outreach_queue q JOIN leads l ON l.id = q.lead_id WHERE q.id = ${id}`) as OutreachItem[];
  return r[0] ?? null;
}

/** Reserva um item aprovado para envio (atômico). false = já não está aprovado (voltou a rascunho, cancelado ou outro envio pegou). */
export async function claim(id: number): Promise<boolean> {
  const r = (await db()`UPDATE outreach_queue SET status = 'sending' WHERE id = ${id} AND status = 'approved' RETURNING id`) as Array<{ id: number }>;
  return r.length > 0;
}

/** Volta itens aprovados (ainda não enviados) para rascunho. */
export async function backToDraft(ids: number[]) {
  await ensureOutreachSchema();
  if (!ids.length) return 0;
  const r = (await db()`
    UPDATE outreach_queue SET status = 'draft', approved_at = NULL
    WHERE id = ANY(${ids}) AND status = 'approved' RETURNING id`) as Array<{ id: number }>;
  return r.length;
}

export async function markSent(id: number, waIds: string[]) {
  await db()`UPDATE outreach_queue SET status = 'sent', sent_at = now(), wa_ids = ${waIds.join(",")}, error = NULL WHERE id = ${id}`;
}

export async function markFailed(id: number, error: string) {
  await db()`UPDATE outreach_queue SET status = 'failed', error = ${error.slice(0, 500)} WHERE id = ${id}`;
}

// ---- caixa de entrada ----

export async function findLeadByNumber(number: string): Promise<{ id: number; status: string; name: string } | null> {
  await ensureOutreachSchema();
  const digits = number.replace(/\D/g, "");
  // celulares BR às vezes chegam sem o 9 extra (5511 9xxxx-xxxx vs 5511 xxxx-xxxx)
  const alt = digits.length === 12 ? `${digits.slice(0, 4)}9${digits.slice(4)}` : digits;
  const r = (await db()`
    SELECT id, status, name FROM leads WHERE whatsapp = ${digits} OR whatsapp = ${alt} LIMIT 1`) as Array<{ id: number; status: string; name: string }>;
  return r[0] ?? null;
}

/** Grava a mensagem recebida; devolve false se for duplicada (webhooks podem repetir). */
export async function insertInbound(leadId: number | null, number: string, text: string, waMessageId: string | null): Promise<boolean> {
  await ensureOutreachSchema();
  const r = (await db()`
    INSERT INTO wa_inbox (lead_id, number, text, wa_message_id) VALUES (${leadId}, ${number}, ${text}, ${waMessageId})
    ON CONFLICT (wa_message_id) DO NOTHING RETURNING id`) as Array<{ id: number }>;
  return r.length > 0;
}

export async function listInbox(limit = 100): Promise<InboxItem[]> {
  await ensureOutreachSchema();
  return (await db()`
    SELECT i.id, i.lead_id, i.number, i.text, i.received_at, i.handled, l.name AS lead_name, l.status AS lead_status
    FROM wa_inbox i LEFT JOIN leads l ON l.id = i.lead_id
    WHERE i.lead_id IS NOT NULL
    ORDER BY i.received_at DESC LIMIT ${limit}`) as InboxItem[];
}

export async function conversation(leadId: number): Promise<Array<{ from: "lead" | "caique"; text: string; at: string }>> {
  await ensureOutreachSchema();
  const rows = (await db()`
    SELECT 'lead' AS "from", text, received_at AS at FROM wa_inbox WHERE lead_id = ${leadId}
    UNION ALL
    SELECT 'caique' AS "from", text, sent_at AS at FROM outreach_queue WHERE lead_id = ${leadId} AND status = 'sent'
    ORDER BY at ASC`) as Array<{ from: "lead" | "caique"; text: string; at: string }>;
  return rows;
}

export async function markInboxHandled(leadId: number) {
  await db()`UPDATE wa_inbox SET handled = true WHERE lead_id = ${leadId}`;
}
