import { put } from "@vercel/blob";
import type { AiBrief } from "./gemini";
import { generateAgencyBrief, briefToFeedItem } from "./gemini";
import { generateArt, type ArtistResult } from "./artists";
import { renderFeedImage } from "./render";
import type { FeedItem, IgState, Layout } from "./types";
import { plain, titleOf } from "./content";

export type ManagedPost = {
  item: FeedItem;
  caption: string;
  imageUrl: string;
  artist?: ArtistResult["provider"] | "feedcard-unsplash";
  attempts: Array<{ provider?: string; approved: boolean; reason: string }>;
};

const MODELS = [
  process.env.GEMINI_MODEL,
  "gemini-flash-lite-latest",
  "gemini-3.5-flash-lite",
  "gemini-3.8-flash",
].filter(Boolean) as string[];

async function geminiText(prompt: string, maxTokens = 900): Promise<string> {
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
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || "conceito";
}

function recentConcepts(state: IgState): string[] {
  return state.published
    .slice(-12)
    .map((p) => p.item?.concept || (p.id.startsWith("agency-") ? p.id.split("-").slice(1, -1).join("-") : ""))
    .filter(Boolean);
}

/** Inventa composição ÚNICA do post inteiro (não moldura fixa + foto). */
async function inventFullPostDesign(
  brief: AiBrief,
  avoidConcepts: string[],
): Promise<{ concept: string; prompt: string }> {
  const text = await geminiText(
    `You are the art director of Prumo Web (@prumo.web), a Brazilian freelance IT studio that builds custom single pages / landings and sites (own code, WhatsApp conversion).

Design ONE complete Instagram feed post 1080x1350 as a FINISHED graphic (not a photo background).
The image model will render EVERYTHING: brand, typography, diagrams, charts, mockups, CTA — unique composition.

CRITICAL:
- Invent a NEW composition concept never used before. Forbidden recent concepts: ${avoidConcepts.join(", ") || "none"}.
- DO NOT use the repetitive template "big photo rectangle + title underneath + logo bar".
- Composition must feel like a professional agency infographic / editorial piece (vary wildly each time: anatomy of a page, performance bars, integration hub, process steps, checklist cards, before/after, quote + marks, wireframe callouts, metric callout, FAQ stack, funnel stages — or invent a NEW structure).
- Include readable Portuguese text IN the image exactly as given below.
- Brand: small orange square with white P + "Prumo Web" top-left, "@prumo.web" top-right.
- Colors: cream #f3eee6 bg, charcoal #1a1916 text, terracotta #d4573e accents. Serif headlines + clean sans body.
- Footer CTA + WhatsApp (11) 96633-1995.
- Topic MUST stay on single page / custom web / TI freela / WhatsApp leads — not generic corporate boardroom.

Copy to render:
- kicker: ${brief.kicker}
- title: ${plain(brief.title)}
- supporting: ${brief.hook}
- CTA line: ${brief.headline || "Seu próximo projeto pode começar aqui."}

Respond ONLY JSON:
{"concept":"unique-english-slug","prompt":"very detailed English prompt for an image model describing the FULL unique layout, exact Portuguese strings to paint, colors, hierarchy, and what makes this composition different"}`,
    1200,
  );
  const json = extractJsonObject(text);
  const concept = slugify(String(json.concept || `c-${Date.now().toString(36)}`));
  const prompt = String(json.prompt || "");
  if (!prompt) throw new Error("prompt de post completo vazio");
  return {
    concept,
    prompt: `${prompt}. Vertical 4:5 Instagram marketing graphic, finished designed post (not raw photo), sharp readable Portuguese typography, Prumo Web brand, cream and terracotta, no watermark, no stock photo frame template. Seed ${Date.now()}.`,
  };
}

