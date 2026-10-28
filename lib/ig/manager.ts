import { put } from "@vercel/blob";
import { generateArt, type ArtistResult } from "./artists";
import type { FeedItem, IgState } from "./types";
import { titleOf } from "./content";

export type ManagedPost = {
  item: FeedItem;
  caption: string;
  imageUrl: string;
  artist?: ArtistResult["provider"];
  attempts: Array<{ provider?: string; approved: boolean; reason: string }>;
};

const MODELS = [
  process.env.GEMINI_MODEL,
  "gemini-flash-lite-latest",
  "gemini-3.5-flash-lite",
  "gemini-3.8-flash",
].filter(Boolean) as string[];

async function geminiText(prompt: string, maxTokens = 1200): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY ausente");
  let last = "Gemini indisponível";
  for (const model of MODELS) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.95, maxOutputTokens: maxTokens },
      }),
    });
    const json = (await res.json()) as {
      error?: { message?: string };
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    if (!res.ok || json.error) {
      last = json.error?.message || `HTTP ${res.status}`;
      continue;
    }
    const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
    if (text) return text;
  }
  throw new Error(last);
}

function extractJsonObject(text: string): Record<string, unknown> {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = (fenced?.[1] || text).trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end < 0) throw new Error("JSON ausente");
  return JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
}

function slugify(s: string) {
  return (
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || `c-${Date.now().toString(36)}`
  );
}

function recentConcepts(state: IgState): string[] {
  return state.published
    .slice(-15)
    .map((p) => p.item?.concept || p.id.replace(/^agency-/, "").replace(/-[a-z0-9]+$/i, ""))
    .filter(Boolean);
}

type PostBrief = {
  concept: string;
  angle: string;
  pillar: string;
  kicker: string;
  title: string;
  hook: string;
  headline: string;
  tags: string[];
  /** Prompt completo em inglês para o gerador de imagem (post inteiro) */
  imagePrompt: string;
};

/**
 * Playbook extraído de feeds de web design / landing page (ex.: @_alysonfarias, @guilhermevictordesign):
 * - O HERO da arte é o PRODUTO: mockup de site/landing em laptop, monitor ou browser (portfolio shot).
 * - Pouquíssimo texto na imagem (0–6 palavras) — tipografia amadora quebra a peça.
 * - Logo, @ e telefone NÃO vão na arte — ficam na legenda.
 * - Visual premium: cinematic lighting, UI realista, ângulo de produto; não sticker/badge.
 * - Cada post muda ângulo/composição (desk, floating device, dark OLED, close no hero da LP).
 */
