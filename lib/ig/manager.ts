import { put } from "@vercel/blob";
import { generateArt, type ArtistResult } from "./artists";
import { renderScenePost } from "./compose";
import {
  FORMATS,
  normalizePalette,
  parseFormat,
  type SceneBrief,
  type SceneFormat,
  type ScenePalette,
} from "./scene";
import { orshotTemplateId, renderOrshot } from "./orshot";
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

type AgencyBrief = {
  concept: string;
  angle: string;
  pillar: string;
  kicker: string;
  title: string;
  hook: string;
  headline: string;
  tags: string[];
  scene: SceneBrief;
  /** Prompt visual SEM texto/logo/telefone — arte pra encaixar na cena */
  visualPrompt: string;
};

/**
 * Estrategista + diretor: mix Aviva (camadas/tipografia) + Felipe (TI/produto/mockup).
 */
async function inventAgencyBrief(input: {
  avoidConcepts: string[];
  avoidTitles: string[];
  recentCaptions: string[];
  avoidFormat?: string;
}): Promise<AgencyBrief> {
  const text = await geminiText(
    `You are the strategist + art director of Prumo Web (Brazilian freelance: custom single-page / landing sites + WhatsApp leads). Mix TWO reference styles:
A) AVIVA — clean editorial layers: few words, accent word color, shapes/badges, cream or paper, photo as a piece not wallpaper.
B) FELIPE DELFINO — TI/product marketing: laptop/phone mockups, dark glow, UI chips/pills, conversion copy ("máquina de vendas", landing, autoridade digital).

Build ONE Instagram FEED post as a LAYERED SCENE (not photo+text-band overlay).

FORMATS (pick one, avoid ${input.avoidFormat || "none"}):
- productDark: dark bg + headline + chips + device mockup bottom (Felipe)
- editorialLight: cream bg + accent typography + tilted badge + optional side photo (Aviva)
- bastidor: real workspace photo full-bleed + glass card + bottom type (Felipe technique)
- anatomy: checklist of LP structure + partial device (Felipe content, Aviva clean)

RULES:
- visualPrompt: English, NO readable letters anywhere (mockup screens = abstract bars only). NO logos, phones, @handles. Match artRole.
- artRole: fullBleed|bottomDevice|sidePhoto|none — must fit format.
- copy.headline: Portuguese, max 10 words, sells TI+marketing (site/landing/conversão).
- copy.accentWord: one word FROM the headline that gets accent color.
- copy.chips: 2-3 short labels (Landing page, Single page, WhatsApp, Performance...).
- copy.badge: short punchline for editorialLight (optional other formats).
- NEVER put Prumo logo, @prumo.web or phone in visualPrompt or on-image copy beyond the scene composer brand mark.
- Caption will carry WhatsApp separately.

Forbidden concepts: ${input.avoidConcepts.join(", ") || "none"}
Avoid titles: ${input.avoidTitles.slice(0, 10).join(" | ") || "none"}
Recent captions: ${input.recentCaptions.slice(0, 5).join(" || ").slice(0, 700) || "none"}

Respond ONLY JSON:
{
  "concept": "unique-english-slug",
  "angle": "short-slug",
  "pillar": "single-page|landing|codigo-proprio|performance|funil-whatsapp|ti-freela|autoridade-digital",
  "kicker": "label",
  "title": "db title",
  "hook": "caption hook PT",
  "headline": "caption CTA PT",
  "tags": ["singlepage","landingpage"],
  "format": "productDark",
  "artRole": "bottomDevice",
  "palette": {"bg":"#0b1220","ink":"#f4f7fb","accent":"#7dd3fc","soft":"rgba(244,247,251,0.72)"},
  "copy": {
    "headline": "Seu site pode ser a máquina de vendas",
    "accentWord": "máquina",
    "sub": "Landing sob medida com lead no WhatsApp",
    "badge": "Não é sorte. É estrutura.",
    "chips": ["Landing page","Single page","WhatsApp"],
    "metaLeft": "PRUMO WEB",
    "metaRight": "TI · LANDING"
  },
  "visualPrompt": "detailed English prompt for clean device mockup / photo, no text..."
}`,
    1600,
  );

  const json = extractJsonObject(text);
  const format = parseFormat(json.format, input.avoidFormat);
  const copyRaw = (json.copy || {}) as Record<string, unknown>;
  const headline = String(copyRaw.headline || json.title || "Site sob medida que converte").trim();
  const accentWord = copyRaw.accentWord ? String(copyRaw.accentWord).trim() : undefined;
  const chips = Array.isArray(copyRaw.chips) ? (copyRaw.chips as string[]).map(String).slice(0, 4) : undefined;
  const paletteRaw = (json.palette || {}) as Partial<ScenePalette>;
  const artRoleRaw = String(json.artRole || "");
  const artRole = (["fullBleed", "bottomDevice", "sidePhoto", "none"].includes(artRoleRaw)
    ? artRoleRaw
    : defaultArtRole(format)) as SceneBrief["artRole"];

  let visualPrompt = String(json.visualPrompt || "").trim();
  if (!visualPrompt && artRole !== "none") {
    visualPrompt = defaultVisual(format, artRole);
  }
  if (artRole !== "none") {
    visualPrompt = `${visualPrompt}. Vertical Instagram 1080x1350. Absolutely NO readable text or letters anywhere — mockup screens only abstract UI bars/shapes. NO logos, watermarks, phone numbers. Seed ${Date.now()}.`;
  }

  const concept = slugify(String(json.concept || `post-${Date.now().toString(36)}`));
  const scene: SceneBrief = {
    format,
    artRole,
    palette: normalizePalette(format, paletteRaw),
    copy: {
      headline,
      accentWord,
      sub: copyRaw.sub ? String(copyRaw.sub).trim() : undefined,
      badge: copyRaw.badge ? String(copyRaw.badge).trim() : undefined,
      chips,
      metaLeft: copyRaw.metaLeft ? String(copyRaw.metaLeft) : undefined,
      metaRight: copyRaw.metaRight ? String(copyRaw.metaRight) : undefined,
    },
  };

  return {
    concept,
    angle: slugify(String(json.angle || concept)),
    pillar: String(json.pillar || "single-page"),
    kicker: String(json.kicker || "SINGLE PAGE"),
    title: String(json.title || headline),
    hook: String(json.hook || headline),
    headline: String(json.headline || "Chama no WhatsApp."),
    tags: Array.isArray(json.tags) ? (json.tags as string[]).map(String) : ["singlepage", "landingpage"],
    scene,
    visualPrompt,
  };
}

