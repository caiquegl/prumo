import { instagramFrom, isSocialOnly, scoreLead, whatsappFrom } from "./score";
import { upsertLead } from "./store";

const ENDPOINT = "https://places.googleapis.com/v1/places:searchText";

/** FieldMask obrigatório no Places API (New). websiteUri/telefone = SKU Enterprise. */
const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.primaryTypeDisplayName",
  "places.formattedAddress",
  "places.addressComponents",
  "places.location",
  "places.nationalPhoneNumber",
  "places.internationalPhoneNumber",
  "places.websiteUri",
  "places.rating",
  "places.userRatingCount",
  "places.googleMapsUri",
  "places.regularOpeningHours.weekdayDescriptions",
  "places.businessStatus",
  "nextPageToken",
].join(",");

type AddressComponent = { longText?: string; shortText?: string; types?: string[] };

type Place = {
  id: string;
  displayName?: { text?: string };
  primaryTypeDisplayName?: { text?: string };
  formattedAddress?: string;
  addressComponents?: AddressComponent[];
  location?: { latitude?: number; longitude?: number };
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  rating?: number;
  userRatingCount?: number;
  googleMapsUri?: string;
  regularOpeningHours?: { weekdayDescriptions?: string[] };
  businessStatus?: string;
};

type SearchResponse = { places?: Place[]; nextPageToken?: string; error?: { message?: string } };

export type CollectResult = {
  query: string;
  found: number;
  inserted: number;
  updated: number;
  skippedWithSite: number;
  skippedClosed: number;
  pages: number;
};

function component(list: AddressComponent[] | undefined, type: string) {
  return list?.find((c) => c.types?.includes(type))?.longText ?? null;
}

async function searchPage(textQuery: string, pageToken?: string): Promise<SearchResponse> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) throw new Error("GOOGLE_PLACES_API_KEY ausente (Google Cloud → Places API (New))");
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify({
      textQuery,
      languageCode: "pt-BR",
      regionCode: "BR",
      pageSize: 20,
      ...(pageToken ? { pageToken } : {}),
    }),
  });
  const json = (await res.json()) as SearchResponse;
  if (!res.ok || json.error) {
    throw new Error(`Places ${res.status}: ${json.error?.message ?? "erro"}`);
  }
  return json;
}

/** Busca `query em city`, salva só quem não tem site próprio. Máx. 60 resultados (limite do Google). */
export async function collectLeads(input: { query: string; city: string; max?: number }): Promise<CollectResult> {
  const query = `${input.query.trim()} em ${input.city.trim()}`;
  const max = Math.max(1, Math.min(60, Math.floor(input.max ?? 20)));
  const result: CollectResult = {
    query,
    found: 0,
    inserted: 0,
    updated: 0,
    skippedWithSite: 0,
    skippedClosed: 0,
    pages: 0,
  };

  let token: string | undefined;
  do {
    const page = await searchPage(query, token);
    result.pages++;
    for (const p of page.places ?? []) {
      if (result.found >= max) break;
      result.found++;
      if (p.businessStatus && p.businessStatus !== "OPERATIONAL") {
        result.skippedClosed++;
        continue;
      }
      if (!isSocialOnly(p.websiteUri)) {
        result.skippedWithSite++;
        continue;
      }
      const phone = p.nationalPhoneNumber ?? p.internationalPhoneNumber ?? null;
      const whatsapp = whatsappFrom(p.internationalPhoneNumber ?? phone);
      const instagram = instagramFrom(p.websiteUri);
      const saved = await upsertLead({
        place_id: p.id,
        name: p.displayName?.text ?? "Sem nome",
        category: p.primaryTypeDisplayName?.text ?? input.query,
        phone,
        whatsapp,
        address: p.formattedAddress ?? null,
        neighborhood:
          component(p.addressComponents, "sublocality_level_1") ??
          component(p.addressComponents, "sublocality"),
        city: component(p.addressComponents, "administrative_area_level_2") ?? input.city,
        lat: p.location?.latitude ?? null,
        lng: p.location?.longitude ?? null,
        rating: p.rating ?? null,
        reviews_count: p.userRatingCount ?? null,
        maps_url: p.googleMapsUri ?? null,
        opening_hours: p.regularOpeningHours?.weekdayDescriptions ?? null,
        instagram,
        website_raw: p.websiteUri ?? null,
        score: scoreLead({ rating: p.rating, reviews: p.userRatingCount, whatsapp, phone, instagram }),
        search_query: query,
        raw: p,
      });
      if (saved.inserted) result.inserted++;
      else result.updated++;
    }
    token = page.nextPageToken;
  } while (token && result.found < max);

  return result;
}