async function inventImagePost(input: {
  avoidConcepts: string[];
  avoidTitles: string[];
  recentCaptions: string[];
}): Promise<PostBrief> {
  const text = await geminiText(
    `You are art director for Prumo Web — Brazilian freelance web/TI that sells custom single pages and sites.

Study this PLAYBOOK from professional web-design Instagram feeds (portfolio-first, like landing-page freelancers / Webflow studios):
1) The IMAGE is a high-end PRODUCT shot of a website/landing page UI (laptop, iMac, browser window, or phone showing a real-looking LP — not abstract art).
2) Almost NO text on the image. Optional: one short Portuguese punchline in quotes, max 6 words, perfect spelling. Prefer ZERO text if the mockup already sells the idea.
3) NEVER paint logo, brand name "Prumo", "@prumo.web", WhatsApp, phone numbers, seals, badges, stickers, or watermark — those go only in the Instagram caption.
4) Look: cinematic, editorial, agency portfolio. Soft shadows, realistic device bezels, crisp UI blocks (fake readable UI ok as blur/lorem shapes), terracotta/cream OR charcoal/dark OLED variants.
5) Unique camera every time. Forbidden recent concepts: ${input.avoidConcepts.join(", ") || "none"}.
6) Forbidden looks: clay sculptures, sticker badges, code editor with huge typo headlines, cream template card with logo bar, phone+numbered list infographic, gibberish text.

Topic must clearly sell custom landing/single page / freela web (the mockup UI should look like a conversion landing page: hero, CTA area, clean sections).

Also return Portuguese caption fields (brand + WhatsApp live ONLY in caption, not in imagePrompt).

Avoid titles: ${input.avoidTitles.slice(0, 10).join(" | ") || "none"}
Recent captions: ${input.recentCaptions.slice(0, 5).join(" || ").slice(0, 700) || "none"}

Respond ONLY JSON:
{
  "concept": "unique-english-slug",
  "angle": "short-slug",
  "pillar": "single-page|landing|codigo-proprio|performance|funil-whatsapp|ti-freela",
  "kicker": "short label for DB",
  "title": "short title for DB",
  "hook": "caption hook selling the service",
  "headline": "CTA for caption (not for image)",
  "tags": ["singlepage","desenvolvimento"],
  "imagePrompt": "English prompt for nanobanana/flux: full-bleed professional portfolio photo of a landing page mockup, unique angle, NO logos NO phone NO @handle, optional max 6-word Portuguese quote if any, vertical 4:5 Instagram"
}`,
    1400,
  );

  const json = extractJsonObject(text);
  const concept = slugify(String(json.concept || `post-${Date.now().toString(36)}`));
  const imagePrompt = String(json.imagePrompt || "");
  if (!imagePrompt) throw new Error("imagePrompt vazio");

  return {
    concept,
    angle: slugify(String(json.angle || concept)),
    pillar: String(json.pillar || "single-page"),
    kicker: String(json.kicker || "SINGLE PAGE"),
    title: String(json.title || "Single page sob medida"),
    hook: String(json.hook || "Site sob medida com lead no WhatsApp."),
    headline: String(json.headline || "Chama no WhatsApp."),
    tags: Array.isArray(json.tags) ? (json.tags as string[]).map(String) : ["singlepage", "desenvolvimento"],
    imagePrompt: `${imagePrompt}. Professional web-design portfolio Instagram photo, 1080x1350 vertical. Show a realistic custom landing page / single-page website on a device. Absolutely NO logo, NO brand name, NO @handle, NO phone number, NO WhatsApp badge, NO watermark, NO sticker seal. Minimal or zero on-image text. Cinematic lighting, high-end agency look. Seed ${Date.now()}.`,
  };
}

async function managerApprove(input: {
  brief: PostBrief;
  provider: string;
  imageUrl: string;
}): Promise<{ approved: boolean; reason: string; revisePrompt?: string }> {
  try {
    const text = await geminiText(
      `Você é gerente de marketing da Prumo Web (feed estilo portfolio de web design).
Avalie a IMAGEM gerada por IA.
APROVAR só se:
1) Parece foto/portfolio profissional de landing page ou site (mockup em device) — não arte abstrata nem sticker
2) NÃO tem logo Prumo, @, telefone ou selo WhatsApp na arte (isso vai na legenda)
3) Visual premium, ângulo interessante, UI de site legível como produto
4) Composição diferente de posts genéricos com tipografia torta
REPROVAR: badge laranja com número, logo forçado, texto ilegível, clay/abstrato, card template
Conceito: ${input.brief.concept}
Título: ${input.brief.title}
Provider: ${input.provider}
URL: ${input.imageUrl}
JSON: {"approved":true|false,"reason":"frase","revisePrompt":"novo prompt inglês de MOCKUP DE LANDING PAGE sem logo/telefone se reprovar"}`,
      450,
    );
    const json = extractJsonObject(text);
    return {
      approved: Boolean(json.approved),
      reason: String(json.reason || ""),
      revisePrompt: json.revisePrompt ? String(json.revisePrompt) : undefined,
    };
  } catch (err) {
    return { approved: true, reason: `gerente indisponível (${err instanceof Error ? err.message : "erro"})` };
  }
}

function artPhotoId(art: ArtistResult): string {
  const head = art.bytes.subarray(0, 24).toString("hex");
  return `art-${art.provider}-${art.bytes.byteLength}-${head}`;
}

