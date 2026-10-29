import { put } from "@vercel/blob";
import { generateArt, type ArtistResult } from "./artists";
import { renderScenePost } from "./compose";
import {
  FORMATS,
  normalizePalette,
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

function conceptStem(raw: string): string {
  return slugify(raw.split("|")[0] || raw)
    .replace(/-r\d+.*$/i, "")
    .replace(/-mvs[a-z0-9]+$/i, "")
    .replace(/-v\d+$/i, "")
    .replace(/-(prumo|rev|retry).*$/i, "")
    .slice(0, 36);
}

function recentStems(state: IgState): string[] {
  return [...new Set(recentConcepts(state).map(conceptStem).filter(Boolean))];
}

function recentFormats(state: IgState): SceneFormat[] {
  return state.published
    .slice(-8)
    .map((p) => (p.item?.concept || "").split("|")[1])
    .filter((f): f is SceneFormat => FORMATS.includes(f as SceneFormat));
}

/** Força rodízio: evita os 3 formatos mais recentes; se todos bloqueados, pega o menos recente. */
function pickForcedFormat(state: IgState): SceneFormat {
  const recent = recentFormats(state);
  const blocked = new Set(recent.slice(-3));
  const free = FORMATS.filter((f) => !blocked.has(f));
  if (free.length) {
    // espalha: prefere o que nunca apareceu nos últimos 8
    const never = free.filter((f) => !recent.includes(f));
    const pool = never.length ? never : free;
    return pool[Math.floor(Math.random() * pool.length)]!;
  }
  // todos nos últimos 3 — escolhe o mais antigo entre os 4
  for (const f of FORMATS) {
    if (recent[recent.length - 1] !== f) return f;
  }
  return FORMATS[0]!;
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
  avoidStems: string[];
  avoidTitles: string[];
  recentCaptions: string[];
  forcedFormat: SceneFormat;
}): Promise<AgencyBrief> {
  const formatHints: Record<SceneFormat, string> = {
    productDark: "dark bg + headline + chips + device mockup bottom (Felipe). artRole MUST be bottomDevice.",
    editorialLight: "cream/paper bg + accent typography + tilted badge + optional side photo (Aviva). artRole sidePhoto or none.",
    bastidor: "REAL workspace desk photo full-bleed + glass card + bottom type. artRole MUST be fullBleed. Camera: hands, coffee, messy-clean desk — NOT floating laptop on void.",
    anatomy: "checklist of LP structure + partial device on side. artRole sidePhoto. Different headline every time (not always 'máquina de vendas').",
  };
  const text = await geminiText(
    `You are the strategist + art director of Prumo Web (Brazilian freelance: custom single-page / landing sites + WhatsApp leads). Mix TWO reference styles:
A) AVIVA — clean editorial layers: few words, accent word color, shapes/badges, cream or paper, photo as a piece not wallpaper.
B) FELIPE DELFINO — TI/product marketing: laptop/phone mockups, dark glow, UI chips/pills, conversion copy, autoridade digital.

Build ONE Instagram FEED post as a LAYERED SCENE (not photo+text-band overlay).

HARD REQUIREMENT — format is LOCKED to: ${input.forcedFormat}
${formatHints[input.forcedFormat]}
You MUST return "format": "${input.forcedFormat}" exactly. Do not pick another format.

DIVERSITY (critical):
- concept slug MUST be totally new — forbidden stems: ${input.avoidStems.slice(0, 20).join(", ") || "none"}
- NEVER reuse themes like dark-oled / conversion-machine / cream-tech-stack if they appear in forbidden stems
- headline MUST differ from recent captions; ban repeating the same metaphor twice in a row
- vary camera, palette accent, and offer angle (performance vs autoridade vs WhatsApp funnel vs código próprio)

RULES:
- visualPrompt: English, NO readable letters anywhere (mockup screens = abstract bars only). NO logos, phones, @handles. Match artRole for ${input.forcedFormat}.
- copy.headline: Portuguese, max 10 words, sells TI+marketing — UNIQUE wording.
- copy.accentWord: one word FROM the headline.
- copy.chips: 2-3 short labels.
- copy.badge: required for editorialLight; optional otherwise.
- NEVER put phone/@ in visualPrompt or on-image copy.

Forbidden concepts: ${input.avoidConcepts.join(", ") || "none"}
Avoid titles: ${input.avoidTitles.slice(0, 10).join(" | ") || "none"}
Recent captions: ${input.recentCaptions.slice(0, 5).join(" || ").slice(0, 700) || "none"}

Respond ONLY JSON:
{
  "concept": "unique-english-slug-not-in-forbidden-stems",
  "angle": "short-slug",
  "pillar": "single-page|landing|codigo-proprio|performance|funil-whatsapp|ti-freela|autoridade-digital",
  "kicker": "label",
  "title": "db title",
  "hook": "caption hook PT",
  "headline": "caption CTA PT",
  "tags": ["singlepage","landingpage"],
  "format": "${input.forcedFormat}",
  "artRole": "${defaultArtRole(input.forcedFormat)}",
  "palette": {"bg":"#...","ink":"#...","accent":"#...","soft":"..."},
  "copy": {
    "headline": "unique PT headline",
    "accentWord": "word",
    "sub": "short support",
    "badge": "optional punch",
    "chips": ["A","B","C"],
    "metaLeft": "PRUMO WEB",
    "metaRight": "TI · LANDING"
  },
  "visualPrompt": "detailed English prompt matching ${input.forcedFormat}, no text..."
}`,
    1600,
  );

  const json = extractJsonObject(text);
  // Formato é imposto pelo rodízio — Gemini não escolhe
  const format = input.forcedFormat;
  const copyRaw = (json.copy || {}) as Record<string, unknown>;
  const headline = String(copyRaw.headline || json.title || "Site sob medida que converte").trim();
  const accentWord = copyRaw.accentWord ? String(copyRaw.accentWord).trim() : undefined;
  const chips = Array.isArray(copyRaw.chips) ? (copyRaw.chips as string[]).map(String).slice(0, 4) : undefined;
  const paletteRaw = (json.palette || {}) as Partial<ScenePalette>;
  // artRole amarrado ao formato (evita productDark sem mockup / bastidor sem fullBleed)
  const artRole = defaultArtRole(format);

  let visualPrompt = String(json.visualPrompt || "").trim();
  if (!visualPrompt && artRole !== "none") {
    visualPrompt = defaultVisual(format, artRole);
  }
  if (artRole !== "none") {
    visualPrompt = `${visualPrompt}. Vertical Instagram 1080x1350. Format ${format}. Absolutely NO readable text or letters anywhere — mockup screens only abstract UI bars/shapes. NO logos, watermarks, phone numbers. Seed ${Date.now()}-${Math.random().toString(36).slice(2, 8)}.`;
  }

  let concept = slugify(String(json.concept || `post-${Date.now().toString(36)}`));
  if (input.avoidStems.includes(conceptStem(concept))) {
    concept = slugify(`${format}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`);
  }
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
  const avoidStems = recentStems(input.state);
  const avoidTitles = input.state.published.map((p) => p.title.toLowerCase());
  let forcedFormat = pickForcedFormat(input.state);

  let brief = await inventAgencyBrief({
    avoidConcepts,
    avoidStems,
    avoidTitles,
    recentCaptions: input.captions,
    forcedFormat,
  });

  const attempts: ManagedPost["attempts"] = [];
  const maxRounds = 3;

  for (let round = 0; round < maxRounds; round++) {
    if (
      avoidConcepts.some((c) => c === brief.concept || c.startsWith(`${brief.concept}|`)) ||
      avoidStems.includes(conceptStem(brief.concept))
    ) {
      brief = {
        ...brief,
        concept: slugify(`${brief.scene.format}-${Date.now().toString(36)}-r${round}`).slice(0, 48),
      };
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
      // Mantém o formato forçado; só regenera a arte
      brief = {
        ...brief,
        concept: slugify(`${brief.scene.format}-${Date.now().toString(36)}-rev`),
        visualPrompt: `${verdict.revisePrompt}. Format ${brief.scene.format}. No text no logos. Seed ${Date.now()}.`,
      };
    } else {
      const nextPool = FORMATS.filter((f) => f !== brief.scene.format);
      forcedFormat = nextPool[Math.floor(Math.random() * nextPool.length)] || "editorialLight";
      brief = await inventAgencyBrief({
        avoidConcepts: [...avoidConcepts, brief.concept],
        avoidStems: [...avoidStems, conceptStem(brief.concept)],
        avoidTitles,
        recentCaptions: input.captions,
        forcedFormat,
      }).catch(() => ({
        ...brief,
        concept: slugify(`${forcedFormat}-${Date.now().toString(36)}`),
        scene: {
          ...brief.scene,
          format: forcedFormat,
          artRole: defaultArtRole(forcedFormat),
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
    "Prumo Web · @web.prumo",
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
