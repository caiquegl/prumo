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
  const text = await geminiText(`Você é diretor de arte da Prumo Web (freela de TI: single pages e sites sob medida).
Crie UM prompt em inglês para o FUNDO fotográfico de um post Instagram 1080x1350.
A tipografia/marca/CTA entram depois — a foto é só cenário de DESENVOLVIMENTO WEB / produto digital.
Cenas OK: laptop showing a clean landing page UI, developer desk with monitor and soft code, smartphone next to a single-page mockup, browser window with modern website, small business owner reviewing a site on laptop.
Cenas PROIBIDAS: empty luxury boardroom, conference table with chairs only, abstract leaves, generic skyscraper, stock "handshake CEO".
Visual: warm/editorial, premium but tech — not corporate boardroom.
Deixe a TERCEIRA INFERIOR mais limpa/escura para título e WhatsApp.
NÃO peça tipografia/letras/logos/watermark/botões na imagem.
Ângulo: ${brief.angle} | pilar: ${brief.pillar} | kicker: ${brief.kicker}
Título: ${plain(brief.title)}
Hook: ${brief.hook}
photoQuery base: ${brief.photoQuery}
Responda SOMENTE JSON: {"prompt":"...","negative":"..."}`);
  const json = extractJsonObject(text);
  const prompt = String(json.prompt || "");
  const negative = String(
    json.negative ||
      "text, watermark, logo, boardroom, conference table, empty meeting room, leaves abstract, low quality, blurry, busy bottom third",
  );
  if (!prompt) throw new Error("prompt de imagem vazio");
  return `${prompt}. Avoid: ${negative}. Vertical 4:5 Instagram feed background, web/tech product photography, space at bottom for typography.`;
}