export async function managerApprove(input: {
  brief: AiBrief;
  provider: string;
  imageUrl: string;
  concept: string;
}): Promise<{ approved: boolean; reason: string; revisePrompt?: string }> {
  try {
    const text = await geminiText(
      `Você é gerente de marketing da Prumo Web (TI freela: single page, landing, site sob medida).
Avalie o POST COMPLETO gerado (peça final, não fundo).
Aprovar só se:
1) Parece post de agência desenhado (infográfico/editorial), NÃO "foto numa moldura com título embaixo"
2) Tem marca Prumo / texto legível / CTA WhatsApp
3) Fala de site/single page/TI/conversão (não corporativo vazio)
4) Composição parece única para o conceito "${input.concept}"
Brief: ${JSON.stringify({ title: plain(input.brief.title), hook: input.brief.hook, kicker: input.brief.kicker })}
Provider: ${input.provider}
URL: ${input.imageUrl}
Responda SOMENTE JSON:
{"approved":true|false,"reason":"frase","revisePrompt":"novo prompt inglês de POST COMPLETO com OUTRA composição se reprovar, senão vazio"}`,
      500,
    );
    const json = extractJsonObject(text);
    return {
      approved: Boolean(json.approved),
      reason: String(json.reason || ""),
      revisePrompt: json.revisePrompt ? String(json.revisePrompt) : undefined,
    };
  } catch (err) {
    return { approved: true, reason: `gerente indisponível, segue (${err instanceof Error ? err.message : "erro"})` };
  }
}

function artPhotoId(art: ArtistResult): string {
  const head = art.bytes.subarray(0, 24).toString("hex");
  return `art-${art.provider}-${art.bytes.byteLength}-${head}`;
}

async function publishArtBytes(
  art: ArtistResult,
  id: string,
  reqOrigin: string,
  item: FeedItem,
): Promise<{ item: FeedItem; imageUrl: string }> {
  try {
    const ext = art.contentType.includes("png") ? "png" : "jpg";
    const blob = await put(`ig-auto/full-${id}-${Date.now()}.${ext}`, art.bytes, {
      access: "public",
      contentType: art.contentType,
      addRandomSuffix: true,
    });
    return { item, imageUrl: blob.url };
  } catch (err) {
    console.error("[manager] blob full post failed, using /api/og/rendered", err);
    const withPng = {
      ...item,
      __renderedPng: art.bytes.toString("base64"),
      __renderedMime: art.contentType,
    } as FeedItem & { __renderedPng: string; __renderedMime: string };
    return {
      item: withPng,
      imageUrl: `${reqOrigin}/api/og/rendered?id=${encodeURIComponent(id)}&t=${Date.now()}`,
    };
  }
}

/** Fallback raro: FeedCard tipográfico (sem foto-moldura), layouts que não sejam hero. */
async function feedcardFallback(brief: AiBrief, state: IgState, reqOrigin: string): Promise<{ item: FeedItem; imageUrl: string }> {
  const id = `agency-${slugify(brief.angle)}-${Date.now().toString(36)}`;
  const textLayouts: Layout[] = ["quote", "cards", "compare"];
  const last = state.published.at(-1)?.layout;
  const textLayout = textLayouts.find((l) => l !== last) || "quote";
  const item = briefToFeedItem({ ...brief, layout: textLayout });
  item.id = id;
  item.photoUrl = undefined;
  item.concept = `feedcard-${textLayout}`;
  const png = await renderFeedImage(item, false);
  try {
    const blob = await put(`ig-auto/${item.id}-${Date.now()}.png`, png, {
      access: "public",
      contentType: "image/png",
      addRandomSuffix: true,
    });
    return { item, imageUrl: blob.url };
  } catch {
    return {
      item: { ...item, __renderedPng: png.toString("base64") } as FeedItem & { __renderedPng: string },
      imageUrl: `${reqOrigin}/api/og/rendered?id=${encodeURIComponent(item.id)}&t=${Date.now()}`,
    };
  }
}

