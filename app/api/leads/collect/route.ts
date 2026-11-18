import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/guard";
import { collectLeadsApify } from "@/lib/leads/apify";
import { collectLeads } from "@/lib/leads/places";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    query?: string;
    city?: string;
    max?: number;
    source?: "apify" | "google";
  };
  const query = body.query?.trim();
  const city = body.city?.trim();
  if (!query || !city) {
    return NextResponse.json({ error: "informe query (nicho) e city (bairro/cidade)" }, { status: 400 });
  }
  try {
    // Padrão: Apify se houver token; Places API só se pedir ou se não houver Apify.
    const source = body.source ?? (process.env.APIFY_TOKEN ? "apify" : "google");
    const input = { query, city, max: Number(body.max) || 20 };
    const result = source === "apify" ? await collectLeadsApify(input) : await collectLeads(input);
    return NextResponse.json({ ok: true, source, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "falhou ao coletar";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
