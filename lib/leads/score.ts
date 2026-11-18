/** Hosts que contam como "não tem site próprio". */
const SOCIAL_HOSTS = [
  "instagram.com",
  "facebook.com",
  "fb.com",
  "linktr.ee",
  "linkin.bio",
  "wa.me",
  "api.whatsapp.com",
  "whatsapp.com",
  "tiktok.com",
  "beacons.ai",
  "bio.link",
  "taplink.cc",
  "ifood.com.br",
  "goo.gl",
  "g.page",
  "business.site",
];

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

/** true quando o "site" é só rede social / agregador de links. */
export function isSocialOnly(url: string | null | undefined): boolean {
  if (!url) return true;
  const host = hostOf(url);
  if (!host) return true;
  return SOCIAL_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
}

export function instagramFrom(url: string | null | undefined): string | null {
  if (!url) return null;
  return hostOf(url).endsWith("instagram.com") ? url : null;
}

/**
 * Telefone BR → E.164 só quando é celular (provável WhatsApp).
 * Celular: DDD + 9 dígitos começando com 9.
 */
export function whatsappFrom(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length >= 12) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = digits.slice(1);
  if (digits.length !== 11) return null;
  if (digits[2] !== "9") return null;
  return `55${digits}`;
}

/** 0–100. Negócio ativo + fácil de abordar = mais alto. */
export function scoreLead(input: {
  rating?: number | null;
  reviews?: number | null;
  whatsapp?: string | null;
  phone?: string | null;
  instagram?: string | null;
}): number {
  let score = 0;
  const rating = input.rating ?? 0;
  const reviews = input.reviews ?? 0;

  if (rating >= 4.5) score += 25;
  else if (rating >= 4.0) score += 18;
  else if (rating >= 3.5) score += 8;

  if (reviews >= 100) score += 30;
  else if (reviews >= 50) score += 24;
  else if (reviews >= 20) score += 16;
  else if (reviews >= 5) score += 6;

  if (input.whatsapp) score += 30;
  else if (input.phone) score += 12;

  if (input.instagram) score += 15;

  return Math.min(100, score);
}
