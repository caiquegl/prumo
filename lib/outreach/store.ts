import { db } from "@/lib/db";
import { ensureLeadsSchema } from "@/lib/leads/store";
import type { Lead } from "@/lib/leads/types";

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

export type OutreachKind = "cold" | "followup1" | "followup2" | "reply";
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
  auto: boolean;
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
    CREATE TABLE IF NOT EXISTS outreach_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
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
  await sql`ALTER TABLE wa_inbox ADD COLUMN IF NOT EXISTS auto BOOLEAN NOT NULL DEFAULT false`;
  // última mensagem que o Caique mandou ao lead (automação ou celular), vista pelo webhook como fromMe
  await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_wa_out_at TIMESTAMPTZ`;
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
    WHERE status = 'sent' AND kind <> 'reply' AND sent_at >= date_trunc('day', now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo'`) as Array<{ n: number }>;
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

/** Fila de saída do runner: follow-ups primeiro (lead já conhece o Caique), depois primeiros contatos; respostas ficam fora. */
export async function nextApprovedOutbound(limit: number): Promise<OutreachItem[]> {
  await ensureOutreachSchema();
  const sql = db();
  return (await sql`
    SELECT ${ITEM_COLS(sql)}
    FROM outreach_queue q JOIN leads l ON l.id = q.lead_id
    WHERE q.status = 'approved' AND q.kind <> 'reply'
    ORDER BY CASE q.kind WHEN 'followup2' THEN 0 WHEN 'followup1' THEN 1 ELSE 2 END, q.approved_at ASC, q.id ASC
    LIMIT ${limit}`) as OutreachItem[];
}

// ---- configurações (mensagens padrão, follow-up) ----

