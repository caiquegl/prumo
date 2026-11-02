import { hashtagsForCaption } from "./hashtags";

export const BRAND_HANDLE = "web.prumo";
export const BRAND_NAME = "Web Prumo";
export const BRAND_SITE = "webprumo.com.br";
export const BRAND_WHATSAPP = "(11) 96633-1995";

const LEGACY_HANDLES = [/@prumo\.web\b/gi, /\bPrumo Web\b/g];

/** Corrige marca legada e reforça assinatura comercial. */
export function normalizeBrandCopy(text: string): string {
  let out = text || "";
  out = out.replace(LEGACY_HANDLES[0]!, `@${BRAND_HANDLE}`);
  out = out.replace(LEGACY_HANDLES[1]!, BRAND_NAME);
  out = out.replace(/#prumoweb\b/gi, "#webprumo");
  return out;
}

function ensureFooter(caption: string): string {
  const lower = caption.toLowerCase();
  const hasHandle = lower.includes(`@${BRAND_HANDLE}`);
  const hasWa = lower.includes("96633") || lower.includes("whatsapp");
  const lines: string[] = [];
  if (!hasHandle) lines.push(`${BRAND_NAME} · @${BRAND_HANDLE}`);
  if (!hasWa) lines.push(`WhatsApp ${BRAND_WHATSAPP}`);
  if (!lines.length) return caption.trim();
  return `${caption.trim()}\n\n${lines.join("\n")}`;
}

function stripExistingHashtags(caption: string): { body: string; existing: string[] } {
  const existing: string[] = [];
  const body = caption
    .replace(/#[\p{L}\p{N}_]+/gu, (tag) => {
      existing.push(tag.slice(1).toLowerCase());
      return "";
    })
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { body, existing };
}

/**
 * Monta legenda final: marca correta, CTA WhatsApp, 3–5 hashtags sized.
 * Stories: só limpa marca (IG ignora caption em STORIES).
 */
export function polishCaption(
  caption: string | null | undefined,
  opts?: { mediaType?: string; tags?: string[] | null; forStory?: boolean },
): string {
  const raw = normalizeBrandCopy((caption || "").trim());
  if (opts?.forStory || opts?.mediaType === "story") {
    return raw.slice(0, 2200);
  }

  const { body, existing } = stripExistingHashtags(raw);
  const withFooter = ensureFooter(body);

  const fromTags = (opts?.tags || [])
    .map((t) => String(t).replace(/^#/, "").trim().toLowerCase())
    .filter(Boolean);

  const auto = hashtagsForCaption(withFooter, opts?.mediaType);
  const merged: string[] = [];
  for (const t of [...fromTags, ...existing, ...auto]) {
    const clean = t.replace(/^#/, "").toLowerCase();
    if (!clean || merged.includes(clean)) continue;
    merged.push(clean);
    if (merged.length >= 5) break;
  }

  const hashLine = merged.map((t) => `#${t}`).join(" ");
  return hashLine ? `${withFooter}\n\n${hashLine}` : withFooter;
}

/** Hook curto para preview / AI — máx ~125 chars (fold do Instagram). */
export function clipHook(text: string, max = 125): string {
  const one = normalizeBrandCopy(text).replace(/\s+/g, " ").trim();
  if (one.length <= max) return one;
  return `${one.slice(0, max - 1).trim()}…`;
}
