export const LEAD_STATUSES = [
  "sem_site",
  "criando",
  "publicado",
  "abordado",
  "respondeu",
  "aceitou",
  "recusou",
  "sem_resposta",
  "descartado",
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  sem_site: "Site não criado",
  criando: "Criando site",
  publicado: "Demo publicada",
  abordado: "Cliente abordado",
  respondeu: "Respondeu",
  aceitou: "Aceitou",
  recusou: "Recusou",
  sem_resposta: "Sem resposta",
  descartado: "Descartado",
};

export function isLeadStatus(raw: unknown): raw is LeadStatus {
  return typeof raw === "string" && (LEAD_STATUSES as readonly string[]).includes(raw);
}

export type Lead = {
  id: number;
  place_id: string;
  name: string;
  category: string | null;
  phone: string | null;
  whatsapp: string | null;
  address: string | null;
  neighborhood: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
  rating: number | null;
  reviews_count: number | null;
  maps_url: string | null;
  opening_hours: string[] | null;
  instagram: string | null;
  website_raw: string | null;
  /** Logo da empresa (URL pública, ex.: demos.webprumo.com.br/brands/<slug>/logo.png) */
  logo_url: string | null;
  /** Cores da marca extraídas do logo/identidade (hex), da mais forte para a mais fraca */
  brand_colors: string[] | null;
  score: number;
  status: LeadStatus;
  demo_slug: string | null;
  demo_url: string | null;
  price_quoted: number | null;
  notes: string | null;
  search_query: string | null;
  contacted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type LeadEvent = {
  id: number;
  lead_id: number;
  from_status: string | null;
  to_status: string | null;
  note: string | null;
  created_at: string;
};