/* ------------------------------------------------------------------ */
/* Detalhes sob demanda — só para leads que vão ganhar demo (estudo).   */
/* reviews/editorialSummary custam mais (SKU Atmosphere): 1 chamada/lead */
/* ------------------------------------------------------------------ */

const DETAILS_MASK = [
  "id",
  "displayName",
  "types",
  "primaryTypeDisplayName",
  "editorialSummary",
  "reviews",
  "photos",
  "priceLevel",
  "websiteUri",
].join(",");

type PlaceDetails = {
  id: string;
  displayName?: { text?: string };
  types?: string[];
  primaryTypeDisplayName?: { text?: string };
  editorialSummary?: { text?: string };
  priceLevel?: string;
  websiteUri?: string;
  reviews?: Array<{
    rating?: number;
    relativePublishTimeDescription?: string;
    publishTime?: string;
    text?: { text?: string };
    originalText?: { text?: string };
    authorAttribution?: { displayName?: string; uri?: string };
    googleMapsUri?: string;
  }>;
  photos?: Array<{
    name: string;
    widthPx?: number;
    heightPx?: number;
    authorAttributions?: Array<{ displayName?: string; uri?: string }>;
  }>;
  error?: { message?: string };
};

export type LeadDetails = {
  placeId: string;
  types: string[];
  category: string | null;
  summary: string | null;
  priceLevel: string | null;
  reviews: Array<{ author: string; authorUrl: string | null; rating: number | null; when: string | null; text: string; url: string | null }>;
  /** URLs temporárias (googleusercontent) — para ESTUDO (achar logo/fachada/estilo). Não embutir na demo. */
  photos: Array<{ url: string; width: number | null; height: number | null; author: string | null }>;
};

async function photoUri(name: string, key: string): Promise<string | null> {
  const res = await fetch(
    `https://places.googleapis.com/v1/${name}/media?maxWidthPx=1200&skipHttpRedirect=true`,
    { headers: { "X-Goog-Api-Key": key } },
  );
  if (!res.ok) return null;
  const json = (await res.json()) as { photoUri?: string };
  return json.photoUri ?? null;
}

export async function fetchLeadDetails(placeId: string, maxPhotos = 6): Promise<LeadDetails> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) throw new Error("GOOGLE_PLACES_API_KEY ausente");
  const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=pt-BR&regionCode=BR`, {
    headers: { "X-Goog-Api-Key": key, "X-Goog-FieldMask": DETAILS_MASK },
  });
  const p = (await res.json()) as PlaceDetails;
  if (!res.ok || p.error) throw new Error(`Places details ${res.status}: ${p.error?.message ?? "erro"}`);

  const photos: LeadDetails["photos"] = [];
  for (const ph of (p.photos ?? []).slice(0, Math.max(0, Math.min(10, maxPhotos)))) {
    const url = await photoUri(ph.name, key);
    if (url) {
      photos.push({
        url,
        width: ph.widthPx ?? null,
        height: ph.heightPx ?? null,
        author: ph.authorAttributions?.[0]?.displayName ?? null,
      });
    }
  }

  return {
    placeId: p.id,
    types: p.types ?? [],
    category: p.primaryTypeDisplayName?.text ?? null,
    summary: p.editorialSummary?.text ?? null,
    priceLevel: p.priceLevel ?? null,
    reviews: (p.reviews ?? [])
      .map((r) => ({
        author: r.authorAttribution?.displayName ?? "Cliente no Google",
        authorUrl: r.authorAttribution?.uri ?? null,
        rating: r.rating ?? null,
        when: r.relativePublishTimeDescription ?? null,
        text: (r.originalText?.text ?? r.text?.text ?? "").trim(),
        url: r.googleMapsUri ?? null,
      }))
      .filter((r) => r.text),
    photos,
  };
}
