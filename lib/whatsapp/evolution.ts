/**
 * Cliente mínimo da Evolution API (v2) hospedada na Render.
 * Envio é sempre 1 mensagem para 1 lead, com texto aprovado pelo Caique (ver scripts/whatsapp.mts).
 *
 * Env: EVOLUTION_URL (ex.: https://prumo-whatsapp.onrender.com), EVOLUTION_API_KEY, EVOLUTION_INSTANCE.
 */

function cfg() {
  const url = process.env.EVOLUTION_URL?.trim().replace(/\/$/, "");
  const key = process.env.EVOLUTION_API_KEY?.trim();
  const instance = process.env.EVOLUTION_INSTANCE?.trim() || "webprumo";
  if (!url || !key) throw new Error("EVOLUTION_URL / EVOLUTION_API_KEY ausentes");
  return { url, key, instance };
}

async function call<T>(method: "GET" | "POST" | "DELETE", path: string, body?: unknown): Promise<T> {
  const { url, key } = cfg();
  const res = await fetch(`${url}${path}`, {
    method,
    headers: { apikey: key, "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(60_000),
  });
  const text = await res.text();
  let json: unknown = text;
  try {
    json = JSON.parse(text);
  } catch {
    /* texto puro */
  }
  if (!res.ok) throw new Error(`Evolution ${method} ${path} → ${res.status}: ${text.slice(0, 300)}`);
  return json as T;
}

/** Cria a instância (se não existir) e devolve o QR code em base64 para parear o WhatsApp Business. */
export async function createInstance() {
  const { instance } = cfg();
  return call<{ qrcode?: { base64?: string; pairingCode?: string } }>("POST", "/instance/create", {
    instanceName: instance,
    integration: "WHATSAPP-BAILEYS",
    qrcode: true,
    rejectCall: false,
    groupsIgnore: true,
    alwaysOnline: false,
    readMessages: false,
    readStatus: false,
    syncFullHistory: false,
  });
}

export async function connectQr() {
  const { instance } = cfg();
  return call<{ base64?: string; pairingCode?: string; code?: string }>("GET", `/instance/connect/${instance}`);
}

export async function connectionState(): Promise<string> {
  const { instance } = cfg();
  const r = await call<{ instance?: { state?: string } }>("GET", `/instance/connectionState/${instance}`);
  return r.instance?.state ?? "unknown";
}

/** true se o número (E.164 sem +) tem WhatsApp. */
export async function hasWhatsApp(number: string): Promise<boolean> {
  const { instance } = cfg();
  const r = await call<Array<{ exists?: boolean; number?: string }>>("POST", `/chat/whatsappNumbers/${instance}`, {
    numbers: [number],
  });
  return Boolean(r[0]?.exists);
}

export async function sendText(number: string, text: string) {
  const { instance } = cfg();
  return call<{ key?: { id?: string }; status?: string }>("POST", `/message/sendText/${instance}`, {
    number,
    text,
    delay: 1200,
    linkPreview: true,
  });
}

/** Número do WhatsApp pareado (o próprio Caique), para avisos de "lead respondeu". */
export async function ownerNumber(): Promise<string | null> {
  const { instance } = cfg();
  const r = await call<Array<{ ownerJid?: string }>>("GET", `/instance/fetchInstances?instanceName=${instance}`);
  const jid = (Array.isArray(r) ? r[0] : (r as { ownerJid?: string }))?.ownerJid;
  return jid ? jid.split("@")[0].split(":")[0] : null;
}

/** Aponta o webhook de mensagens recebidas da instância para o painel (MESSAGES_UPSERT). */
export async function setWebhook(webhookUrl: string) {
  const { instance } = cfg();
  return call("POST", `/webhook/set/${instance}`, {
    webhook: { enabled: true, url: webhookUrl, byEvents: false, base64: false, events: ["MESSAGES_UPSERT"] },
  });
}
