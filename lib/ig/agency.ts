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
    pillar: "single-page",
    angle: "single-page-converte",
    kicker: "Single page",
    title: "Uma página.<br>Lead no Zap.",
    headline: "Desenvolvida pro seu negócio.",
    hook: "Single page sob medida, não template genérico.",
    tags: ["singlepage", "desenvolvimento"],
    photoQuery: "laptop modern landing page website UI desk warm",
  },
  {
    layout: "quote",
    pillar: "codigo-proprio",
    angle: "codigo-nao-template",
    kicker: "TI freela",
    title: "Código próprio.<br>Sem plataforma<br>te prendendo.",
    headline: "Site seu, de verdade.",
    hook: "Desenvolvimento web sob medida pra empresa.",
    tags: ["desenvolvimento", "ti"],
    photoQuery: "developer laptop code editor soft light desk",
    visual: "wire",
  },
  {
    layout: "split",
    pillar: "funil-whatsapp",
    angle: "clique-whatsapp",
    kicker: "Funil",
    title: "Do clique ao<br>WhatsApp.",
    items: [["Landing"], ["CTA claro"], ["Conversa no Zap"]],
    headline: "Lead que espera esfria.",
    hook: "Single page que joga o cliente no seu WhatsApp.",
    tags: ["whatsapp", "landingpage"],
    photoQuery: "smartphone whatsapp next to laptop website mockup",
  },
  {
    layout: "compare",
    pillar: "site-sob-medida",
    angle: "template-vs-prumo",
    kicker: "Diferença",
    title: "Template ou<br>single page real?",
    left: { label: "Template", rows: ["Igual a todo mundo", "Lento e genérico", "Lead some"] },
    right: { label: "Prumo", rows: ["Código próprio", "Feito pro seu negócio", "CTA no WhatsApp"] },
    headline: "TI freela com entrega clara.",
    hook: "Template pronto não vende o seu serviço.",
    tags: ["singlepage", "sobmedida"],
    photoQuery: "browser window clean website mockup on monitor",
  },
  {
    layout: "cards",
    pillar: "landing",
    angle: "tres-sinais",
    kicker: "Diagnóstico",
    title: "Três sinais<br>de site fraco.",
    items: [["Demora para abrir"], ["Sem botão de WhatsApp"], ["Parece template"]],
    headline: "Quer uma single page certa?",
    hook: "Site genérico trabalha contra o seu negócio.",
    tags: ["performance", "landingpage"],
    photoQuery: "analytics dashboard laptop website dark moody",
  },
  {
    layout: "hero",
    pillar: "site-sob-medida",
    angle: "rede-e-aluguel",
    kicker: "Presença digital",
    title: "Rede social<br>é aluguel.",
    headline: "Single page é seu endereço.",
    hook: "Algoritmo muda. Seu site fica.",
    tags: ["singlepage", "site"],
    photoQuery: "laptop showing one-page website cafe table",
  },
  {
    layout: "quote",
    pillar: "ti-freela",
    angle: "cinco-segundos",
    kicker: "Primeira impressão",
    title: "Em 5 segundos<br>eles decidem<br>se confiam.",
    headline: "UI limpa. Lead no Zap.",
    hook: "Landing feia = dúvida no bolso.",
    tags: ["design", "desenvolvimento"],
    photoQuery: "close up clean website UI on laptop screen",
    visual: "mark",
  },
  {
    layout: "split",
    pillar: "landing",
    angle: "uma-frase",
    kicker: "Clareza",
    title: "Em uma frase:<br>o que você vende?",
    items: [["Problema"], ["Promessa"], ["Botão no Zap"]],
    headline: "Single page que explica e converte.",
    hook: "Se confunde, não chama no WhatsApp.",
    tags: ["copy", "landingpage"],
    photoQuery: "web designer reviewing landing page on monitor",
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
    visual: top.visual || "mark",
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
