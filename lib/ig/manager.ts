import { put } from "@vercel/blob";
import { generateArt, type ArtistResult } from "./artists";
import { renderTypedPost } from "./compose";
import type { TextZone } from "./TypeOverlay";
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

const ZONES: TextZone[] = ["bottomBand", "topStack", "leftRail", "centerQuote"];

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

function parseZone(raw: unknown, avoid?: string): TextZone {
  const z = String(raw || "bottomBand") as TextZone;
  if (ZONES.includes(z) && z !== avoid) return z;
  return ZONES.find((x) => x !== avoid) || "bottomBand";
}

type AgencyBrief = {
  concept: string;
  angle: string;
  pillar: string;
  kicker: string;
  title: string;
  hook: string;
  headline: string;
  tags: string[];
  /** Copy na arte — ortografia garantida pelo tipógrafo */
  onImage: { headline: string; sub?: string };
  textZone: TextZone;
  lightText: boolean;
  /** Prompt visual SEM texto/logo/telefone */
  visualPrompt: string;
};

/**
 * Estrategista + diretor de arte: brief de venda + prompt visual limpo + zona tipográfica.
 */
async function inventAgencyBrief(input: {
  avoidConcepts: string[];
  avoidTitles: string[];
  recentCaptions: string[];
  avoidZone?: string;
}): Promise<AgencyBrief> {
  const text = await geminiText(
    `You are the strategist + art director of Prumo Web (Brazilian freelance TI: custom single pages / landings, WhatsApp leads).

Build ONE Instagram post brief for a marketing agency pipeline:
1) Artist generates a CLEAN visual (no letters) — portfolio mockup of a landing page on device.
2) Typesetter overlays PERFECT Portuguese typography in a flexible zone (not a fixed card template).
3) Caption carries brand + WhatsApp (never painted on the image).

PLAYBOOK:
- Visual = product shot of website/LP UI (laptop/monitor/browser/phone). Cinematic, unique camera each time.
- visualPrompt: English, NO readable text anywhere (including on the website mockup screen — use abstract UI bars/blocks only, blurred fake copy), NO logos, NO @handles, NO phone numbers, NO watermarks, leave clean space for typography in the chosen zone.
- onImage.headline: Portuguese, max 8 words, perfect spelling, sells the service (single page / site sob medida).
- onImage.sub: optional 1 short supporting line in Portuguese.
- textZone one of: bottomBand | topStack | leftRail | centerQuote (pick what fits the scene; avoid ${input.avoidZone || "none"}).
- lightText: true if band is dark over photo; false if band is cream.
- NEVER put Prumo logo, @prumo.web or phone in visualPrompt or onImage (caption only).

Forbidden concepts: ${input.avoidConcepts.join(", ") || "none"}
Avoid titles: ${input.avoidTitles.slice(0, 10).join(" | ") || "none"}
Recent captions: ${input.recentCaptions.slice(0, 5).join(" || ").slice(0, 700) || "none"}

Respond ONLY JSON:
{
  "concept": "unique-english-slug",
  "angle": "short-slug",
  "pillar": "single-page|landing|codigo-proprio|performance|funil-whatsapp|ti-freela",
  "kicker": "label",
  "title": "db title",
  "hook": "caption hook",
  "headline": "caption CTA",
  "tags": ["singlepage","desenvolvimento"],
  "onImage": {"headline":"Site sob medida converte","sub":"Single page com lead no Zap"},
  "textZone": "bottomBand",
  "lightText": true,
  "visualPrompt": "detailed English prompt for clean landing-page mockup photo, no text..."
}`,
    1400,
  );

  const json = extractJsonObject(text);
  const onRaw = (json.onImage || {}) as Record<string, unknown>;
  const onHeadline = String(onRaw.headline || json.title || "Single page sob medida").trim();
  const onSub = onRaw.sub ? String(onRaw.sub).trim() : undefined;
  const visualPrompt = String(json.visualPrompt || "");
  if (!visualPrompt) throw new Error("visualPrompt vazio");

  const concept = slugify(String(json.concept || `post-${Date.now().toString(36)}`));
  return {
    concept,
    angle: slugify(String(json.angle || concept)),
    pillar: String(json.pillar || "single-page"),
    kicker: String(json.kicker || "SINGLE PAGE"),
    title: String(json.title || onHeadline),
    hook: String(json.hook || onHeadline),
    headline: String(json.headline || "Chama no WhatsApp."),
    tags: Array.isArray(json.tags) ? (json.tags as string[]).map(String) : ["singlepage", "desenvolvimento"],
    onImage: { headline: onHeadline, sub: onSub },
    textZone: parseZone(json.textZone, input.avoidZone),
    lightText: json.lightText !== false,
    visualPrompt: `${visualPrompt}. Vertical Instagram 1080x1350 portfolio photo of a custom landing page / single-page website on a device. Absolutely NO readable text or letters anywhere — not on the screen UI either (only abstract placeholder bars/shapes). NO logos, watermarks, phone numbers or brand marks. Leave clean area for typography overlay (${String(json.textZone || "bottomBand")}). Cinematic lighting. Seed ${Date.now()}.`,
  };
}

