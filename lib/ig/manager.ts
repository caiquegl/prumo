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
        generationConfig: { temperature: 0.9, maxOutputTokens: maxTokens },
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

/**
 * Inventa só o VISUAL do miolo — tipografia/marca/WhatsApp entram depois no FeedCard (sem erro de @).
 * Foco: deixar a oferta de serviço óbvia (single page / TI freela).
 */
async function inventServiceVisual(
  brief: AiBrief,
  avoidConcepts: string[],
): Promise<{ concept: string; prompt: string }> {
  const text = await geminiText(
    `You are art director for Prumo Web — Brazilian freelance IT that sells custom single pages / landings and sites (own code, lead to WhatsApp).

Invent ONE unique ILLUSTRATION for the CENTER of an Instagram sales post (typography will be overlaid later in code).

HARD RULES:
- ZERO text, letters, numbers, logos, watermarks, @handles, brand names, phone numbers, UI labels with readable words.
- Pure visual storytelling that makes the SERVICE obvious (custom single page / web freela / WhatsApp lead) without writing words.
- Invent a BRAND-NEW composition structure every time — change camera angle, object set, metaphor, and spatial layout. Forbidden concepts: ${avoidConcepts.join(", ") || "none"}.
- Never reuse: same laptop desk shot, same empty frame, same leaves, same boardroom.
- Cream/terracotta/charcoal (#f3eee6, #d4573e, #1a1916). Clean margins top/bottom for overlay text.
- Prefer illustrated/editorial/design look over stock photo.

Service angle to express visually:
- kicker: ${brief.kicker}
- offer title (for your inspiration only, DO NOT paint these words): ${plain(brief.title)}
- client pain / hook: ${brief.hook}
- pillar: ${brief.pillar}

Respond ONLY JSON:
{"concept":"unique-english-slug","prompt":"detailed English prompt for image model, explicitly forbidding any text/letters/logos"}`,
    1000,
  );
  const json = extractJsonObject(text);
  const concept = slugify(String(json.concept || `v-${Date.now().toString(36)}`));
  const prompt = String(json.prompt || "");
  if (!prompt) throw new Error("prompt visual vazio");
  return {
    concept,
    prompt: `${prompt}. Absolutely no text, no letters, no words, no logos, no watermarks, no @handles, no phone numbers. Vertical 4:5 illustration for Instagram marketing center panel, cream and terracotta, clean top and bottom margins. Seed ${Date.now()}.`,
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
      `Você é gerente comercial da Prumo Web (vende single page / site sob medida / TI freela).
Avalie a PEÇA DE VENDA final.
Aprovar só se:
1) Oferta clara para o cliente (site/single page/desenvolvimento) — dá vontade de chamar no Zap
2) Marca e WhatsApp legíveis (tipografia real, não borrada)
3) Visual do miolo único para o conceito "${input.concept}" (não sala de reunião genérica)
4) NÃO parece só foto solta sem proposta
Brief: ${JSON.stringify({ title: plain(input.brief.title), hook: input.brief.hook, kicker: input.brief.kicker, headline: input.brief.headline })}
Provider arte: ${input.provider}
URL: ${input.imageUrl}
JSON:
{"approved":true|false,"reason":"frase","revisePrompt":"novo prompt inglês SÓ DO VISUAL (sem texto) se reprovar a arte, senão vazio"}`,
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

function artDataUrl(art: ArtistResult): string {
  return `data:${art.contentType};base64,${art.bytes.toString("base64")}`;
}

function artPhotoId(art: ArtistResult): string {
  const head = art.bytes.subarray(0, 24).toString("hex");
  return `art-${art.provider}-${art.bytes.byteLength}-${head}`;
}

async function uploadArtistBytes(art: ArtistResult, id: string): Promise<string | null> {
  try {
    const ext = art.contentType.includes("png") ? "png" : "jpg";
    const blob = await put(`ig-auto/visual-${id}-${Date.now()}.${ext}`, art.bytes, {
      access: "public",
      contentType: art.contentType,
      addRandomSuffix: true,
    });
    return blob.url;
  } catch (err) {
    console.error("[manager] blob visual failed", err);
    return null;
  }
}

async function composeOfferCard(
  brief: AiBrief,
  photoUrl: string,
  opts: { id: string; photoId?: string; concept: string; reqOrigin: string },
): Promise<{ item: FeedItem; imageUrl: string }> {
  const item = briefToFeedItem({ ...brief, layout: "offer" }, photoUrl, undefined, opts.photoId);
  item.id = opts.id;
  item.layout = "offer";
  item.photoUrl = photoUrl;
  item.photoId = opts.photoId;
  item.concept = opts.concept;
  item.sub = brief.hook;
  item.headline = brief.headline || "Seu próximo projeto pode começar aqui.";
  item.visual = undefined;

  const png = await renderFeedImage(item, false);
  if (png.byteLength < 20_000) throw new Error("PNG oferta muito pequeno");

  try {
    const blob = await put(`ig-auto/offer-${item.id}-${Date.now()}.png`, png, {
      access: "public",
      contentType: "image/png",
      addRandomSuffix: true,
    });
    return { item: { ...item, photoUrl }, imageUrl: blob.url };
  } catch (err) {
    console.error("[manager] blob offer failed", err);
    return {
      item: { ...item, photoUrl, __renderedPng: png.toString("base64") } as FeedItem & { __renderedPng: string },
      imageUrl: `${opts.reqOrigin}/api/og/rendered?id=${encodeURIComponent(item.id)}&t=${Date.now()}`,
    };
  }
}

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

  let design = await inventServiceVisual(brief, avoidConcepts).catch(() => ({
    concept: slugify(`svc-${brief.angle}-${Date.now().toString(36)}`),
    prompt: `Editorial illustration of a modern single-page website mockup on a laptop, terracotta and cream palette, abstract WhatsApp chat bubble shapes without any letters, clean conversion funnel shapes, no text no logos no watermarks, vertical Instagram center panel, soft studio light. Seed ${Date.now()}.`,
  }));

  const attempts: ManagedPost["attempts"] = [];
  const maxRounds = 3;

  for (let round = 0; round < maxRounds; round++) {
    const art = await generateArt(design.prompt);
    if (!art) {
      attempts.push({ approved: false, reason: "artistas falharam neste round" });
      break;
    }

    const tempId = `agency-${design.concept}-${Date.now().toString(36)}`;
    const photoUrl = (await uploadArtistBytes(art, tempId)) || artDataUrl(art);

    let composed: { item: FeedItem; imageUrl: string };
    try {
      composed = await composeOfferCard(brief, photoUrl, {
        id: tempId,
        photoId: artPhotoId(art),
        concept: design.concept,
        reqOrigin: input.reqOrigin,
      });
    } catch (err) {
      attempts.push({
        provider: art.provider,
        approved: false,
        reason: `compose offer: ${err instanceof Error ? err.message : "erro"}`,
      });
      continue;
    }

    await input.saveDraft(composed.item.id, composed.item, false);

    const verdict = await managerApprove({
      brief,
      provider: art.provider,
      imageUrl: composed.imageUrl,
      concept: design.concept,
    });
    attempts.push({ provider: art.provider, approved: verdict.approved, reason: verdict.reason });

    if (verdict.approved) {
      const { __renderedPng: _, ...cleanItem } = composed.item as FeedItem & { __renderedPng?: string };
      void _;
      return {
        item: cleanItem,
        caption: buildCaption(cleanItem),
        imageUrl: composed.imageUrl,
        artist: art.provider,
        attempts,
      };
    }

    if (verdict.revisePrompt) {
      design = {
        concept: slugify(`rev-${design.concept}-${round}`),
        prompt: `${verdict.revisePrompt}. No text, no letters, no logos, no watermarks. Seed ${Date.now()}.`,
      };
    } else {
      design = await inventServiceVisual(brief, [...avoidConcepts, design.concept]).catch(() => design);
    }
  }

  const fb = await feedcardFallback(brief, input.state, input.reqOrigin);
  await input.saveDraft(fb.item.id, fb.item, false);
  attempts.push({ provider: "feedcard-unsplash", approved: true, reason: "fallback tipográfico" });
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
    "Orçamento no WhatsApp: (11) 96633-1995",
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