export async function getSettings(): Promise<Record<string, string>> {
  await ensureOutreachSchema();
  const rows = (await db()`SELECT key, value FROM outreach_settings`) as Array<{ key: string; value: string }>;
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export async function saveSettings(values: Record<string, string>) {
  await ensureOutreachSchema();
  for (const [key, value] of Object.entries(values)) {
    await db()`
      INSERT INTO outreach_settings (key, value) VALUES (${key}, ${value})
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`;
  }
}

/**
 * Leads que receberam o 1º contato pela automação e não responderam:
 * - followup1: 1º contato enviado há ≥ 3 dias;
 * - followup2: lembrete enviado há ≥ 4 dias (≈ 7 dias do 1º contato).
 * Ignora quem já tem o item (em qualquer status exceto cancelado), quem respondeu depois do 1º contato
 * e quem não está mais "abordado".
 */
export async function dueFollowups(kind: "followup1" | "followup2", limit = 200): Promise<Array<{ lead_id: number }>> {
  await ensureOutreachSchema();
  const prev = kind === "followup1" ? "cold" : "followup1";
  const days = kind === "followup1" ? 3 : 4;
  return (await db()`
    SELECT DISTINCT p.lead_id
    FROM outreach_queue p JOIN leads l ON l.id = p.lead_id
    WHERE p.kind = ${prev} AND p.status = 'sent' AND p.sent_at <= now() - make_interval(days => ${days})
      AND l.status = 'abordado'
      AND NOT EXISTS (SELECT 1 FROM outreach_queue f WHERE f.lead_id = p.lead_id AND f.kind = ${kind} AND f.status <> 'cancelled')
      AND NOT EXISTS (
        SELECT 1 FROM wa_inbox i
        WHERE i.lead_id = p.lead_id AND NOT i.auto
          AND i.received_at > (SELECT MIN(c.sent_at) FROM outreach_queue c WHERE c.lead_id = p.lead_id AND c.kind = 'cold' AND c.status = 'sent')
      )
    LIMIT ${limit}`) as Array<{ lead_id: number }>;
}

/** Item já aprovado (o modelo de follow-up foi aprovado pelo Caique ao ligar a automação). */
export async function addApproved(leadId: number, kind: OutreachKind, text: string): Promise<number> {
  await ensureOutreachSchema();
  const r = (await db()`
    INSERT INTO outreach_queue (lead_id, kind, text, status, approved_at)
    VALUES (${leadId}, ${kind}, ${text}, 'approved', now()) RETURNING id`) as Array<{ id: number }>;
  return r[0].id;
}

/** Cancela follow-ups pendentes de um lead (ele respondeu). */
export async function cancelFollowups(leadId: number) {
  await db()`
    UPDATE outreach_queue SET status = 'cancelled'
    WHERE lead_id = ${leadId} AND kind IN ('followup1', 'followup2') AND status IN ('draft', 'approved')`;
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
  const r = (await db()`UPDATE outreach_queue SET status = 'sending', sent_at = now() WHERE id = ${id} AND status = 'approved' RETURNING id`) as Array<{ id: number }>;
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
export async function insertInbound(leadId: number | null, number: string, text: string, waMessageId: string | null, auto = false): Promise<boolean> {
  await ensureOutreachSchema();
  const r = (await db()`
    INSERT INTO wa_inbox (lead_id, number, text, wa_message_id, auto) VALUES (${leadId}, ${number}, ${text}, ${waMessageId}, ${auto})
    ON CONFLICT (wa_message_id) DO NOTHING RETURNING id`) as Array<{ id: number }>;
  return r.length > 0;
}

export async function listInbox(limit = 100): Promise<InboxItem[]> {
  await ensureOutreachSchema();
  return (await db()`
    SELECT i.id, i.lead_id, i.number, i.text, i.received_at, i.handled, i.auto, l.name AS lead_name, l.status AS lead_status
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

/** Momento do último envio nosso para o lead (para detectar resposta automática instantânea). */
export async function lastSentAt(leadId: number): Promise<Date | null> {
  const r = (await db()`
    SELECT GREATEST(
      (SELECT MAX(sent_at) FROM outreach_queue WHERE lead_id = ${leadId} AND status IN ('sent', 'sending')),
      (SELECT last_wa_out_at FROM leads WHERE id = ${leadId})
    ) AS t`) as Array<{ t: string | null }>;
  return r[0]?.t ? new Date(r[0].t) : null;
}

/** Mensagem enviada pelo Caique ao lead (o celular sincroniza com a Evolution e o webhook recebe como fromMe). */
export async function markOutbound(leadId: number) {
  await ensureOutreachSchema();
  await db()`UPDATE leads SET last_wa_out_at = now() WHERE id = ${leadId}`;
}

/** Última mensagem recebida do lead (para detectar rajadas de chatbot). */
export async function lastInbound(leadId: number): Promise<{ at: Date; auto: boolean } | null> {
  const r = (await db()`
    SELECT received_at, auto FROM wa_inbox WHERE lead_id = ${leadId} ORDER BY received_at DESC LIMIT 1`) as Array<{ received_at: string; auto: boolean }>;
  return r[0] ? { at: new Date(r[0].received_at), auto: r[0].auto } : null;
}

export async function markInboxHandled(leadId: number) {
  await db()`UPDATE wa_inbox SET handled = true WHERE lead_id = ${leadId}`;
}

/** Leads com mensagem automática aprovada esperando envio (evita mandar em dobro pelo celular). */
export async function queuedLeadIds(): Promise<number[]> {
  await ensureOutreachSchema();
  const rows = (await db()`
    SELECT DISTINCT lead_id FROM outreach_queue WHERE status IN ('approved', 'sending')`) as Array<{ lead_id: number }>;
  return rows.map((r) => r.lead_id);
}

export type LeadMessage = { id: string; dir: "out" | "in"; text: string; at: string; status: string; kind: string };

/** Conversa registrada de um lead: o que a automação enviou/agendou e o que chegou pelo webhook. */
export async function leadMessages(leadId: number): Promise<LeadMessage[]> {
  await ensureOutreachSchema();
  const sql = db();
  const out = (await sql`
    SELECT id, kind, text, status, COALESCE(sent_at, approved_at, created_at) AS at
    FROM outreach_queue WHERE lead_id = ${leadId} AND status <> 'cancelled'`) as Array<{
    id: number; kind: string; text: string; status: string; at: string;
  }>;
  const inbox = (await sql`
    SELECT id, text, received_at AS at, auto FROM wa_inbox WHERE lead_id = ${leadId}`) as Array<{
    id: number; text: string; at: string; auto: boolean;
  }>;
  return [
    ...out.map((m) => ({ id: `o${m.id}`, dir: "out" as const, text: m.text, at: m.at, status: m.status, kind: m.kind })),
    ...inbox.map((m) => ({ id: `i${m.id}`, dir: "in" as const, text: m.text, at: m.at, status: m.auto ? "auto" : "recebida", kind: "inbox" })),
  ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
}

/** Tira leads da fila automática (rascunhos e aprovados ainda não enviados). */
export async function cancelQueuedForLeads(leadIds: number[]): Promise<number> {
  await ensureOutreachSchema();
  if (!leadIds.length) return 0;
  const r = (await db()`
    UPDATE outreach_queue SET status = 'cancelled'
    WHERE lead_id = ANY(${leadIds}) AND status IN ('draft', 'approved') RETURNING id`) as Array<{ id: number }>;
  return r.length;
}

/**
 * Coloca leads na fila de primeiro contato JÁ APROVADOS com a mensagem padrão (o Caique escolhe os leads e confirma
 * o texto no painel). Só leads antes do contato, com WhatsApp e sem nada pendente na fila.
 */
export async function enqueueCold(leadIds: number[], render: (lead: Lead) => string): Promise<number> {
  await ensureOutreachSchema();
  if (!leadIds.length) return 0;
  const leads = (await db()`
    SELECT l.* FROM leads l
    WHERE l.id = ANY(${leadIds}) AND l.status IN ('sem_site', 'criando', 'publicado') AND l.whatsapp IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM outreach_queue q WHERE q.lead_id = l.id AND q.status IN ('draft', 'approved', 'sending', 'sent'))`) as Lead[];
  // mantém a ordem escolhida no painel (a fila sai por approved_at)
  const order = new Map(leadIds.map((id, i) => [id, i]));
  leads.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  for (const lead of leads) {
    await addApproved(lead.id, "cold", render(lead));
  }
  return leads.length;
}
