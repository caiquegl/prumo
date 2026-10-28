import type { FeedItem, Layout } from "./types";

const MODELS = [
  process.env.GEMINI_MODEL,
  "gemini-flash-lite-latest",
  "gemini-3.5-flash-lite",
  "gemini-3.8-flash",
  "gemini-flash-latest",
].filter(Boolean) as string[];

export type AiBrief = {
  layout: Layout;
  kicker: string;
  title: string;
  headline: string;
  hook: string;
  items?: [string, string?][];
  left?: { label: string; rows: string[] };
  right?: { label: string; rows: string[] };
  photoQuery: string;
  tags: string[];
  pillar: string;
  angle: string;
};

type GeminiResponse = {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  error?: { message?: string };
};

function extractJson(text: string): AiBrief {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = (fenced?.[1] || text).trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end < 0) throw new Error("Gemini não devolveu JSON");
  return JSON.parse(raw.slice(start, end + 1)) as AiBrief;
}

function slugAngle(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || `angulo-${Date.now().toString(36)}`;
}

export async function generateAgencyBrief(input: {
  avoidTitles: string[];
  avoidLayouts: string[];
  recentCaptions: string[];
  avoidAngles?: string[];
}): Promise<AiBrief> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY ausente");

  const system = `Você é redator comercial da Prumo Web (@prumo.web).
OFERTA (obrigatório): freela de TI — single pages / landings / sites sob medida, código próprio, lead no WhatsApp.
O post deve deixar ÓBVIO o que o cliente compra e o próximo passo (chamar no Zap). Tom direto, vendedor consultivo — não poesia vazia.
Pilares: single-page | landing | site-sob-medida | funil-whatsapp | codigo-proprio | ti-freela | performance
NÃO: boardroom, C-level, "operação empresarial", prazo numérico, desconto, emoji, layout "stat".
title: máx 2 linhas (<br>), até 5 palavras/linha — promessa de serviço clara.
kicker: categoria curta (SINGLE PAGE, CÓDIGO PRÓPRIO, PERFORMANCE…).
hook: 1 frase de dor/benefício que explica a oferta.
headline: CTA comercial curto (ex: "Peça orçamento no WhatsApp.").
photoQuery: visual de produto web em inglês (mockup, funil abstrato, gauge) — sem boardroom.
Responda SOMENTE um JSON válido com:
{
  "layout": "hero"|"quote"|"split"|"cards"|"compare",
  "kicker": "string curta (ex: SINGLE PAGE, SITE SOB MEDIDA, TI FREELA)",
  "title": "linha1<br>linha2",
  "headline": "CTA curto",
  "hook": "frase caption",
  "items": [["a"],["b"],["c"]],
  "left": {"label":"Template pronto","rows":["..","..",".."]},
  "right": {"label":"Single page Prumo","rows":["..","..",".."]},
  "photoQuery": "english web/dev photo search",
  "tags": ["tag1","tag2"],
  "pillar": "slug",
  "angle": "slug-unico"
}
items só se layout for split ou cards. left/right só se compare.`;

  const user = `Evitar layouts recentes: ${input.avoidLayouts.join(", ") || "nenhum"}
Evitar títulos: ${input.avoidTitles.slice(0, 12).join(" | ") || "nenhum"}
Evitar ângulos/slugs recentes: ${(input.avoidAngles || []).slice(0, 12).join(", ") || "nenhum"}
Captions recentes do perfil (não ecoar): ${input.recentCaptions.slice(0, 8).join(" || ").slice(0, 1200) || "nenhuma"}
Gere 1 post novo sobre desenvolvimento de single page / site sob medida (TI freela).
"angle" deve ser slug curto em inglês ou português-sem-espaço (ex: wix-vs-codigo, lcp-lento, zap-cta).`;

  let text = "";
  let lastError = "Gemini indisponível";
  for (const model of MODELS) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: `${system}\n\n${user}` }] }],
        generationConfig: { temperature: 0.95, maxOutputTokens: 700 },
      }),
    });
    const json = (await res.json()) as GeminiResponse;
    if (!res.ok || json.error) {
      lastError = json.error?.message || `Gemini HTTP ${res.status} (${model})`;
      continue;
    }
    text = json.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
    if (text) break;
  }
  if (!text) throw new Error(lastError);
  const brief = extractJson(text);
  if (!brief.title || !brief.layout || !brief.hook) {
    throw new Error("brief Gemini incompleto");
  }
  if (brief.layout === "stat") brief.layout = "hero";
  brief.angle = slugAngle(brief.angle || brief.pillar || brief.title);
  return brief;
}

const VISUALS_NO_LEAVES = ["mark", "wire", "chart", "cloud"] as const;

function pickVisual(brief: AiBrief): (typeof VISUALS_NO_LEAVES)[number] {
  if (brief.layout === "quote") return "mark";
  const seed = `${brief.angle || ""}${brief.title || ""}`;
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return VISUALS_NO_LEAVES[h % VISUALS_NO_LEAVES.length];
}

export function briefToFeedItem(brief: AiBrief, photoUrl?: string, photoCredit?: string, photoId?: string): FeedItem {
  return {
    id: `agency-${brief.angle || "ai"}-${Date.now().toString(36)}`,
    layout: brief.layout,
    // nunca "leaves" — arte abstrata repetia em todo post sem foto
    visual: pickVisual(brief),
    kicker: brief.kicker,
    title: brief.title,
    items: brief.items,
    left: brief.left,
    right: brief.right,
    headline: brief.headline,
    hook: brief.hook,
    tags: brief.tags,
    photoUrl,
    photoCredit,
    photoId,
    pillar: brief.pillar,
    angle: brief.angle,
  };
}
