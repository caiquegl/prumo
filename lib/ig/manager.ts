import { put } from "@vercel/blob";
import type { AiBrief } from "./gemini";
import { generateAgencyBrief, briefToFeedItem } from "./gemini";
import { generateArt, type ArtistResult } from "./artists";
import { renderFeedImage } from "./render";
import type { FeedItem, IgState, Layout } from "./types";
import { DESIGNED_LAYOUTS } from "./types";
import { plain, titleOf } from "./content";

export type ManagedPost = {
  item: FeedItem;
  caption: string;
  imageUrl: string;
  artist?: ArtistResult["provider"] | "feedcard" | "feedcard+landing";
  attempts: Array<{ provider?: string; approved: boolean; reason: string }>;
};

const MODELS = [
  process.env.GEMINI_MODEL,
  "gemini-flash-lite-latest",
  "gemini-3.5-flash-lite",
  "gemini-3.8-flash",
].filter(Boolean) as string[];

async function geminiText(prompt: string, maxTokens = 500): Promise<string> {
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
        generationConfig: { temperature: 0.4, maxOutputTokens: maxTokens },
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
      .slice(0, 48) || "conceito"
  );
}

async function managerApprove(input: {
  brief: AiBrief;
  imageUrl: string;
  layout: string;
}): Promise<{ approved: boolean; reason: string }> {
  try {
    const text = await geminiText(
      `Você é gerente comercial da Prumo Web (single page / site sob medida / TI freela).
Avalie a peça DESENHADA (infográfico/editorial com tipografia).
Aprovar se: oferta clara, layout ${input.layout} coerente, CTA WhatsApp, NÃO arte abstrata sem sentido, NÃO sala de reunião.
Brief: ${JSON.stringify({ title: plain(input.brief.title), hook: input.brief.hook, kicker: input.brief.kicker })}
URL: ${input.imageUrl}
JSON: {"approved":true|false,"reason":"frase"}`,
      300,
    );
    const json = extractJsonObject(text);
    return { approved: Boolean(json.approved), reason: String(json.reason || "") };
  } catch (err) {
    return { approved: true, reason: `gerente indisponível (${err instanceof Error ? err.message : "erro"})` };
  }
}

async function publishPng(
  png: Buffer,
  id: string,
  item: FeedItem,
  reqOrigin: string,
): Promise<{ item: FeedItem; imageUrl: string }> {
  try {
    const blob = await put(`ig-auto/designed-${id}-${Date.now()}.png`, png, {
      access: "public",
      contentType: "image/png",
      addRandomSuffix: true,
    });
    return { item, imageUrl: blob.url };
  } catch (err) {
    console.error("[manager] blob designed failed", err);
    return {
      item: { ...item, __renderedPng: png.toString("base64") } as FeedItem & { __renderedPng: string },
      imageUrl: `${reqOrigin}/api/og/rendered?id=${encodeURIComponent(id)}&t=${Date.now()}`,
    };
  }
}

/** Só usa gerador grátis se o layout pedir mockup de LANDING PAGE real (não abstrato). */
async function maybeLandingPhoto(brief: AiBrief): Promise<{ url: string; photoId: string } | null> {
  if (brief.layout !== "hero" && brief.layout !== "offer") return null;
  const prompt = `Photorealistic vertical photo of a modern laptop on a desk showing a clean single-page landing website UI in the browser, hero section with big headline area and orange CTA button shape (no readable text), warm cream room, terracotta accents, Brazilian freelance web studio, high detail, no logos, no watermarks, no abstract sculpture, no clay, no funnel toys. Seed ${Date.now()}.`;
  const art = await generateArt(prompt);
  if (!art) return null;
  try {
    const blob = await put(`ig-auto/landing-${Date.now()}.jpg`, art.bytes, {
      access: "public",
      contentType: art.contentType,
      addRandomSuffix: true,
    });
    return {
      url: blob.url,
      photoId: `art-${art.provider}-${art.bytes.byteLength}`,
    };
  } catch {
    return {
      url: `data:${art.contentType};base64,${art.bytes.toString("base64")}`,
      photoId: `art-${art.provider}-${art.bytes.byteLength}`,
    };
  }
}