export async function managerApprove(input: {
  brief: AiBrief;
  provider: string;
  imageUrl: string;
}): Promise<{ approved: boolean; reason: string; revisePrompt?: string }> {
  try {
    const text = await geminiText(`Você é gerente de marketing da Prumo Web (TI freela: single page, landing, site sob medida).
Avalie se o POST DE VENDA está pronto e coerente com a oferta.
Critérios obrigatórios:
- layout de marketing (marca + título + CTA WhatsApp)
- copy falando de site / single page / desenvolvimento / lead no Zap (não "operação corporativa" genérica)
- fundo com cara de web/TI (laptop, UI, código suave, mockup) — REPROVE sala de reunião vazia / boardroom
- NÃO foto solta sem texto, NÃO prazo numérico
Brief: ${JSON.stringify({ title: briefTitle(input.brief), hook: input.brief.hook, angle: input.brief.angle, kicker: input.brief.kicker, pillar: input.brief.pillar })}
Provider fundo: ${input.provider}
Peça composta: ${input.imageUrl}
Responda SOMENTE JSON:
{"approved":true|false,"reason":"frase curta","revisePrompt":"novo prompt de FUNDO em inglês focado em web/dev se reprovar a foto, senão vazio"}`);
    const json = extractJsonObject(text);
    return {
      approved: Boolean(json.approved),
      reason: String(json.reason || ""),
      revisePrompt: json.revisePrompt ? String(json.revisePrompt) : undefined,
    };
  } catch (err) {
    // Se o gerente falhar, aprova com ressalva para não travar o cron
    return { approved: true, reason: `gerente indisponível, segue com peça (${err instanceof Error ? err.message : "erro"})` };
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

/** Layouts com foto de fundo + tipografia/CTA de venda — nunca repete o layout do post anterior */
function marketingLayout(layout: FeedItem["layout"], avoid: string[]): FeedItem["layout"] {
  const want = layout === "hero" || layout === "split" ? layout : "hero";
  if (!avoid.slice(-1).includes(want)) return want;
  return want === "hero" ? "split" : "hero";
}

function artDataUrl(art: ArtistResult): string {
  return `data:${art.contentType};base64,${art.bytes.toString("base64")}`;
}

function artPhotoId(art: ArtistResult): string {
  // fingerprint curto para bloquear reuso da mesma arte
  const head = art.bytes.subarray(0, 24).toString("hex");
  return `art-${art.provider}-${art.bytes.byteLength}-${head}`;
}

function recentPhotoIds(state: IgState): Set<string> {
  const ids = new Set<string>();
  for (const p of state.published) {
    const fromItem = (p as { item?: FeedItem }).item?.photoId;
    if (fromItem) ids.add(fromItem);
    if (p.id.startsWith("art-")) ids.add(p.id);
  }
  return ids;
}

async function composeMarketingCard(
  brief: AiBrief,
  photoUrl: string,
  opts: { id: string; photoCredit?: string; photoId?: string; reqOrigin: string; layout: FeedItem["layout"] },
): Promise<{ item: FeedItem; imageUrl: string }> {
  let item = briefToFeedItem({ ...brief, layout: opts.layout }, photoUrl, opts.photoCredit, opts.photoId);
  item.id = opts.id;
  item.photoUrl = photoUrl;
  item.photoId = opts.photoId;
  item.visual = item.visual || "mark";

  // renderFeedImage resolve a foto em data URL; se falhar, cai no visual (sem retângulo branco)
  const png = await renderFeedImage(item, false);
  if (png.byteLength < 20_000) {
    throw new Error("PNG composto suspeito (muito pequeno)");
  }
  try {
    const blob = await put(`ig-auto/mkt-${item.id}-${Date.now()}.png`, png, {
      access: "public",
      contentType: "image/png",
      addRandomSuffix: true,
    });
    return { item: { ...item, photoUrl }, imageUrl: blob.url };
  } catch (err) {
    console.error("[manager] blob mkt failed, serving rendered PNG from draft", err);
    // Fallback estável: PNG já renderizado no Neon (não re-renderiza no OG — evita meio branco)
    return {
      item: { ...item, photoUrl, __renderedPng: png.toString("base64") } as FeedItem & { __renderedPng: string },
      imageUrl: `${opts.reqOrigin}/api/og/rendered?id=${encodeURIComponent(item.id)}&t=${Date.now()}`,
    };
  }
}

async function feedcardFallback(brief: AiBrief, state: IgState, reqOrigin: string, layout: FeedItem["layout"]): Promise<{ item: FeedItem; imageUrl: string }> {
  const id = `agency-${brief.angle}-${Date.now().toString(36)}`;
  const exclude = [...recentPhotoIds(state)];
  const photo = await findPortraitPhoto(
    brief.photoQuery || "laptop modern website landing page desk warm light",
    exclude,
  ).catch(() => null);
  if (photo) {
    await trackUnsplashDownload(photo.downloadLocation);
    return composeMarketingCard(brief, photo.url, {
      id,
      photoCredit: `Foto: ${photo.photographer} / Unsplash`,
      photoId: photo.id,
      reqOrigin,
      layout,
    });
  }

  // Sem foto: layouts tipográficos (quote/cards/compare) — NUNCA hero/split com leaves
  const textLayouts: FeedItem["layout"][] = ["quote", "cards", "compare"];
  const last = state.published.at(-1)?.layout;
  const textLayout = textLayouts.find((l) => l !== last) || "quote";
  const visuals = ["mark", "wire", "chart", "cloud"] as const;
  const visual = visuals[state.published.length % visuals.length];
  const item = briefToFeedItem({ ...brief, layout: textLayout });
  item.id = id;
  item.visual = visual;
  item.photoUrl = undefined;
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
  const seenPhotos = recentPhotoIds(input.state);
  const brief = await generateAgencyBrief({
    avoidTitles,
    avoidLayouts,
    recentCaptions: input.captions,
  });
  const layout = marketingLayout(brief.layout, avoidLayouts);
  brief.layout = layout;

  let imagePrompt = await buildImagePrompt(brief).catch(
    () =>
      `Cinematic vertical photo of a laptop on a desk showing a modern single-page website UI, soft warm light, Brazilian freelance web developer workspace, shallow depth of field, dark clean lower third for typography, no text no watermark. Theme: ${brief.photoQuery}. Seed ${Date.now()}.`,
  );

  const attempts: ManagedPost["attempts"] = [];
  const maxRounds = 2;

  for (let round = 0; round < maxRounds; round++) {
    const art = await generateArt(imagePrompt);
    if (!art) {
      attempts.push({ approved: false, reason: "todos os artistas falharam neste round" });
      break;
    }
    const photoId = artPhotoId(art);
    if (seenPhotos.has(photoId)) {
      attempts.push({ provider: art.provider, approved: false, reason: "arte repetida (fingerprint)" });
      continue;
    }
    const tempId = `agency-${brief.angle}-${Date.now().toString(36)}`;
    // Blob público da arte (preferível) ou data URL — render embute bytes antes do Satori
    const photoUrl = (await uploadArtistBytes(art, tempId)) || artDataUrl(art);

    let composed: { item: FeedItem; imageUrl: string };
    try {
      composed = await composeMarketingCard(brief, photoUrl, {
        id: tempId,
        photoId,
        reqOrigin: input.reqOrigin,
        layout,
      });
    } catch (err) {
      attempts.push({
        provider: art.provider,
        approved: false,
        reason: `compose falhou: ${err instanceof Error ? err.message : "erro"}`,
      });
      continue;
    }
    // draft precisa do __renderedPng quando o imageUrl aponta para /api/og/rendered
    await input.saveDraft(composed.item.id, composed.item, false);

    const verdict = await managerApprove({ brief, provider: art.provider, imageUrl: composed.imageUrl });
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

    if (verdict.revisePrompt) imagePrompt = `${verdict.revisePrompt}. Completely different scene from previous attempt.`;
  }

  const fb = await feedcardFallback(brief, input.state, input.reqOrigin, layout);
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
