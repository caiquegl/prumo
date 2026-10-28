import type { FeedItem, Layout } from "./types";
import { DESIGNED_LAYOUTS } from "./types";

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
  sub?: string;
  headline: string;
  hook: string;
  items?: [string, string?][];
  left?: { label: string; rows: string[] };
  right?: { label: string; rows: string[] };
  bars?: { label: string; value: string; pct: number; accent?: boolean }[];
  score?: { value: string; label: string };
  checks?: { title: string; detail: string }[];
  hubCenter?: string;
  hubNodes?: string[];
  photoQuery: string;
  tags: string[];
  pillar: string;
  angle: string;
  concept?: string;
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
  return (
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || `angulo-${Date.now().toString(36)}`
  );
}

export async function generateAgencyBrief(input: {
  avoidTitles: string[];
  avoidLayouts: string[];
  recentCaptions: string[];
  avoidAngles?: string[];
}): Promise<AiBrief> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY ausente");

  const preferred = DESIGNED_LAYOUTS.filter((l) => !input.avoidLayouts.includes(l));
  const layoutHint = preferred.length ? preferred.join("|") : DESIGNED_LAYOUTS.join("|");

  const system = `Você é diretor criativo + redator comercial da Prumo Web (@prumo.web).
OFERTA: freela de TI — single page / landing / site sob medida, código próprio, lead no WhatsApp.

Gere um POST DE AGÊNCIA DESENHADO (infográfico/editorial), NÃO "foto abstrata numa moldura".
Layouts preferidos (escolha 1 que NÃO esteja na lista de evitados): ${layoutHint}
- anatomy: 4–6 passos da single page (items: [titulo, detalhe])
- perf: site lento vs rápido (bars + score + checks)
- hub: integrações (hubCenter + hubNodes 6–8)
- split / cards / compare / quote: variações tipográficas de venda

Conteúdo ÚNICO a cada vez (títulos, passos, métricas, nós diferentes).
Tom: vende o serviço com clareza. NÃO prazo numérico, NÃO emoji, NÃO boardroom.
title: até 2 linhas com <br>.
sub: 1 frase explicando a oferta.
headline: CTA (ex: "Sua single page pode começar aqui.").
hook: frase curta pra caption.
photoQuery: IGNORE para anatomy/perf/hub/quote/cards/compare — deixe "none".

Responda SOMENTE JSON:
{
  "layout": "anatomy"|"perf"|"hub"|"quote"|"split"|"cards"|"compare",
  "concept": "slug-unico-da-composicao",
  "kicker": "SINGLE PAGE",
  "title": "linha1<br>linha2",
  "sub": "frase de apoio",
  "headline": "CTA",
  "hook": "caption",
  "items": [["Hero","promessa + botão"],["Benefícios","o que o cliente ganha"]],
  "bars": [{"label":"Site comum","value":"4,8s","pct":80},{"label":"Site Prumo","value":"0,9s","pct":18,"accent":true}],
  "score": {"value":"100","label":"NOTA DE DESEMPENHO"},
  "checks": [{"title":"...","detail":"..."}],
  "hubCenter": "Seu site<br>ou sistema",
  "hubNodes": ["WhatsApp","APIs","CRM","Pagamentos"],
  "left": {"label":"Template","rows":["..."]},
  "right": {"label":"Prumo","rows":["..."]},
  "photoQuery": "none",
  "tags": ["singlepage","desenvolvimento"],
  "pillar": "slug",
  "angle": "slug-curto"
}
Preencha só os campos do layout escolhido.`;

  const user = `Evitar layouts: ${input.avoidLayouts.join(", ") || "nenhum"}
Evitar títulos: ${input.avoidTitles.slice(0, 12).join(" | ") || "nenhum"}
Evitar ângulos: ${(input.avoidAngles || []).slice(0, 12).join(", ") || "nenhum"}
Captions recentes: ${input.recentCaptions.slice(0, 6).join(" || ").slice(0, 900) || "nenhuma"}
Crie 1 post NOVO, útil pra vender single page / site / TI freela.`;

  let text = "";
  let lastError = "Gemini indisponível";
  for (const model of MODELS) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: `${system}\n\n${user}` }] }],
        generationConfig: { temperature: 0.95, maxOutputTokens: 1100 },
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
  if (!brief.title || !brief.layout || !brief.hook) throw new Error("brief Gemini incompleto");

  // Força layout desenhado (nunca offer/hero genérico)
  if (!DESIGNED_LAYOUTS.includes(brief.layout)) {
    brief.layout = preferred[0] || "anatomy";
  }
  if (input.avoidLayouts.includes(brief.layout)) {
    brief.layout = preferred.find((l) => l !== brief.layout) || preferred[0] || "quote";
  }

  brief.angle = slugAngle(brief.angle || brief.pillar || brief.title);
  brief.concept = slugAngle(brief.concept || `${brief.layout}-${brief.angle}`);
  return brief;
}

const VISUALS = ["mark", "wire", "chart", "cloud"] as const;

function pickVisual(brief: AiBrief): (typeof VISUALS)[number] {
  if (brief.layout === "quote") return "mark";
  const seed = `${brief.angle || ""}${brief.title || ""}`;
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return VISUALS[h % VISUALS.length];
}

function cleanHeadline(h?: string) {
  const raw = (h || "Seu próximo projeto pode começar aqui.").trim();
  return raw
    .replace(/\(11\)\s*96633[-\s]?1995/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/[–—-]\s*$/g, "")
    .trim() || "Seu próximo projeto pode começar aqui.";
}

export function briefToFeedItem(brief: AiBrief, photoUrl?: string, photoCredit?: string, photoId?: string): FeedItem {
  return {
    id: `agency-${brief.angle || "ai"}-${Date.now().toString(36)}`,
    layout: brief.layout,
    visual: pickVisual(brief),
    kicker: brief.kicker,
    title: brief.title,
    sub: brief.sub || brief.hook,
    items: brief.items,
    left: brief.left,
    right: brief.right,
    bars: brief.bars,
    score: brief.score,
    checks: brief.checks,
    hubCenter: brief.hubCenter,
    hubNodes: brief.hubNodes,
    headline: cleanHeadline(brief.headline),
    hook: brief.hook,
    tags: brief.tags,
    photoUrl,
    photoCredit,
    photoId,
    pillar: brief.pillar,
    angle: brief.angle,
    concept: brief.concept,
  };
}
