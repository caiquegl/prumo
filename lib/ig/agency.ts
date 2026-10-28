import { plain, titleOf } from "./content";
import { briefToFeedItem, generateAgencyBrief } from "./gemini";
import type { FeedItem, IgState, Layout } from "./types";
import { findPortraitPhoto, trackUnsplashDownload } from "./unsplash";

/** Fallbacks visuais (sem IA) — engajamento + diferencial, sem prazo/stat. */
const FALLBACKS: Array<{
  layout: Layout;
  pillar: string;
  angle: string;
  kicker: string;
  title: string;
  headline: string;
  hook: string;
  items?: [string, string?][];
  left?: { label: string; rows: string[] };
  right?: { label: string; rows: string[] };
  tags: string[];
  photoQuery: string;
  visual?: FeedItem["visual"];
}> = [
  {
    layout: "hero",
    pillar: "conversao",
    angle: "site-afasta",
    kicker: "Presença",
    title: "Seu site está<br>afastando clientes?",
    headline: "A gente olha o seu.",
    hook: "Visitante some e você nem sabe por quê.",
    tags: ["site", "conversao"],
    photoQuery: "modern laptop website warm office",
  },
  {
    layout: "quote",
    pillar: "marca",
    angle: "modelo-nao-basta",
    kicker: "Sob medida",
    title: "Modelo pronto<br>não conta<br>a sua história.",
    headline: "Identidade própria.",
    hook: "Seu negócio não é template.",
    tags: ["marca", "sobmedida"],
    photoQuery: "brand design studio warm light",
    visual: "mark",
  },
  {
    layout: "split",
    pillar: "funil",
    angle: "clique-whatsapp",
    kicker: "Funil",
    title: "Do clique ao<br>WhatsApp.",
    items: [["Anúncio"], ["Página certa"], ["Conversa na hora"]],
    headline: "Lead que espera esfria.",
    hook: "Caminho curto. Conversa na hora.",
    tags: ["whatsapp", "leads"],
    photoQuery: "smartphone messaging hands cafe",
  },
  {
    layout: "compare",
    pillar: "diferencial",
    angle: "template-vs-prumo",
    kicker: "Diferença",
    title: "Template ou<br>presença real?",
    left: { label: "Template", rows: ["Igual a todo mundo", "Sem regra de negócio", "Lead some"] },
    right: { label: "Prumo", rows: ["Sua marca", "Fluxo até o Zap", "Mede o que importa"] },
    headline: "Escolha presença, não moldura.",
    hook: "Parecer genérico custa cliente.",
    tags: ["diferencial", "site"],
    photoQuery: "creative workspace desk plant sunlight",
  },
  {
    layout: "cards",
    pillar: "diagnostico",
    angle: "tres-sinais",
    kicker: "Diagnóstico",
    title: "Três sinais<br>de site fraco.",
    items: [["Demora para abrir"], ["Sem botão de contato"], ["Ninguém mede nada"]],
    headline: "Quer um olhar no seu?",
    hook: "Se ninguém mede, o site trabalha contra você.",
    tags: ["performance", "site"],
    photoQuery: "analytics dashboard laptop dark moody",
  },
  {
    layout: "hero",
    pillar: "propriedade",
    angle: "rede-e-aluguel",
    kicker: "Casa própria",
    title: "Rede social<br>é aluguel.",
    headline: "Site é o seu endereço.",
    hook: "Algoritmo muda. Seu site fica.",
    tags: ["presencadigital", "site"],
    photoQuery: "storefront open neon night street",
  },
  {
    layout: "quote",
    pillar: "credibilidade",
    angle: "cinco-segundos",
    kicker: "Primeira impressão",
    title: "Em 5 segundos<br>eles decidem<br>se confiam.",
    headline: "O visual fala primeiro.",
    hook: "Design fraco = dúvida no bolso.",
    tags: ["design", "confianca"],
    photoQuery: "handshake business warm natural light",
    visual: "mark",
  },
  {
    layout: "split",
    pillar: "clareza",
    angle: "uma-frase",
    kicker: "Clareza",
    title: "Em uma frase:<br>o que você vende?",
    items: [["Problema"], ["Promessa"], ["Prova"]],
    headline: "Se confunde, não converte.",
    hook: "Simplicidade vende mais.",
    tags: ["copy", "conversao"],
    photoQuery: "whiteboard strategy meeting natural",
  },
];