export async function produceManagedPost(input: {
  state: IgState;
  captions: string[];
  reqOrigin: string;
  saveDraft: (id: string, payload: unknown, dark?: boolean) => Promise<void>;
}): Promise<ManagedPost> {
  const avoidLayouts = input.state.published.slice(-4).map((p) => p.layout);
  const avoidTitles = input.state.published.map((p) => p.title.toLowerCase());
  const avoidAngles = input.state.published
    .slice(-8)
    .flatMap((p) => [p.item?.angle, p.item?.concept, p.id.replace(/^agency-/, "").replace(/-[a-z0-9]+$/i, "")])
    .filter(Boolean) as string[];

  const brief = await generateAgencyBrief({
    avoidTitles,
    avoidLayouts,
    recentCaptions: input.captions,
    avoidAngles,
  });

  // Garante peça desenhada (estilo anatomia/perf/hub), nunca moldura offer+abstrato
  if (!DESIGNED_LAYOUTS.includes(brief.layout as Layout)) {
    const pick = DESIGNED_LAYOUTS.find((l) => !avoidLayouts.includes(l)) || "anatomy";
    brief.layout = pick;
  }

  const attempts: ManagedPost["attempts"] = [];
  let photoUrl: string | undefined;
  let photoId: string | undefined;
  let artist: ManagedPost["artist"] = "feedcard";

  // Split pode opcionalmente ganhar mock visual via PhoneMock no FeedCard (sem IA).
  // Hero raro: só landing page real via gerador grátis.
  if (brief.layout === "hero") {
    const landing = await maybeLandingPhoto(brief);
    if (landing) {
      photoUrl = landing.url;
      photoId = landing.photoId;
      artist = "feedcard+landing";
    } else {
      brief.layout = DESIGNED_LAYOUTS.find((l) => !avoidLayouts.includes(l)) || "anatomy";
    }
  }

  const id = `agency-${slugify(brief.concept || brief.angle)}-${Date.now().toString(36)}`;
  const item = briefToFeedItem(brief, photoUrl, undefined, photoId);
  item.id = id;
  item.concept = brief.concept || slugify(`${brief.layout}-${brief.angle}`);

  const png = await renderFeedImage(item, false);
  if (png.byteLength < 15_000) throw new Error("PNG desenhado inválido");

  const published = await publishPng(png, id, item, input.reqOrigin);
  await input.saveDraft(published.item.id, published.item, false);

  const verdict = await managerApprove({ brief, imageUrl: published.imageUrl, layout: item.layout });
  attempts.push({ provider: artist, approved: verdict.approved, reason: verdict.reason });

  // Se reprovar, tenta outro layout desenhado sem arte abstrata
  if (!verdict.approved) {
    const altLayout = DESIGNED_LAYOUTS.find((l) => l !== item.layout && !avoidLayouts.includes(l)) || "quote";
    const altBrief = { ...brief, layout: altLayout, concept: slugify(`alt-${brief.angle}-${altLayout}`) };
    const altItem = briefToFeedItem(altBrief);
    altItem.id = `agency-${altBrief.concept}-${Date.now().toString(36)}`;
    const altPng = await renderFeedImage(altItem, false);
    const altPub = await publishPng(altPng, altItem.id, altItem, input.reqOrigin);
    await input.saveDraft(altPub.item.id, altPub.item, false);
    attempts.push({ provider: "feedcard", approved: true, reason: `fallback layout ${altLayout}` });
    const { __renderedPng: _, ...clean } = altPub.item as FeedItem & { __renderedPng?: string };
    void _;
    return {
      item: clean,
      caption: buildCaption(clean),
      imageUrl: altPub.imageUrl,
      artist: "feedcard",
      attempts,
    };
  }

  const { __renderedPng: _, ...cleanItem } = published.item as FeedItem & { __renderedPng?: string };
  void _;
  return {
    item: cleanItem,
    caption: buildCaption(cleanItem),
    imageUrl: published.imageUrl,
    artist,
    attempts,
  };
}

function buildCaption(item: FeedItem) {
  const lines = [
    item.hook || titleOf(item),
    "Desenvolvimento de single page e site sob medida — TI freela, código próprio, lead no WhatsApp.",
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