async function publishArt(
  art: ArtistResult,
  id: string,
  item: FeedItem,
  reqOrigin: string,
): Promise<{ item: FeedItem; imageUrl: string }> {
  try {
    const ext = art.contentType.includes("png") ? "png" : "jpg";
    const blob = await put(`ig-auto/ai-full-${id}-${Date.now()}.${ext}`, art.bytes, {
      access: "public",
      contentType: art.contentType,
      addRandomSuffix: true,
    });
    return { item, imageUrl: blob.url };
  } catch (err) {
    console.error("[manager] blob AI post failed", err);
    return {
      item: {
        ...item,
        __renderedPng: art.bytes.toString("base64"),
        __renderedMime: art.contentType,
      } as FeedItem & { __renderedPng: string; __renderedMime: string },
      imageUrl: `${reqOrigin}/api/og/rendered?id=${encodeURIComponent(id)}&t=${Date.now()}`,
    };
  }
}

function briefToItem(brief: PostBrief, id: string, photoId?: string): FeedItem {
  return {
    id,
    // layout só metadado no banco — a peça visual é 100% IA
    layout: "quote",
    kicker: brief.kicker,
    title: brief.title,
    headline: brief.headline,
    hook: brief.hook,
    tags: brief.tags,
    pillar: brief.pillar,
    angle: brief.angle,
    concept: brief.concept,
    photoId,
  };
}

export async function produceManagedPost(input: {
  state: IgState;
  captions: string[];
  reqOrigin: string;
  saveDraft: (id: string, payload: unknown, dark?: boolean) => Promise<void>;
}): Promise<ManagedPost> {
  const avoidConcepts = recentConcepts(input.state);
  const avoidTitles = input.state.published.map((p) => p.title.toLowerCase());

  let brief = await inventImagePost({
    avoidConcepts,
    avoidTitles,
    recentCaptions: input.captions,
  });

  const attempts: ManagedPost["attempts"] = [];
  const maxRounds = 3;

  for (let round = 0; round < maxRounds; round++) {
    if (avoidConcepts.includes(brief.concept)) {
      brief = { ...brief, concept: `${brief.concept}-r${round}-${Date.now().toString(36)}`.slice(0, 48) };
    }

    const art = await generateArt(brief.imagePrompt);
    if (!art) {
      attempts.push({ approved: false, reason: "geradores de imagem falharam neste round" });
      break;
    }

    const id = `agency-${brief.concept}-${Date.now().toString(36)}`;
    const item = briefToItem(brief, id, artPhotoId(art));
    const published = await publishArt(art, id, item, input.reqOrigin);
    await input.saveDraft(published.item.id, published.item, false);

    const verdict = await managerApprove({
      brief,
      provider: art.provider,
      imageUrl: published.imageUrl,
    });
    attempts.push({ provider: art.provider, approved: verdict.approved, reason: verdict.reason });

    if (verdict.approved) {
      const { __renderedPng: _, __renderedMime: __, ...clean } = published.item as FeedItem & {
        __renderedPng?: string;
        __renderedMime?: string;
      };
      void _;
      void __;
      return {
        item: clean,
        caption: buildCaption(clean),
        imageUrl: published.imageUrl,
        artist: art.provider,
        attempts,
      };
    }

    if (verdict.revisePrompt) {
      brief = {
        ...brief,
        concept: slugify(`rev-${brief.concept}-${round}`),
        imagePrompt: `${verdict.revisePrompt}. Completely different composition from previous attempt. Full Instagram post graphic, vertical 4:5. Seed ${Date.now()}.`,
      };
    } else {
      brief = await inventImagePost({
        avoidConcepts: [...avoidConcepts, brief.concept],
        avoidTitles,
        recentCaptions: input.captions,
      }).catch(() => brief);
    }
  }

  throw new Error(`falhou ao gerar post só com IA: ${attempts.map((a) => a.reason).join(" | ")}`);
}

function buildCaption(item: FeedItem) {
  const lines = [
    item.hook || titleOf(item),
    item.headline || "Single page e site sob medida — código próprio, lead no WhatsApp.",
    "Prumo Web · @prumo.web",
    "Orçamento no WhatsApp: (11) 96633-1995",
  ];
  const tags = [
    ...new Set([...(item.tags || []), "prumoweb", "singlepage", "desenvolvimento", "landingpage", "freelance"]),
  ]
    .slice(0, 6)
    .map((t) => `#${t.replace(/[^\p{L}\p{N}_]/gu, "")}`);
  lines.push(tags.join(" "));
  return lines.join("\n\n");
}
