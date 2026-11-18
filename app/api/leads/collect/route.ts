import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/guard";
import { collectLeads } from "@/lib/leads/places";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as { query?: string; city?: string; max?: number };
  const query = body.query?.trim();
  const city = body.city?.trim();
  if (!query || !city) {
    return NextResponse.json({ error: "informe query (nicho) e city (bairro/cidade)" }, { status: 400 });
  }
  try {
    const result = await collectLeads({ query, city, max: Number(body.max) || 20 });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "falhou ao coletar";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
