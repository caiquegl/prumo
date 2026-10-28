import { bank, plain, titleOf } from "./content";
import type { FeedItem, IgState, Layout } from "./types";
import { LAYOUTS } from "./types";
import { findPortraitPhoto, trackUnsplashDownload, type UnsplashPhoto } from "./unsplash";

type Brief = {
  pillar: string;
  angle: string;
  layout: Layout;
  visual: FeedItem["visual"];
  kicker: string;
  title: string;
  sub?: string;
  items?: [string, string?][];
  left?: { label: string; rows: string[] };
  right?: { label: string; rows: string[] };
  stat?: { value: string; label: string };
  headline: string;
  hook: string;
  tags: string[];
  photoQuery: string;
};

/** Direção criativa da Prumo — ângulos distintos, pouco texto, visual de agência. */
const BRIEFS: Brief[] = [
  {
    pillar: "conversao",
    angle: "site-afasta-clientes",
    layout: "hero",
    visual: "leaves",
    kicker: "Presença",
    title: "Seu site está<br>afastando clientes?",
    headline: "A gente olha o seu.",
    hook: "Visitante some e você nem sabe por quê.",
    tags: ["site", "conversao"],
    photoQuery: "modern website laptop desk warm light",
  },
  {
    pillar: "prazo",
    angle: "landing-em-dias",
    layout: "stat",
    visual: "mark",
    kicker: "Prazo",
    title: "Do briefing<br>ao ar.",
    stat: { value: "7–15", label: "dias para a landing no ar" },
    headline: "Escopo fechado.",
    hook: "Prévia aprovada. Entrega sem enrolação.",
    tags: ["landingpage", "prazo"],
    photoQuery: "calendar planning desk minimal",
  },
  {
    pillar: "funil",
    angle: "clique-whatsapp",
    layout: "split",
    visual: "wire",
    kicker: "Funil",
    title: "Do clique ao<br>WhatsApp.",
    items: [["Anúncio"], ["Página certa"], ["Conversa na hora"]],
    headline: "Lead que espera esfria.",
    hook: "O caminho precisa ser curto.",
    tags: ["whatsapp", "leads"],
    photoQuery: "smartphone whatsapp message business",
  },
  {
    pillar: "marca",
    angle: "modelo-nao-basta",
    layout: "quote",
    visual: "mark",
    kicker: "Sob medida",
    title: "Modelo pronto<br>não conta<br>a sua história.",
    headline: "O seu negócio não é genérico.",
    hook: "Identidade e regras precisam ser suas.",
    tags: ["marca", "sobmedida"],
    photoQuery: "brand design studio workspace",
  },
  {
    pillar: "diagnostico",
    angle: "tres-sinais",
    layout: "cards",
    visual: "leaves",
    kicker: "Diagnóstico",
    title: "Três sinais<br>de site fraco.",
    items: [["Demora para abrir"], ["Sem botão de contato"], ["Ninguém mede nada"]],
    headline: "Quer um olhar no seu?",
    hook: "Se ninguém mede, o site trabalha contra você.",
    tags: ["performance", "site"],
    photoQuery: "website analytics dashboard dark",
  },
  {
    pillar: "gestao",
    angle: "planilha-vs-sistema",
    layout: "compare",
    visual: "chart",
    kicker: "Gestão",
    title: "Planilha ou<br>sistema?",
    left: { label: "Planilha", rows: ["Versões duplicadas", "Fórmula que quebra", "Relatório à mão"] },
    right: { label: "Sob medida", rows: ["Uma fonte da verdade", "Regras na entrada", "Painel no dia"] },
    headline: "Hora de sair da planilha?",
    hook: "Operação numa planilha = risco.",
    tags: ["sistemas", "automacao"],
    photoQuery: "business spreadsheet laptop coffee",
  },
  {
    pillar: "propriedade",
    angle: "rede-e-aluguel",
    layout: "hero",
    visual: "cloud",
    kicker: "Casa própria",
    title: "Rede social<br>é aluguel.",
    headline: "Site é o seu endereço.",
    hook: "Algoritmo muda. Seu site fica.",
    tags: ["presencadigital", "site"],
    photoQuery: "storefront open sign street warm",
  },
  {
    pillar: "performance",
    angle: "nota-cem",
    layout: "stat",
    visual: "chart",
    kicker: "Velocidade",
    title: "Lento<br>não vende.",
    stat: { value: "3s", label: "e o visitante já foi embora" },
    headline: "Performance é conversão.",
    hook: "Cada segundo a mais custa lead.",
    tags: ["performance", "seo"],
    photoQuery: "fast racing motion blur abstract",
  },
  {
    pillar: "credibilidade",
    angle: "primeiro-impacto",
    layout: "quote",
    visual: "mark",
    kicker: "Primeira impressão",
    title: "Em 5 segundos<br>eles decidem<br>se confiam.",
    headline: "O visual fala antes de você.",
    hook: "Design fraco = dúvida no bolso.",
    tags: ["design", "confianca"],
    photoQuery: "handshake business trust office",
  },
  {
    pillar: "leads",
    angle: "formulario-longo",
    layout: "split",
    visual: "wire",
    kicker: "Conversão",
    title: "Formulário<br>longo mata lead.",
    items: [["Nome"], ["WhatsApp"], ["Pronto"]],
    headline: "Menos campos. Mais conversa.",
    hook: "Pergunte só o essencial.",
    tags: ["leads", "conversao"],
    photoQuery: "person filling form tablet cafe",
  },
  {
    pillar: "automacao",
    angle: "tarefa-manual",
    layout: "cards",
    visual: "chart",
    kicker: "Automação",
    title: "O que ainda<br>é feito à mão?",
    items: [["Pedido que some"], ["Status no Zap"], ["Relatório semanal"]],
    headline: "A gente automatiza isso.",
    hook: "Tempo de equipe não é infinito.",
    tags: ["automacao", "operacao"],
    photoQuery: "factory automation technology abstract",
  },
  {
    pillar: "mobile",
    angle: "mobile-primeiro",
    layout: "hero",
    visual: "wire",
    kicker: "Mobile",
    title: "Seu cliente<br>abre no celular.",
    headline: "Desktop é exceção.",
    hook: "Se não cabe no bolso, não vende.",
    tags: ["mobile", "ux"],
    photoQuery: "hands holding smartphone city night",
  },
  {
    pillar: "posicionamento",
    angle: "parecer-barato",
    layout: "quote",
    visual: "leaves",
    kicker: "Posicionamento",
    title: "Parecer barato<br>custa caro.",
    headline: "Visual é preço percebido.",
    hook: "Investir em presença é margem.",
    tags: ["marca", "posicionamento"],
    photoQuery: "luxury minimal product photography beige",
  },
  {
    pillar: "atendimento",
    angle: "resposta-rapida",
    layout: "stat",
    visual: "mark",
    kicker: "Atendimento",
    title: "Quem responde<br>primeiro, vende.",
    stat: { value: "5min", label: "janela de ouro do lead quente" },
    headline: "WhatsApp no funil.",
    hook: "Lead quente não espera amanhã.",
    tags: ["whatsapp", "vendas"],
    photoQuery: "customer support headset office warm",
  },
  {
    pillar: "clareza",
    angle: "proposta-clara",
    layout: "split",
    visual: "leaves",
    kicker: "Clareza",
    title: "Em uma frase:<br>o que você vende?",
    items: [["Problema"], ["Promessa"], ["Prova"]],
    headline: "Se não cabe numa frase, o site confunde.",
    hook: "Simplicidade vende mais.",
    tags: ["copy", "site"],
    photoQuery: "whiteboard strategy meeting team",
  },
  {
    pillar: "risco",
    angle: "depender-de-uma-pessoa",
    layout: "compare",
    visual: "chart",
    kicker: "Risco",
    title: "Tudo na cabeça<br>de alguém?",
    left: { label: "Hoje", rows: ["Só fulano sabe", "Zap bagunçado", "Erro silencioso"] },
    right: { label: "Com sistema", rows: ["Processo escrito", "Histórico limpo", "Alerta na hora"] },
    headline: "Escalabilidade começa no registro.",
    hook: "Conhecimento preso em pessoa = dívida.",
    tags: ["gestao", "sistemas"],
    photoQuery: "team collaboration office glass",
  },
  {
    pillar: "seo",
    angle: "aparecer-google",
    layout: "hero",
    visual: "cloud",
    kicker: "Descoberta",
    title: "Se não aparece,<br>não existe.",
    headline: "Google ainda traz cliente frio.",
    hook: "Site bem feito é vitrine 24h.",
    tags: ["seo", "presencadigital"],
    photoQuery: "search engine laptop browser light",
  },
  {
    pillar: "prova",
    angle: "prova-social",
    layout: "cards",
    visual: "mark",
    kicker: "Prova",
    title: "Por que te<br>escolheriam?",
    items: [["Caso real"], ["Antes e depois"], ["Número concreto"]],
    headline: "Prova social vende sozinha.",
    hook: "Sem prova, é só opinião.",
    tags: ["vendas", "marca"],
    photoQuery: "five star review phone closeup",
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

function usedAngles(state: IgState) {
  const fromPub = state.published.map((p) => p.id.replace(/^agency-/, "").replace(/-\d+$/, ""));
  return new Set(fromPub);
}

function usedTitles(state: IgState, captions: string[]) {
  const set = new Set(state.published.map((p) => norm(p.title)));
  for (const c of captions) {
    const first = c.split("\n").find((l) => l.trim() && !l.startsWith("#"));
    if (first) set.add(norm(first));
  }
  return set;
}

function recentLayouts(state: IgState, n = 3) {
  return state.published.slice(-n).map((p) => p.layout);
}

function scoreBrief(brief: Brief, state: IgState, captions: string[]) {
  const angles = usedAngles(state);
  const titles = usedTitles(state, captions);
  const avoid = recentLayouts(state, 3);
  let score = 100;
  if (angles.has(brief.angle)) score -= 80;
  if (titles.has(norm(brief.title))) score -= 90;
  if (avoid.includes(brief.layout)) score -= 40;
  if (avoid.slice(-1)[0] === brief.layout) score -= 30;
  const pillarHits = state.published.filter((p) => p.id.includes(brief.pillar)).length;
  score -= pillarHits * 8;
  return score;
}

function briefToItem(brief: Brief, photo?: UnsplashPhoto | null): FeedItem {
  const stamp = Date.now().toString(36);
  return {
    id: `agency-${brief.angle}-${stamp}`,
    layout: brief.layout,
    visual: brief.visual,
    kicker: brief.kicker,
    title: brief.title,
    sub: brief.sub,
    items: brief.items,
    left: brief.left,
    right: brief.right,
    stat: brief.stat,
    headline: brief.headline,
    hook: brief.hook,
    tags: brief.tags,
    photoUrl: photo?.url,
    photoCredit: photo ? `Foto: ${photo.photographer} / Unsplash` : undefined,
    photoId: photo?.id,
    pillar: brief.pillar,
    angle: brief.angle,
  };
}

function bankFallback(state: IgState): FeedItem {
  const used = new Set(state.published.map((p) => p.id));
  const avoid = recentLayouts(state, 2);
  const pool = bank.filter((it) => !used.has(it.id) && !avoid.includes(it.layout));
  const pick = pool[0] || bank.find((it) => it.layout !== avoid.at(-1)) || bank[0];
  return { ...pick, id: `agency-bank-${pick.id}-${Date.now().toString(36)}` };
}

export async function createAgencyPost(state: IgState, captions: string[] = []): Promise<FeedItem> {
  const ranked = [...BRIEFS]
    .map((b) => ({ b, score: scoreBrief(b, state, captions) }))
    .sort((a, c) => c.score - a.score);

  const top = ranked.find((r) => r.score > 20)?.b || ranked[0]?.b;
  if (!top) return bankFallback(state);

  const excludePhotoIds = state.published
    .map((p) => (p as { photoId?: string }).photoId)
    .filter(Boolean) as string[];

  let photo: UnsplashPhoto | null = null;
  if (top.layout === "hero" || top.layout === "split") {
    photo = await findPortraitPhoto(top.photoQuery, excludePhotoIds);
    if (photo) await trackUnsplashDownload(photo.downloadLocation);
  }

  return briefToItem(top, photo);
}

export function agencyCaption(item: FeedItem) {
  const title = titleOf(item);
  const lines = [item.hook || title, "WhatsApp (11) 96633-1995"];
  if (item.photoCredit) lines.push(item.photoCredit);
  const tags = [...new Set([...(item.tags || []), "prumoweb", "empresas"])]
    .slice(0, 5)
    .map((t) => `#${t.replace(/[^\p{L}\p{N}_]/gu, "")}`);
  lines.push(tags.join(" "));
  return lines.join("\n\n");
}

export function nextLayout(state: IgState): Layout {
  const avoid = new Set(recentLayouts(state, 2));
  return LAYOUTS.find((l) => !avoid.has(l)) || LAYOUTS[0];
}
