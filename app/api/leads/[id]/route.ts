import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/guard";
import { deleteLead, getLead, leadEvents, parseLeadPatch, updateLead } from "@/lib/leads/store";

type Ctx = { params: Promise<{ id: string }> };

async function leadId(ctx: Ctx) {
  const id = Number((await ctx.params).id);
  return Number.isFinite(id) && id > 0 ? id : null;
}

const unauthorized = () => NextResponse.json({ error: "Unauthorized" }, { status: 401 });
const badId = () => NextResponse.json({ error: "id inválido" }, { status: 400 });
const notFound = () => NextResponse.json({ error: "não encontrado" }, { status: 404 });

export async function GET(req: NextRequest, ctx: Ctx) {
  if (!(await requireAdmin(req))) return unauthorized();
  const id = await leadId(ctx);
  if (!id) return badId();
  const lead = await getLead(id);
  if (!lead) return notFound();
  return NextResponse.json({ lead, events: await leadEvents(id) });
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  if (!(await requireAdmin(req))) return unauthorized();
  const id = await leadId(ctx);
  if (!id) return badId();
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  const patch = parseLeadPatch(body);
  if (typeof patch === "string") return NextResponse.json({ error: patch }, { status: 400 });
  const lead = await updateLead(id, patch);
  if (!lead) return notFound();
  return NextResponse.json({ ok: true, lead });
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  if (!(await requireAdmin(req))) return unauthorized();
  const id = await leadId(ctx);
  if (!id) return badId();
  if (!(await deleteLead(id))) return notFound();
  return NextResponse.json({ ok: true });
}
