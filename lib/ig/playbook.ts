/**
 * Playbook editorial Web Prumo — PME Brasil.
 * Baseado em padrões de contas do nicho (carrosséis checklist,
 * processo, CTA WhatsApp) + regras 2026 (saves/shares > likes).
 */

export const CONTENT_PILLARS = {
  educational: 0.4,
  proof: 0.3,
  engagement: 0.2,
  promotion: 0.1,
} as const;

/** Mix semanal alvo (feed). Stories diários à parte. */
/** Fase atual: só Reels 1×/dia 07:00 BRT. Carrossel/story reativamos depois. */
export const WEEKLY_FEED_MIX = {
  reels: 7,
  carousels: 0,
  images: 0,
  promotionMax: 1,
} as const;

export const PUBLISH_CADENCE = {
  reels: "07:00 America/Sao_Paulo · 1 video/dia",
  stories: "pausado",
  feedImageCarousel: "pausado",
} as const;

export type WeekSlot = {
  day: string;
  format: "reel" | "carousel" | "image" | "story-set";
  pillar: "educational" | "proof" | "engagement" | "promotion";
  formula: string;
  angle: string;
  goal: "saves" | "shares" | "comments" | "follows";
  timeBrt: string;
};

/** Semana modelo — repetir/rotacionar ângulos, não copiar caption. */
export const SAMPLE_WEEK: WeekSlot[] = [
  {
    day: "Seg",
    format: "reel",
    pillar: "educational",
    formula: "IG9 Pattern-Interrupt",
    angle: "Instagram atrai. O site fecha. Qual dos dois você tem?",
    goal: "shares",
    timeBrt: "12:00",
  },
  {
    day: "Ter",
    format: "carousel",
    pillar: "educational",
    formula: "IG5 Listicle",
    angle: "6 coisas que uma landing que vende precisa ter (salva)",
    goal: "saves",
    timeBrt: "11:30",
  },
  {
    day: "Qua",
    format: "story-set",
    pillar: "engagement",
    formula: "poll + pergunta",
    angle: "Seu site gera WhatsApp ou só visita?",
    goal: "comments",
    timeBrt: "19:00",
  },
  {
    day: "Qui",
    format: "carousel",
    pillar: "proof",
    formula: "IG6 Before/After",
    angle: "Do briefing ao ar em 7–15 dias — o processo",
    goal: "follows",
    timeBrt: "12:00",
  },
  {
    day: "Sex",
    format: "reel",
    pillar: "engagement",
    formula: "IG3 Relatable",
    angle: "Site lento perde cliente. Mais da metade desiste em 3s",
    goal: "shares",
    timeBrt: "18:00",
  },
  {
    day: "Sáb",
    format: "reel",
    pillar: "educational",
    formula: "IG10 How-I",
    angle: "Como eu estruturo uma single page que leva pro WhatsApp",
    goal: "saves",
    timeBrt: "10:00",
  },
  {
    day: "Dom",
    format: "image",
    pillar: "promotion",
    formula: "IG1 Number-First",
    angle: "Escopo, prazo e valor fechados. WhatsApp na bio",
    goal: "follows",
    timeBrt: "18:00",
  },
];

export const STORY_CADENCE = [
  "Bastidor / tela do projeto (1 frame)",
  "Enquete ou caixa de pergunta",
  "Reshare do post do dia + sticker de link/WhatsApp",
] as const;

export const COMPETITOR_NOTES = [
  {
    handle: "freelancerstudioofc",
    followers: 16,
    takeaway: "Carrosséis de checklist + processo + CTA direct; 5 hashtags com âncora local",
  },
  {
    handle: "alvaronweb",
    followers: 1125,
    takeaway: "Dor PME (WordPress, Google, one page) + link na bio; captions longas, poucos likes",
  },
  {
    handle: "gabrielfreelancer",
    followers: 1817,
    takeaway: "Cases reais com URL geram comentário; feed parado desde 2021",
  },
] as const;

export const GROWTH_RULES = [
  "Marca única: Web Prumo / @web.prumo / #webprumo (nunca @prumo.web)",
  "3–5 hashtags sized por post; rotacionar pack por tema",
  "Hook nos primeiros 125 caracteres; CTA WhatsApp no rodapé",
  "Feed: qualidade > volume (alvo 1 post/slot, não burst)",
  "Reels = reach, carrossel = saves, stories = relação diária",
  "Promoção no máx 1–2 posts/semana",
  "Métrica-chefe: saves + shares + DMs WhatsApp, não likes",
] as const;
