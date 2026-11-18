import { db } from "@/lib/db";
import { isLeadStatus, type Lead, type LeadEvent, type LeadStatus } from "./types";

let ready = false;

export async function ensureLeadsSchema() {
  if (ready) return;
  const sql = db();
  await sql`
    CREATE TABLE IF NOT EXISTS leads (
      id SERIAL PRIMARY KEY,
      place_id TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      category TEXT,
      phone TEXT,
      whatsapp TEXT,
      address TEXT,
      neighborhood TEXT,
      city TEXT,
      lat DOUBLE PRECISION,
      lng DOUBLE PRECISION,
      rating REAL,
      reviews_count INTEGER,
      maps_url TEXT,
      opening_hours JSONB,
      instagram TEXT,
      website_raw TEXT,
      score INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'sem_site',
      demo_slug TEXT,
      demo_url TEXT,
      price_quoted NUMERIC(10,2),
      notes TEXT,
      search_query TEXT,
      raw JSONB,
      contacted_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
  await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS logo_url TEXT`;
  await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS brand_colors JSONB`;
  await sql`CREATE INDEX IF NOT EXISTS leads_status_score_idx ON leads (status, score DESC)`;
  await sql`
    CREATE TABLE IF NOT EXISTS lead_events (
      id SERIAL PRIMARY KEY,
      lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
      from_status TEXT,
      to_status TEXT,
      note TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
  await sql`CREATE INDEX IF NOT EXISTS lead_events_lead_idx ON lead_events (lead_id, created_at DESC)`;
  ready = true;
}

/** Colunas devolvidas pela API (sem `raw`, que é grande). */
function normalize(row: Record<string, unknown>): Lead {
  return {
    ...(row as unknown as Lead),
    rating: row.rating == null ? null : Number(row.rating),
    price_quoted: row.price_quoted == null ? null : Number(row.price_quoted),
  };
}

export async function listLeads(opts?: { status?: LeadStatus | "all"; q?: string }): Promise<Lead[]> {
  await ensureLeadsSchema();
  const status = opts?.status && opts.status !== "all" ? opts.status : null;
  const q = opts?.q?.trim() ? `%${opts.q.trim()}%` : null;
  const rows = (await db()`
    SELECT id, place_id, name, category, phone, whatsapp, address, neighborhood, city, lat, lng,
           rating, reviews_count, maps_url, opening_hours, instagram, website_raw, logo_url, brand_colors,
           score, status, demo_slug, demo_url, price_quoted, notes, search_query, contacted_at, created_at, updated_at
    FROM leads
    WHERE (${status}::text IS NULL OR status = ${status})
      AND (${q}::text IS NULL OR name ILIKE ${q} OR neighborhood ILIKE ${q} OR category ILIKE ${q})
    ORDER BY score DESC, id DESC
    LIMIT 500
  `) as Record<string, unknown>[];
  return rows.map(normalize);
}

export async function leadCounts(): Promise<Record<string, number>> {
  await ensureLeadsSchema();
  const rows = (await db()`SELECT status, COUNT(*)::int AS n FROM leads GROUP BY status`) as Array<{
    status: string;
    n: number;
  }>;
  return Object.fromEntries(rows.map((r) => [r.status, r.n]));
}

export async function getLead(id: number): Promise<Lead | null> {
  await ensureLeadsSchema();
  const rows = (await db()`SELECT * FROM leads WHERE id = ${id} LIMIT 1`) as Record<string, unknown>[];
  if (!rows[0]) return null;
  const { raw: _raw, ...rest } = rows[0];
  void _raw;
  return normalize(rest);
}

export async function leadEvents(id: number): Promise<LeadEvent[]> {
  await ensureLeadsSchema();
  return (await db()`
    SELECT * FROM lead_events WHERE lead_id = ${id} ORDER BY created_at DESC LIMIT 100
  `) as LeadEvent[];
}

export type LeadInput = Omit<
  Lead,
  | "id"
  | "status"
  | "demo_slug"
  | "demo_url"
  | "price_quoted"
  | "notes"
  | "contacted_at"
  | "logo_url"
  | "brand_colors"
  | "created_at"
  | "updated_at"
> & { raw?: unknown };

/** Insere se for novo; se já existe, só atualiza dados do Google (não mexe em status/notas). */
export async function upsertLead(input: LeadInput): Promise<{ inserted: boolean; id: number }> {
  await ensureLeadsSchema();
  const rows = (await db()`
    INSERT INTO leads (
      place_id, name, category, phone, whatsapp, address, neighborhood, city, lat, lng,
      rating, reviews_count, maps_url, opening_hours, instagram, website_raw, score, search_query, raw
    ) VALUES (
      ${input.place_id}, ${input.name}, ${input.category}, ${input.phone}, ${input.whatsapp},
      ${input.address}, ${input.neighborhood}, ${input.city}, ${input.lat}, ${input.lng},
      ${input.rating}, ${input.reviews_count}, ${input.maps_url},
      ${input.opening_hours ? JSON.stringify(input.opening_hours) : null}::jsonb,
      ${input.instagram}, ${input.website_raw}, ${input.score}, ${input.search_query},
      ${input.raw ? JSON.stringify(input.raw) : null}::jsonb
    )
    ON CONFLICT (place_id) DO UPDATE SET
      name = EXCLUDED.name,
      category = EXCLUDED.category,
      phone = EXCLUDED.phone,
      whatsapp = EXCLUDED.whatsapp,
      address = EXCLUDED.address,
      rating = EXCLUDED.rating,
      reviews_count = EXCLUDED.reviews_count,
      maps_url = EXCLUDED.maps_url,
      opening_hours = EXCLUDED.opening_hours,
      instagram = COALESCE(leads.instagram, EXCLUDED.instagram),
      website_raw = EXCLUDED.website_raw,
      score = EXCLUDED.score,
      raw = EXCLUDED.raw,
      updated_at = now()
    RETURNING id, (xmax = 0) AS inserted
  `) as Array<{ id: number; inserted: boolean }>;
  const row = rows[0]!;
  if (row.inserted) {
    await db()`INSERT INTO lead_events (lead_id, to_status, note) VALUES (${row.id}, 'sem_site', ${`coletado: ${input.search_query ?? ""}`})`;
  }
  return { inserted: row.inserted, id: row.id };
}

export type LeadPatch = {
  status?: LeadStatus;
  notes?: string | null;
  demo_slug?: string | null;
  demo_url?: string | null;
  price_quoted?: number | null;
  instagram?: string | null;
  whatsapp?: string | null;
  logo_url?: string | null;
  brand_colors?: string[] | null;
  event_note?: string | null;
};

export function parseLeadPatch(body: Record<string, unknown>): LeadPatch | string {
  const patch: LeadPatch = {};
  if (body.status !== undefined) {
    if (!isLeadStatus(body.status)) return `status inválido: ${String(body.status)}`;
    patch.status = body.status;
  }
  const str = (k: keyof LeadPatch) => {
    if (body[k] === undefined) return;
    const v = body[k];
    (patch as Record<string, unknown>)[k] = v === null || v === "" ? null : String(v).trim();
  };
  str("notes");
  str("demo_slug");
  str("demo_url");
  str("instagram");
  str("whatsapp");
  str("logo_url");
  str("event_note");
  if (body.brand_colors !== undefined) {
    if (body.brand_colors === null) patch.brand_colors = null;
    else if (
      Array.isArray(body.brand_colors) &&
      body.brand_colors.length <= 8 &&
      body.brand_colors.every((c) => typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c))
    ) {
      patch.brand_colors = (body.brand_colors as string[]).map((c) => c.toLowerCase());
    } else return "brand_colors precisa ser lista de até 8 cores #rrggbb";
  }
  if (body.price_quoted !== undefined) {
    if (body.price_quoted === null || body.price_quoted === "") patch.price_quoted = null;
    else {
      const n = Number(String(body.price_quoted).replace(",", "."));
      if (!Number.isFinite(n) || n < 0) return "price_quoted inválido";
      patch.price_quoted = n;
    }
  }
  if (patch.demo_url && !/^https?:\/\//i.test(patch.demo_url)) return "demo_url precisa ser http(s)";
  if (patch.logo_url && !/^https?:\/\//i.test(patch.logo_url)) return "logo_url precisa ser http(s)";
  return patch;
}

export async function updateLead(id: number, patch: LeadPatch): Promise<Lead | null> {
  await ensureLeadsSchema();
  const current = await getLead(id);
  if (!current) return null;
  const pick = <K extends keyof Lead>(k: K, v: Lead[K] | undefined) => (v !== undefined ? v : current[k]);
  const status = pick("status", patch.status);
  const contactedAt =
    status === "abordado" && !current.contacted_at ? new Date().toISOString() : current.contacted_at;

  await db()`
    UPDATE leads SET
      status = ${status},
      notes = ${pick("notes", patch.notes)},
      demo_slug = ${pick("demo_slug", patch.demo_slug)},
      demo_url = ${pick("demo_url", patch.demo_url)},
      price_quoted = ${pick("price_quoted", patch.price_quoted)},
      instagram = ${pick("instagram", patch.instagram)},
      whatsapp = ${pick("whatsapp", patch.whatsapp)},
      logo_url = ${pick("logo_url", patch.logo_url)},
      brand_colors = ${(() => {
        const v = pick("brand_colors", patch.brand_colors);
        return v ? JSON.stringify(v) : null;
      })()}::jsonb,
      contacted_at = ${contactedAt},
      updated_at = now()
    WHERE id = ${id}
  `;

  if (status !== current.status || patch.event_note) {
    await db()`
      INSERT INTO lead_events (lead_id, from_status, to_status, note)
      VALUES (${id}, ${current.status}, ${status}, ${patch.event_note ?? null})
    `;
  }
  return getLead(id);
}

export async function deleteLead(id: number): Promise<boolean> {
  await ensureLeadsSchema();
  const rows = (await db()`DELETE FROM leads WHERE id = ${id} RETURNING id`) as Array<{ id: number }>;
  return rows.length > 0;
}