function defaultArtRole(format: SceneFormat): SceneBrief["artRole"] {
  switch (format) {
    case "editorialLight":
      return "sidePhoto";
    case "bastidor":
      return "fullBleed";
    case "anatomy":
      return "sidePhoto";
    default:
      return "bottomDevice";
  }
}

function defaultVisual(format: SceneFormat, artRole: string) {
  if (artRole === "none") return "";
  if (format === "bastidor") {
    return "Cinematic photo of a clean developer desk with laptop showing abstract website UI blocks, moody lighting, no readable text";
  }
  return "Premium product photo of a laptop or phone showing abstract landing-page UI shapes, dark cinematic lighting, no readable text";
}

async function managerApprove(input: {
  brief: AgencyBrief;
  provider: string;
  imageUrl: string;
}): Promise<{ approved: boolean; reason: string; revisePrompt?: string }> {
  try {
    const text = await geminiText(
      `Você é gerente de agência (Prumo Web). Avalie a PEÇA FINAL em camadas (mix Aviva editorial + Felipe TI).
APROVAR se:
1) Parece edição composta (tipografia + formas/chips/mockup), NÃO só foto com faixa
2) Assunto marketing∩TI (site/landing/conversão) legível
3) Sem telefone/@/logo inventados pela IA na arte
4) Formato ${input.brief.scene.format} coerente
REPROVAR: banda genérica, clay abstrato, tipografia ilegível, sem oferta
Copy: ${JSON.stringify(input.brief.scene.copy)}
Conceito: ${input.brief.concept}
Provider: ${input.provider}
URL: ${input.imageUrl}
JSON: {"approved":true|false,"reason":"frase","revisePrompt":"novo visualPrompt inglês SEM texto se reprovar arte"}`,
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
    sub: brief.scene.copy.sub,
    headline: brief.headline,
    hook: brief.hook,
    tags: brief.tags,
    pillar: brief.pillar,
    angle: brief.angle,
    concept: `${brief.concept}|${brief.scene.format}`,
    photoId,
  };
}

async function composeScene(brief: AgencyBrief, artUrl?: string): Promise<Buffer> {
  // Preferência: Satori scene graph. Orshot só se template configurado.
  const tpl = orshotTemplateId();
  if (tpl && artUrl?.startsWith("http")) {
    const orshot = await renderOrshot({
      templateId: tpl,
      modifications: {
        headline: brief.scene.copy.headline,
        sub: brief.scene.copy.sub || "",
        photo: artUrl,
        accent: brief.scene.palette.accent,
      },
    });
    if (orshot && orshot.byteLength > 20_000) return orshot;
  }
  return renderScenePost({ brief: brief.scene, artUrl });
}

export async function produceManagedPost(input: {
  state: IgState;
  captions: string[];
  reqOrigin: string;
  saveDraft: (id: string, payload: unknown, dark?: boolean) => Promise<void>;
}): Promise<ManagedPost> {
  const avoidConcepts = recentConcepts(input.state);
  const avoidTitles = input.state.published.map((p) => p.title.toLowerCase());
  const lastFormat = input.state.published.at(-1)?.item?.concept?.split("|")[1];

  let brief = await inventAgencyBrief({
    avoidConcepts,
    avoidTitles,
    recentCaptions: input.captions,
    avoidFormat: lastFormat,
  });

  const attempts: ManagedPost["attempts"] = [];
  const maxRounds = 3;

  for (let round = 0; round < maxRounds; round++) {
    if (avoidConcepts.some((c) => c === brief.concept || c.startsWith(`${brief.concept}|`))) {
      brief = { ...brief, concept: `${brief.concept}-r${round}-${Date.now().toString(36)}`.slice(0, 48) };
    }

    let artUrl: string | undefined;
    let art: ArtistResult | null = null;
    if (brief.scene.artRole !== "none") {
      art = await generateArt(brief.visualPrompt);
      if (!art) {
        attempts.push({ approved: false, reason: "artistas falharam neste round" });
        // editorial pode sobreviver sem arte
        if (brief.scene.format !== "editorialLight") break;
        brief = { ...brief, scene: { ...brief.scene, artRole: "none" } };
      } else {
        artUrl = artDataUrl(art);
      }
    }

    let composed: Buffer;
    try {
      composed = await composeScene(brief, artUrl);
    } catch (err) {
      attempts.push({
        provider: art?.provider,
        approved: false,
        reason: `cena falhou: ${err instanceof Error ? err.message : "erro"}`,
      });
      continue;
    }
    if (composed.byteLength < 20_000) {
      attempts.push({ provider: art?.provider, approved: false, reason: "PNG cena muito pequeno" });
      continue;
    }

    const id = `agency-${brief.concept}-${Date.now().toString(36)}`;
    const item = briefToItem(brief, id, art ? artPhotoId(art) : undefined);
    const published = await publishPng(composed, id, item, input.reqOrigin);
    await input.saveDraft(
      published.item.id,
      {
        ...published.item,
        __meta: { format: brief.scene.format, artRole: brief.scene.artRole, copy: brief.scene.copy },
      },
      false,
    );

    const verdict = await managerApprove({
      brief,
      provider: art?.provider || "scene-only",
      imageUrl: published.imageUrl,
    });
    attempts.push({ provider: art?.provider || "scene", approved: verdict.approved, reason: verdict.reason });

    if (verdict.approved) {
      const { __renderedPng: _, ...clean } = published.item as FeedItem & { __renderedPng?: string };
      void _;
      return {
        item: clean,
        caption: buildCaption(clean, brief),
        imageUrl: published.imageUrl,
        artist: art?.provider,
        attempts,
      };
    }

    if (verdict.revisePrompt && brief.scene.artRole !== "none") {
      brief = {
        ...brief,
        concept: slugify(`rev-${brief.concept}-${round}`),
        scene: {
          ...brief.scene,
          format: parseFormat(undefined, brief.scene.format),
        },
        visualPrompt: `${verdict.revisePrompt}. No text no logos. Seed ${Date.now()}.`,
      };
    } else {
      brief = await inventAgencyBrief({
        avoidConcepts: [...avoidConcepts, brief.concept],
        avoidTitles,
        recentCaptions: input.captions,
        avoidFormat: brief.scene.format,
      }).catch(() => ({
        ...brief,
        concept: slugify(`retry-${brief.concept}`),
        scene: {
          ...brief.scene,
          format: FORMATS.find((f) => f !== brief.scene.format) || "editorialLight",
        },
      }));
    }
  }

  throw new Error(`agência falhou: ${attempts.map((a) => a.reason).join(" | ")}`);
}

function buildCaption(item: FeedItem, brief?: AgencyBrief) {
  const lines = [
    item.hook || titleOf(item),
    brief?.scene.copy.sub || item.headline || "Single page e site sob medida — código próprio, lead no WhatsApp.",
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
