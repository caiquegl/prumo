import { NextRequest, NextResponse } from "next/server";
import { updateLead } from "@/lib/leads/store";
import { shortName } from "@/lib/outreach/messages";
import { cancelFollowups, findLeadByNumber, insertInbound, lastSentAt } from "@/lib/outreach/store";
import { notifyNumber, sendText } from "@/lib/whatsapp/evolution";

export const maxDuration = 60;

type Upsert = {
  key?: { remoteJid?: string; remoteJidAlt?: string; senderPn?: string; fromMe?: boolean; id?: string };
  message?: { conversation?: string; extendedTextMessage?: { text?: string }; imageMessage?: { caption?: string }; audioMessage?: unknown };
  messageType?: string;
};

/** Respostas automáticas de WhatsApp Business (saudação/ausência) não contam como resposta do lead. */
const AUTO_PATTERNS = [
  /mensagem autom[aá]tica/i,
  /resposta autom[aá]tica/i,
  /(agradecemos|obrigad[oa]) (pelo|por entrar em|pelo seu) contato/i,
  /em breve (retornaremos|responderemos|entraremos|daremos retorno)/i,
  /retornaremos (o mais breve|em breve|assim que)/i,
  /(nosso|o) hor[aá]rio de atendimento/i,
  /no momento (n[aã]o (estamos|podemos)|estamos (fora|ausentes))/i,
  /fora do (nosso )?hor[aá]rio/i,
  /seja (muito )?bem[- ]vind[oa]/i,
  /como podemos (te |lhe )?ajudar/i,
  /escolha (uma|a) op[cç][aã]o|digite (o n[uú]mero|1)/i,
];

function looksAutomatic(text: string, receivedAt: Date, lastSent: Date | null): boolean {
  if (AUTO_PATTERNS.some((r) => r.test(text))) return true;
  // saudação automática chega segundos depois do nosso 1º balão (antes ou logo depois de registrarmos o envio)
  if (lastSent && Math.abs(receivedAt.getTime() - lastSent.getTime()) < 75_000 && text.length > 60) return true;
  return false;
}

/** Número E.164 do remetente; o WhatsApp às vezes usa um id "@lid" e manda o número em outro campo. */
function senderNumber(m: Upsert): string | null {
  const candidates = [m.key?.remoteJid, m.key?.remoteJidAlt, m.key?.senderPn];
  for (const c of candidates) if (c?.endsWith("@s.whatsapp.net")) return c.split("@")[0];
  return null;
}

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
 * Webhook da Evolution (evento MESSAGES_UPSERT). Protegido por ?secret=WA_WEBHOOK_SECRET (fallback CRON_SECRET).
 * Só processa mensagens recebidas de números que são leads: grava na caixa de entrada, marca o lead como
 * "respondeu", cancela os follow-ups e avisa o Caique no WhatsApp pessoal com o link da conversa.
 * O Caique assume a conversa pelo celular (decisão dele, 2026-11-23): nenhum rascunho é gerado.
 */
export async function POST(req: NextRequest) {
  const secret = (process.env.WA_WEBHOOK_SECRET || process.env.CRON_SECRET)?.trim();
  if (!secret || req.nextUrl.searchParams.get("secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const payload = (await req.json().catch(() => null)) as { event?: string; data?: Upsert | Upsert[] } | null;
  if (!payload?.data) return NextResponse.json({ ok: true, skipped: "sem data" });
  const items = Array.isArray(payload.data) ? payload.data : [payload.data];

  const handled: number[] = [];
  for (const m of items) {
    if (m.key?.fromMe) continue;
    if (m.key?.remoteJid?.endsWith("@g.us") || m.key?.remoteJid === "status@broadcast") continue;
    const number = senderNumber(m);
    const text = textOf(m);
    if (!number || !text) continue;
    const found = await findLeadByNumber(number);
    if (!found) continue;
    const auto = looksAutomatic(text, new Date(), await lastSentAt(found.id));
    const isNew = await insertInbound(found.id, number, text, m.key?.id ?? null, auto);
    if (!isNew) continue;
    handled.push(found.id);
    // resposta automática: fica registrada no painel, mas não muda status, não cancela follow-up e não avisa
    if (auto) continue;
    await cancelFollowups(found.id);

    // abordagem manual pelo celular: o lead pode responder antes de ser marcado como "abordado" no painel
    if (["sem_site", "criando", "publicado", "abordado", "sem_resposta"].includes(found.status)) {
      await updateLead(found.id, { status: "respondeu", event_note: `Respondeu no WhatsApp: ${text.slice(0, 160)}` });
    }

    try {
      const owner = notifyNumber();
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