async function managerApprove(input: {
  brief: AgencyBrief;
  provider: string;
  imageUrl: string;
}): Promise<{ approved: boolean; reason: string; revisePrompt?: string }> {
  try {
    const text = await geminiText(
      `Você é gerente de uma agência de marketing (Prumo Web).
Avalie a PEÇA FINAL (mockup IA + tipografia real sobreposta).
APROVAR se:
1) Visual parece portfolio de landing/site (device/UI), não abstrato/sticker
2) Tipografia na arte está legível e faz sentido comercial (headline de venda)
3) NÃO há logo Prumo, @ nem telefone pintados pela IA na cena
4) Composição premium, distinta de card-template genérico
REPROVAR: texto torto da IA, selo WhatsApp, clay abstrato, tipografia sem oferta
Brief onImage: ${JSON.stringify(input.brief.onImage)}
Zona: ${input.brief.textZone}
Conceito: ${input.brief.concept}
Provider: ${input.provider}
URL: ${input.imageUrl}
JSON: {"approved":true|false,"reason":"frase","revisePrompt":"novo visualPrompt inglês SEM texto se reprovar a arte de fundo"}`,
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

function artDataUrl(art: ArtistResult): string {
  return `data:${art.contentType};base64,${art.bytes.toString("base64")}`;
}

async function publishPng(
  png: Buffer,
  id: string,
  item: FeedItem,
  reqOrigin: string,
): Promise<{ item: FeedItem; imageUrl: string }> {
  try {
    const blob = await put(`ig-auto/agency-${id}-${Date.now()}.png`, png, {
      access: "public",
      contentType: "image/png",
      addRandomSuffix: true,
    });
    return { item, imageUrl: blob.url };
  } catch (err) {
    console.error("[manager] blob agency failed", err);
    return {
      item: { ...item, __renderedPng: png.toString("base64") } as FeedItem & { __renderedPng: string },
      imageUrl: `${reqOrigin}/api/og/rendered?id=${encodeURIComponent(id)}&t=${Date.now()}`,
    };
  }
}

function briefToItem(brief: AgencyBrief, id: string, photoId?: string): FeedItem {
  return {
    id,
    layout: "quote",
    kicker: brief.kicker,
    title: brief.title,
    sub: brief.onImage.sub,
    headline: brief.headline,
    hook: brief.hook,
    tags: brief.tags,
    pillar: brief.pillar,
    angle: brief.angle,
    concept: `${brief.concept}|${brief.textZone}`,
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
  const lastZone = input.state.published.at(-1)?.item?.concept?.split("|")[1];

  let brief = await inventAgencyBrief({
    avoidConcepts,
    avoidTitles,
    recentCaptions: input.captions,
    avoidZone: lastZone,
  });

  const attempts: ManagedPost["attempts"] = [];
  const maxRounds = 3;

  for (let round = 0; round < maxRounds; round++) {
    if (avoidConcepts.some((c) => c === brief.concept || c.startsWith(`${brief.concept}|`))) {
      brief = { ...brief, concept: `${brief.concept}-r${round}-${Date.now().toString(36)}`.slice(0, 48) };
    }

    // 1) Artista — fundo sem texto
    const art = await generateArt(brief.visualPrompt);
    if (!art) {
      attempts.push({ approved: false, reason: "artistas falharam neste round" });
      break;
    }

    // 2) Tipógrafo — overlay Satori com copy correta
    const bgUrl = artDataUrl(art);
    let composed: Buffer;
    try {
      composed = await renderTypedPost({
        backgroundUrl: bgUrl,
        headline: brief.onImage.headline,
        sub: brief.onImage.sub,
        zone: brief.textZone,
        lightText: brief.lightText,
      });
    } catch (err) {
      attempts.push({
        provider: art.provider,
        approved: false,
        reason: `tipógrafo falhou: ${err instanceof Error ? err.message : "erro"}`,
      });
      continue;
    }
    if (composed.byteLength < 20_000) {
      attempts.push({ provider: art.provider, approved: false, reason: "PNG composto muito pequeno" });
      continue;
    }

    const id = `agency-${brief.concept}-${Date.now().toString(36)}`;
    const item = briefToItem(brief, id, artPhotoId(art));
    const published = await publishPng(composed, id, item, input.reqOrigin);
    await input.saveDraft(published.item.id, {
      ...published.item,
      __meta: { textZone: brief.textZone, onImage: brief.onImage },
    }, false);

    // 3) Gerente — aprova peça final
    const verdict = await managerApprove({
      brief,
      provider: art.provider,
      imageUrl: published.imageUrl,
    });
    attempts.push({ provider: art.provider, approved: verdict.approved, reason: verdict.reason });

    if (verdict.approved) {
      const { __renderedPng: _, ...clean } = published.item as FeedItem & { __renderedPng?: string };
      void _;
      return {
        item: clean,
        caption: buildCaption(clean, brief),
        imageUrl: published.imageUrl,
        artist: art.provider,
        attempts,
      };
    }

    if (verdict.revisePrompt) {
      brief = {
        ...brief,
        concept: slugify(`rev-${brief.concept}-${round}`),
        textZone: parseZone(undefined, brief.textZone),
        visualPrompt: `${verdict.revisePrompt}. No text no logos no phone. Seed ${Date.now()}.`,
      };
    } else {
      brief = await inventAgencyBrief({
        avoidConcepts: [...avoidConcepts, brief.concept],
        avoidTitles,
        recentCaptions: input.captions,
        avoidZone: brief.textZone,
      }).catch(() => ({
        ...brief,
        concept: slugify(`retry-${brief.concept}`),
        textZone: parseZone(undefined, brief.textZone),
      }));
    }
  }

  throw new Error(`agência falhou: ${attempts.map((a) => a.reason).join(" | ")}`);
}

function buildCaption(item: FeedItem, brief?: AgencyBrief) {
  const lines = [
    item.hook || titleOf(item),
    brief?.onImage.sub || item.headline || "Single page e site sob medida — código próprio, lead no WhatsApp.",
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
