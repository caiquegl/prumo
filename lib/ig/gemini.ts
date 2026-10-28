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

export async function generateAgencyBrief(input: {
  avoidTitles: string[];
  avoidLayouts: string[];
  recentCaptions: string[];
}): Promise<AiBrief> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY ausente");

  const system = `Você é diretor criativo da agência Prumo Web (@prumo.web).
Marca: sites, landings e sistemas sob medida para empresas brasileiras. Tom adulto, direto, premium, sem clichê de marketing digital genérico.
Objetivo do post: parar o scroll, gerar comentário/salvamento, mostrar diferencial (sob medida, funil até WhatsApp, design próprio, operação clara).
NÃO fale de prazo numérico, NÃO use layout "stat", NÃO invente desconto, NÃO use emoji, NÃO repita títulos evitados.
Texto na arte: pouquíssimo. title com no máximo 2 linhas (use <br>), cada linha com até 5 palavras.
hook (caption): 1 frase curta, provocativa.
photoQuery: em inglês, foto lifestyle/business cinematográfica, sem texto na imagem.
Responda SOMENTE um JSON válido com:
{
  "layout": "hero"|"quote"|"split"|"cards"|"compare",
  "kicker": "string curta",
  "title": "linha1<br>linha2",
  "headline": "CTA curto",
  "hook": "frase caption",
  "items": [["a"],["b"],["c"]],
  "left": {"label":"Antes","rows":["..","..",".."]},
  "right": {"label":"Com a Prumo","rows":["..","..",".."]},
  "photoQuery": "english photo search",
  "tags": ["tag1","tag2"],
  "pillar": "slug",
  "angle": "slug-unico"
}
items só se layout for split ou cards. left/right só se compare.`;

  const user = `Evitar layouts recentes: ${input.avoidLayouts.join(", ") || "nenhum"}
Evitar títulos: ${input.avoidTitles.slice(0, 12).join(" | ") || "nenhum"}
Captions recentes do perfil (não ecoar): ${input.recentCaptions.slice(0, 8).join(" || ").slice(0, 1200) || "nenhuma"}
Gere 1 post novo, visual e com gancho de engajamento. Prefira layout hero ou quote se possível.`;

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
