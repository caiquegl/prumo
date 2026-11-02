/**
 * Hashtags sized (2026): 3–5 tags, mix niche/mid/broad.
 * Conta pequena (@web.prumo) ranqueia em niche; broad é no máx 1.
 */

export type HashtagTopic =
  | "landing"
  | "site"
  | "sistema"
  | "integracao"
  | "performance"
  | "case"
  | "reel"
  | "geral";

type SizedTag = { tag: string; tier: "niche" | "mid" | "broad" };

const SETS: Record<HashtagTopic, SizedTag[]> = {
  landing: [
    { tag: "siteparaempresa", tier: "niche" },
    { tag: "landingpagebrasil", tier: "niche" },
    { tag: "singlepage", tier: "niche" },
    { tag: "criacaodesites", tier: "mid" },
    { tag: "pequenosnegocios", tier: "mid" },
  ],
  site: [
    { tag: "siteparaempresa", tier: "niche" },
    { tag: "webprumo", tier: "niche" },
    { tag: "sitesobmedida", tier: "niche" },
    { tag: "desenvolvimentoweb", tier: "mid" },
    { tag: "empreendedorismo", tier: "broad" },
  ],
  sistema: [
    { tag: "sistemasweb", tier: "niche" },
    { tag: "webprumo", tier: "niche" },
    { tag: "automacaodeprocessos", tier: "niche" },
    { tag: "desenvolvimentoweb", tier: "mid" },
    { tag: "tecnologia", tier: "broad" },
  ],
  integracao: [
    { tag: "integracaoapi", tier: "niche" },
    { tag: "webprumo", tier: "niche" },
    { tag: "whatsappbusiness", tier: "mid" },
    { tag: "automacao", tier: "mid" },
    { tag: "tecnologia", tier: "broad" },
  ],
  performance: [
    { tag: "siteparaempresa", tier: "niche" },
    { tag: "corewebvitals", tier: "niche" },
    { tag: "seotecnico", tier: "niche" },
    { tag: "criacaodesites", tier: "mid" },
    { tag: "marketingdigital", tier: "broad" },
  ],
  case: [
    { tag: "webprumo", tier: "niche" },
    { tag: "portfolioweb", tier: "niche" },
    { tag: "landingpagebrasil", tier: "niche" },
    { tag: "criacaodesites", tier: "mid" },
    { tag: "design", tier: "broad" },
  ],
  reel: [
    { tag: "webprumo", tier: "niche" },
    { tag: "siteparaempresa", tier: "niche" },
    { tag: "reelsbrasil", tier: "mid" },
    { tag: "criacaodesites", tier: "mid" },
    { tag: "empreendedorismo", tier: "broad" },
  ],
  geral: [
    { tag: "webprumo", tier: "niche" },
    { tag: "siteparaempresa", tier: "niche" },
    { tag: "landingpagebrasil", tier: "niche" },
    { tag: "criacaodesites", tier: "mid" },
    { tag: "pequenosnegocios", tier: "mid" },
  ],
};

const TOPIC_HINTS: Array<{ topic: HashtagTopic; keys: string[] }> = [
  { topic: "reel", keys: ["reel", "reels", "vídeo", "video"] },
  { topic: "integracao", keys: ["integra", "api", "crm", "whatsapp", "automação", "automacao"] },
  { topic: "sistema", keys: ["sistema", "painel", "dashboard", "agend"] },
  { topic: "performance", keys: ["lento", "rápido", "rapido", "seo", "performance", "vitals"] },
  { topic: "case", keys: ["case", "projeto", "portfólio", "portfolio", "cliente"] },
  { topic: "landing", keys: ["landing", "single page", "singlepage", "convers"] },
  { topic: "site", keys: ["site", "institucional", "presença", "presenca"] },
];

export function detectHashtagTopic(caption: string, mediaType?: string): HashtagTopic {
  if (mediaType === "video") return "reel";
  const lower = caption.toLowerCase();
  for (const row of TOPIC_HINTS) {
    if (row.keys.some((k) => lower.includes(k))) return row.topic;
  }
  return "geral";
}

/** Até 5 tags, sem #, prontas para gravar em ig_queue.tags */
export function sizedHashtags(topic: HashtagTopic = "geral", limit = 5): string[] {
  const pack = SETS[topic] || SETS.geral;
  const niche = pack.filter((t) => t.tier === "niche");
  const mid = pack.filter((t) => t.tier === "mid");
  const broad = pack.filter((t) => t.tier === "broad");
  const picked: SizedTag[] = [];
  for (const t of niche) {
    if (picked.length >= Math.min(3, limit)) break;
    picked.push(t);
  }
  for (const t of mid) {
    if (picked.length >= Math.min(4, limit)) break;
    picked.push(t);
  }
  if (picked.length < limit && broad[0]) picked.push(broad[0]);
  return picked.slice(0, limit).map((t) => t.tag);
}

export function hashtagsForCaption(caption: string, mediaType?: string): string[] {
  return sizedHashtags(detectHashtagTopic(caption, mediaType));
}

/** Default no formulário /posts */
export const DEFAULT_UPLOAD_TAGS = sizedHashtags("geral").join(", ");