export async function produceManagedPost(input: {
  state: IgState;
  captions: string[];
  reqOrigin: string;
  saveDraft: (id: string, payload: unknown, dark?: boolean) => Promise<void>;
}): Promise<ManagedPost> {
  const avoidLayouts = input.state.published.slice(-3).map((p) => p.layout);
  const avoidTitles = input.state.published.map((p) => p.title.toLowerCase());
  const avoidConcepts = recentConcepts(input.state);
  const avoidAngles = input.state.published
    .slice(-8)
    .flatMap((p) => [p.item?.angle, p.id.replace(/^agency-/, "").replace(/-[a-z0-9]+$/i, "")])
    .filter(Boolean) as string[];
  const brief = await generateAgencyBrief({
    avoidTitles,
    avoidLayouts,
    recentCaptions: input.captions,
    avoidAngles,
  });

  let design = await inventFullPostDesign(brief, avoidConcepts).catch(async () => ({
    concept: slugify(`solo-${brief.angle}-${Date.now().toString(36)}`),
    prompt: `Professional Instagram 1080x1350 designed marketing graphic for Prumo Web freelance web studio. Cream background #f3eee6, terracotta accents #d4573e. Unique editorial layout (NOT photo-in-a-box template). Include logo Prumo Web, @prumo.web, Portuguese headline "${plain(brief.title)}", kicker "${brief.kicker}", supporting "${brief.hook}", WhatsApp (11) 96633-1995. Theme: custom single page / TI freela. Sharp typography. Seed ${Date.now()}.`,
  }));

  const attempts: ManagedPost["attempts"] = [];
  const maxRounds = 3;

  for (let round = 0; round < maxRounds; round++) {
    if (avoidConcepts.includes(design.concept)) {
      design = {
        ...design,
        concept: `${design.concept}-r${round}-${Date.now().toString(36)}`.slice(0, 48),
      };
    }

    const art = await generateArt(design.prompt);
    if (!art) {
      attempts.push({ approved: false, reason: "artistas falharam neste round" });
      break;
    }

    const tempId = `agency-${design.concept}-${Date.now().toString(36)}`;
    const item = briefToFeedItem(brief);
    item.id = tempId;
    item.layout = "quote"; // metadado; a peça visual é o PNG completo da IA
    item.photoId = artPhotoId(art);
    item.concept = design.concept;
    item.photoUrl = undefined;

    const published = await publishArtBytes(art, tempId, input.reqOrigin, item);
    await input.saveDraft(published.item.id, published.item, false);

    const verdict = await managerApprove({
      brief,
      provider: art.provider,
      imageUrl: published.imageUrl,
      concept: design.concept,
    });
    attempts.push({ provider: art.provider, approved: verdict.approved, reason: verdict.reason });

    if (verdict.approved) {
      const { __renderedPng: _, ...cleanItem } = published.item as FeedItem & { __renderedPng?: string };
      void _;
      return {
        item: { ...cleanItem, concept: design.concept, photoId: item.photoId },
        caption: buildCaption(cleanItem),
        imageUrl: published.imageUrl,
        artist: art.provider,
        attempts,
      };
    }

    if (verdict.revisePrompt) {
      design = {
        concept: slugify(`rev-${design.concept}-${round}`),
        prompt: `${verdict.revisePrompt}. Completely different composition from previous. Vertical Instagram designed graphic for Prumo Web. Seed ${Date.now()}.`,
      };
    } else {
      design = await inventFullPostDesign(brief, [...avoidConcepts, design.concept]).catch(() => design);
    }
  }

  const fb = await feedcardFallback(brief, input.state, input.reqOrigin);
  await input.saveDraft(fb.item.id, fb.item, false);
  attempts.push({ provider: "feedcard-unsplash", approved: true, reason: "fallback tipográfico após artistas" });
  return {
    item: fb.item,
    caption: buildCaption(fb.item),
    imageUrl: fb.imageUrl,
    artist: "feedcard-unsplash",
    attempts,
  };
}

function buildCaption(item: FeedItem) {
  const lines = [
    item.hook || titleOf(item),
    "Desenvolvimento de single page e site sob medida — TI freela, código próprio, lead no WhatsApp.",
    "Chama no WhatsApp: (11) 96633-1995",
  ];
  if (item.photoCredit) lines.push(item.photoCredit);
  const tags = [
    ...new Set([...(item.tags || []), "prumoweb", "singlepage", "desenvolvimento", "landingpage", "freelance"]),
  ]
    .slice(0, 6)
    .map((t) => `#${t.replace(/[^\p{L}\p{N}_]/gu, "")}`);
  lines.push(tags.join(" "));
  return lines.join("\n\n");
}
