import { put } from "@vercel/blob";
import type { AiBrief } from "./gemini";
import { generateAgencyBrief, briefToFeedItem } from "./gemini";
import { generateArt, type ArtistResult } from "./artists";
import { renderFeedImage } from "./render";
import { findPortraitPhoto, trackUnsplashDownload } from "./unsplash";
import type { FeedItem, IgState } from "./types";
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

async function geminiText(prompt: string): Promise<string> {
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
        generationConfig: { temperature: 0.4, maxOutputTokens: 400 },
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

export async function buildImagePrompt(brief: AiBrief): Promise<string> {
  const text = await geminiText(`Você é diretor de arte da Prumo Web.
Crie UM prompt em inglês para gerar a arte de um post de Instagram 1080x1350 (retrato).
Marca: sites/sistemas sob medida, visual premium, cinematográfico, pouco texto.
NÃO peça tipografia/letras/logos/watermark na imagem.
NÃO cite prazo numérico.
Ângulo: ${brief.angle} | pilar: ${brief.pillar} | kicker: ${brief.kicker}
Título da peça: ${plain(brief.title)}
Hook: ${brief.hook}
photoQuery base: ${brief.photoQuery}
Responda SOMENTE JSON: {"prompt":"...","negative":"..."}`);
  const json = extractJsonObject(text);
  const prompt = String(json.prompt || "");
  const negative = String(json.negative || "text, watermark, logo, low quality, blurry");
  if (!prompt) throw new Error("prompt de imagem vazio");
  return `${prompt}. Avoid: ${negative}. Vertical 4:5 Instagram feed, high-end commercial photography.`;
}

export async function managerApprove(input: {
  brief: AiBrief;
  provider: string;
  imageUrl: string;
}): Promise<{ approved: boolean; reason: string; revisePrompt?: string }> {
  try {
    const text = await geminiText(`Você é gerente de marketing da Prumo Web. Avalie se a arte está pronta para publicar.
Critérios: engajamento visual, premium, sem texto ilegível/genérico, alinhada ao diferencial (sob medida / presença / WhatsApp), NÃO parecer anúncio de prazo.
Brief: ${JSON.stringify({ title: briefTitle(input.brief), hook: input.brief.hook, angle: input.brief.angle })}
Provider: ${input.provider}
Image URL (inspecione mentalmente pelo contexto; se URL pública, assuma que precisa parecer editorial): ${input.imageUrl}
Responda SOMENTE JSON:
{"approved":true|false,"reason":"frase curta","revisePrompt":"novo prompt em inglês se reprovar, senão vazio"}`);
    const json = extractJsonObject(text);
    return {
      approved: Boolean(json.approved),
      reason: String(json.reason || ""),
      revisePrompt: json.revisePrompt ? String(json.revisePrompt) : undefined,
    };
  } catch (err) {
    // Se o gerente falhar, aprova com ressalva para não travar o cron
    return { approved: true, reason: `gerente indisponível, segue com arte (${err instanceof Error ? err.message : "erro"})` };
  }
}

function briefTitle(b: AiBrief) {
  return plain(b.title);
}

async function uploadArtistBytes(art: ArtistResult, id: string): Promise<string | null> {
  try {
    const ext = art.contentType.includes("png") ? "png" : "jpg";
    const blob = await put(`ig-auto/artist-${id}-${Date.now()}.${ext}`, art.bytes, {
      access: "public",
      contentType: art.contentType,
      addRandomSuffix: true,
    });
    return blob.url;
  } catch (err) {
    console.error("[manager] blob artist failed", err);
    return null;
  }
}

async function feedcardFallback(brief: AiBrief, state: IgState, reqOrigin: string): Promise<{ item: FeedItem; imageUrl: string }> {
  let item = briefToFeedItem(brief);
  if (item.layout === "hero" || item.layout === "split") {
    const photo = await findPortraitPhoto(brief.photoQuery || "premium business workspace");
    if (photo) {
      await trackUnsplashDownload(photo.downloadLocation);
      item = { ...item, photoUrl: photo.url, photoCredit: `Foto: ${photo.photographer} / Unsplash`, photoId: photo.id };
    }
  }
  const png = await renderFeedImage(item, false);
  try {
    const blob = await put(`ig-auto/${item.id}-${Date.now()}.png`, png, {
      access: "public",
      contentType: "image/png",
      addRandomSuffix: true,
    });
    return { item, imageUrl: blob.url };
  } catch {
    return { item, imageUrl: `${reqOrigin}/api/og/agency?id=${encodeURIComponent(item.id)}&t=${Date.now()}` };
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
  const brief = await generateAgencyBrief({
    avoidTitles,
    avoidLayouts,
    recentCaptions: input.captions,
  });

  let imagePrompt = await buildImagePrompt(brief).catch(
    () =>
      `Premium Instagram vertical photo for Brazilian tech agency Prumo Web. Theme: ${brief.photoQuery}. Cinematic, editorial, no text, no watermark.`,
  );

  const attempts: ManagedPost["attempts"] = [];
  const maxRounds = 2;

  for (let round = 0; round < maxRounds; round++) {
    const art = await generateArt(imagePrompt);
    if (!art) {
      attempts.push({ approved: false, reason: "todos os artistas falharam neste round" });
      break;
    }
    const tempId = `agency-${brief.angle}-${Date.now().toString(36)}`;
    const imageUrl = (await uploadArtistBytes(art, tempId)) || art.publicUrl;
    if (!imageUrl) {
      attempts.push({ provider: art.provider, approved: false, reason: "falha ao subir blob e sem URL pública" });
      continue;
    }

    const verdict = await managerApprove({ brief, provider: art.provider, imageUrl });
    attempts.push({ provider: art.provider, approved: verdict.approved, reason: verdict.reason });

    if (verdict.approved) {
      const item = briefToFeedItem(brief, imageUrl, undefined, undefined);
      item.id = tempId;
      item.photoUrl = imageUrl;
      await input.saveDraft(item.id, item, false);
      return {
        item,
        caption: buildCaption(item),
        imageUrl,
        artist: art.provider,
        attempts,
      };
    }

    if (verdict.revisePrompt) imagePrompt = verdict.revisePrompt;
  }

  // Fallback final: FeedCard + Unsplash, ainda com brief do gerente
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
  const lines = [item.hook || titleOf(item), "WhatsApp (11) 96633-1995"];
  if (item.photoCredit) lines.push(item.photoCredit);
  const tags = [...new Set([...(item.tags || []), "prumoweb", "empresas"])]
    .slice(0, 5)
    .map((t) => `#${t.replace(/[^\p{L}\p{N}_]/gu, "")}`);
  lines.push(tags.join(" "));
  return lines.join("\n\n");
}
