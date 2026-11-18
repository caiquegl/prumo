import type { CollectResult, LeadDetails } from "./places";
import { instagramFrom, isSocialOnly, scoreLead, whatsappFrom } from "./score";
import { upsertLead } from "./store";

/**
 * Coleta via Apify "Google Maps Scraper" (compass/crawler-google-places).
 * Mesmos dados do Google Maps sem chave do Google; cobra por resultado no Apify.
 */
const ACTOR = "compass~crawler-google-places";

type ApifyPlace = {
  placeId?: string;
  title?: string;
  categoryName?: string;
  address?: string;
  neighborhood?: string | null;
  city?: string | null;
  phone?: string | null;
  phoneUnformatted?: string | null;
  website?: string | null;
  totalScore?: number | null;
  reviewsCount?: number | null;
  url?: string;
  location?: { lat?: number; lng?: number };
  openingHours?: Array<{ day?: string; hours?: string }>;
  permanentlyClosed?: boolean;
  temporarilyClosed?: boolean;
  description?: string | null;
  categories?: string[];
  imageUrl?: string | null;
  imageUrls?: string[];
  reviewsTags?: Array<{ title?: string; count?: number }>;
  reviews?: Array<{
    name?: string;
    text?: string | null;
    textTranslated?: string | null;
    stars?: number | null;
    publishAt?: string | null;
    reviewUrl?: string | null;
    reviewerUrl?: string | null;
  }>;
};

function token() {
  const t = process.env.APIFY_TOKEN?.trim();
  if (!t) throw new Error("APIFY_TOKEN ausente (console.apify.com → Settings → API & Integrations)");
  return t;
}

async function runActor(input: Record<string, unknown>, timeoutSecs = 240): Promise<ApifyPlace[]> {
  const res = await fetch(
    `https://api.apify.com/v2/acts/${ACTOR}/run-sync-get-dataset-items?timeout=${timeoutSecs}&clean=true`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token()}`, "content-type": "application/json" },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout((timeoutSecs + 20) * 1000),
    },
  );
  const json = (await res.json().catch(() => null)) as unknown;
  if (!res.ok || !Array.isArray(json)) {
    const msg = (json as { error?: { message?: string } } | null)?.error?.message ?? `HTTP ${res.status}`;
    throw new Error(`Apify: ${msg}`);
  }
  return json as ApifyPlace[];
}

/** "09:00 to 21:00" → "09:00–21:00"; mantém o formato "dia: horário" do Places. */
function hours(list: ApifyPlace["openingHours"]): string[] | null {
  if (!list?.length) return null;
  return list.filter((h) => h.day).map((h) => `${h.day}: ${(h.hours ?? "").replace(/\s+to\s+/g, "–")}`);
}

export async function collectLeadsApify(input: { query: string; city: string; max?: number }): Promise<CollectResult> {
  const max = Math.max(1, Math.min(60, Math.floor(input.max ?? 20)));
  const query = `${input.query.trim()} em ${input.city.trim()}`;
  const places = await runActor({
    searchStringsArray: [input.query.trim()],
    locationQuery: input.city.includes("Brasil") ? input.city : `${input.city.trim()}, Brasil`,
    maxCrawledPlacesPerSearch: max,
    language: "pt-BR",
    skipClosedPlaces: true,
    maxReviews: 0,
    maxImages: 0,
  });

  const result: CollectResult = {
    query,
    found: 0,
    inserted: 0,
    updated: 0,
    skippedWithSite: 0,
    skippedClosed: 0,
    pages: 1,
  };

  for (const p of places) {
    if (!p.placeId || !p.title) continue;
    result.found++;
    if (p.permanentlyClosed || p.temporarilyClosed) {
      result.skippedClosed++;
      continue;
    }
    if (!isSocialOnly(p.website)) {
      result.skippedWithSite++;
      continue;
    }
    const phone = p.phone ?? null;
    const whatsapp = whatsappFrom(p.phoneUnformatted ?? phone);
    const instagram = instagramFrom(p.website);
    const saved = await upsertLead({
      place_id: p.placeId,
      source: "apify",
      name: p.title,
      category: p.categoryName ?? input.query,
      phone,
      whatsapp,
      address: p.address ?? null,
      neighborhood: p.neighborhood ?? null,
      city: p.city ?? input.city,
      lat: p.location?.lat ?? null,
      lng: p.location?.lng ?? null,
      rating: p.totalScore ?? null,
      reviews_count: p.reviewsCount ?? null,
      maps_url: p.url ?? null,
      opening_hours: hours(p.openingHours),
      instagram,
      website_raw: p.website ?? null,
      score: scoreLead({ rating: p.totalScore, reviews: p.reviewsCount, whatsapp, phone, instagram }),
      search_query: query,
      raw: p,
    });
    if (saved.inserted) result.inserted++;
    else result.updated++;
  }
  return result;
}

/** Estudo de um lead: avaliações reais, fotos, descrição e categorias (1 execução por lead). */
export async function fetchLeadDetailsApify(placeId: string, maxPhotos = 8): Promise<LeadDetails & { tags: string[] }> {
  const [p] = await runActor(
    {
      placeIds: [placeId],
      language: "pt-BR",
      maxReviews: 12,
      reviewsSort: "mostRelevant",
      maxImages: Math.max(0, Math.min(15, maxPhotos)),
      scrapeImageAuthors: false,
    },
    200,
  );
  if (!p) throw new Error("Apify não encontrou o place");
  return {
    placeId,
    types: p.categories ?? [],
    category: p.categoryName ?? null,
    summary: p.description ?? null,
    priceLevel: null,
    reviews: (p.reviews ?? [])
      .map((r) => ({
        author: r.name ?? "Cliente no Google",
        authorUrl: r.reviewerUrl ?? null,
        rating: r.stars ?? null,
        when: r.publishAt ?? null,
        text: (r.text ?? "").trim(),
        url: r.reviewUrl ?? null,
      }))
      .filter((r) => r.text),
    photos: (p.imageUrls ?? (p.imageUrl ? [p.imageUrl] : [])).slice(0, maxPhotos).map((url) => ({
      url,
      width: null,
      height: null,
      author: null,
    })),
    tags: (p.reviewsTags ?? []).map((t) => `${t.title} (${t.count})`),
  };
}
