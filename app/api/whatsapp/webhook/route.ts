import { NextRequest, NextResponse } from "next/server";
import { updateLead } from "@/lib/leads/store";
import { shortName } from "@/lib/outreach/messages";
import { cancelFollowups, findLeadByNumber, insertInbound } from "@/lib/outreach/store";
import { ownerNumber, sendText } from "@/lib/whatsapp/evolution";

export const maxDuration = 60;

/** WhatsApp pessoal do Caique que recebe o aviso "lead respondeu" (com notificação). Troca: env OWNER_NOTIFY_NUMBER. */
const NOTIFY_DEFAULT = "5511966331995";

type Upsert = {
  key?: { remoteJid?: string; fromMe?: boolean; id?: string };
  message?: { conversation?: string; extendedTextMessage?: { text?: string }; imageMessage?: { caption?: string }; audioMessage?: unknown };
  messageType?: string;
};

function textOf(m: Upsert): string | null {
  const msg = m.message;
  if (!msg) return null;
  if (msg.conversation) return msg.conversation;
  if (msg.extendedTextMessage?.text) return msg.extendedTextMessage.text;
  if (msg.imageMessage) return `[imagem] ${msg.imageMessage.caption ?? ""}`.trim();
  if (msg.audioMessage) return "[áudio — ouça no celular]";
  return m.messageType ? `[${m.messageType}]` : null;
}

/**
 * Webhook da Evolution (evento MESSAGES_UPSERT). Protegido por ?secret=CRON_SECRET.
 * Só processa mensagens recebidas de números que são leads: grava na caixa de entrada, marca o lead como
 * "respondeu", cancela os follow-ups e avisa o Caique no WhatsApp pessoal com o link da conversa.
 * O Caique assume a conversa pelo celular (decisão dele, 2026-11-23): nenhum rascunho é gerado.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || req.nextUrl.searchParams.get("secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const payload = (await req.json().catch(() => null)) as { event?: string; data?: Upsert | Upsert[] } | null;
  if (!payload?.data) return NextResponse.json({ ok: true, skipped: "sem data" });
  const items = Array.isArray(payload.data) ? payload.data : [payload.data];

  const handled: number[] = [];
  for (const m of items) {
    const jid = m.key?.remoteJid ?? "";
    if (m.key?.fromMe || !jid.endsWith("@s.whatsapp.net")) continue;
    const number = jid.split("@")[0];
    const text = textOf(m);
    if (!text) continue;
    const found = await findLeadByNumber(number);
    if (!found) continue;
    const isNew = await insertInbound(found.id, number, text, m.key?.id ?? null);
    if (!isNew) continue;
    handled.push(found.id);
    await cancelFollowups(found.id);

    if (found.status === "abordado" || found.status === "sem_resposta") {
      await updateLead(found.id, { status: "respondeu", event_note: `Respondeu no WhatsApp: ${text.slice(0, 160)}` });
    }

    try {
      const owner = process.env.OWNER_NOTIFY_NUMBER?.replace(/\D/g, "") || NOTIFY_DEFAULT || (await ownerNumber());
      if (owner) {
        await sendText(
          owner,
          `📩 ${shortName(found.name)} respondeu:\n“${text.slice(0, 500)}”\n\nAbrir conversa: https://wa.me/${number}`,
        );
      }
    } catch {
      /* aviso é best-effort */
    }
  }
  return NextResponse.json({ ok: true, handled });
}
