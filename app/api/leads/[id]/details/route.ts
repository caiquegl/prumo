import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/guard";
import { fetchLeadDetailsApify } from "@/lib/leads/apify";
import { fetchLeadDetails } from "@/lib/leads/places";
import { getLead } from "@/lib/leads/store";

type Ctx = { params: Promise<{ id: string }> };

/** Estudo da empresa: avaliações reais, resumo e fotos do Google (1 chamada paga por lead). */
export const maxDuration = 300;

export async function GET(req: NextRequest, ctx: Ctx) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const id = Number((await ctx.params).id);
  if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ error: "id inválido" }, { status: 400 });
  const lead = await getLead(id);
  if (!lead) return NextResponse.json({ error: "não encontrado" }, { status: 404 });
  const photos = Number(req.nextUrl.searchParams.get("photos") ?? 6);
  try {
    const useGoogle = req.nextUrl.searchParams.get("source") === "google" || !process.env.APIFY_TOKEN;
    const details = useGoogle
      ? await fetchLeadDetails(lead.place_id, photos)
      : await fetchLeadDetailsApify(lead.place_id, photos);
    return NextResponse.json({ lead, source: useGoogle ? "google" : "apify", details });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "falhou" }, { status: 500 });
  }
}