function norm(s: string) {
  return plain(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function recentLayouts(state: IgState, n = 3) {
  return state.published.slice(-n).map((p) => p.layout);
}

function usedTitles(state: IgState, captions: string[]) {
  const set = new Set(state.published.map((p) => norm(p.title)));
  for (const c of captions) {
    const line = c.split("\n").find((l) => l.trim() && !l.startsWith("#"));
    if (line) set.add(norm(line));
  }
  return set;
}

function pickFallback(state: IgState, captions: string[]): FeedItem {
  const avoid = recentLayouts(state, 3);
  const titles = usedTitles(state, captions);
  const ranked = FALLBACKS.map((b, i) => {
    let score = 50 - i;
    if (avoid.includes(b.layout)) score -= 40;
    if (titles.has(norm(b.title))) score -= 80;
    if (state.published.some((p) => p.id.includes(b.angle))) score -= 60;
    return { b, score };
  }).sort((a, c) => c.score - a.score);
  const top = ranked[0].b;
  return {
    id: `agency-${top.angle}-${Date.now().toString(36)}`,
    layout: top.layout,
    visual: top.visual || "leaves",
    kicker: top.kicker,
    title: top.title,
    items: top.items,
    left: top.left,
    right: top.right,
    headline: top.headline,
    hook: top.hook,
    tags: top.tags,
    pillar: top.pillar,
    angle: top.angle,
    photoQuery: top.photoQuery,
  } as FeedItem & { photoQuery?: string };
}

async function attachPhoto(item: FeedItem, photoQuery: string, state: IgState) {
  if (item.layout !== "hero" && item.layout !== "split") return item;
  const exclude = state.published.map((p) => (p as { photoId?: string }).photoId).filter(Boolean) as string[];
  const photo = await findPortraitPhoto(photoQuery, exclude);
  if (!photo) return item;
  await trackUnsplashDownload(photo.downloadLocation);
  return {
    ...item,
    photoUrl: photo.url,
    photoCredit: `Foto: ${photo.photographer} / Unsplash`,
    photoId: photo.id,
  };
}

export async function createAgencyPost(state: IgState, captions: string[] = []): Promise<FeedItem> {
  const avoidLayouts = recentLayouts(state, 3);
  const titles = [...usedTitles(state, captions)];

  try {
    const brief = await generateAgencyBrief({
      avoidTitles: titles,
      avoidLayouts,
      recentCaptions: captions,
    });
    if (avoidLayouts.slice(-1)[0] === brief.layout) {
      brief.layout = (["hero", "quote", "split", "cards", "compare"] as Layout[]).find((l) => !avoidLayouts.includes(l)) || "hero";
    }
    if (titles.includes(norm(brief.title))) {
      throw new Error("título Gemini repetido");
    }
    let item = briefToFeedItem(brief);
    item = await attachPhoto(item, brief.photoQuery || "brazilian business office warm", state);
    return item;
  } catch (err) {
    console.error("[agency] Gemini falhou, usando fallback visual:", err);
    const fb = pickFallback(state, captions) as FeedItem & { photoQuery?: string };
    const query = fb.photoQuery || "modern business workspace warm";
    const { photoQuery: _, ...rest } = fb as FeedItem & { photoQuery?: string };
    void _;
    return attachPhoto(rest, query, state);
  }
}

export function agencyCaption(item: FeedItem) {
  const lines = [item.hook || titleOf(item), "WhatsApp (11) 96633-1995"];
  if (item.photoCredit) lines.push(item.photoCredit);
  const tags = [...new Set([...(item.tags || []), "prumoweb", "empresas"])]
    .slice(0, 5)
    .map((t) => `#${t.replace(/[^\p{L}\p{N}_]/gu, "")}`);
  lines.push(tags.join(" "));
  return lines.join("\n\n");
}
