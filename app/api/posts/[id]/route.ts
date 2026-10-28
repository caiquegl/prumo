import { del } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/guard";
import { deleteQueuePost, getQueuePost, updateQueuePost } from "@/lib/ig/queue";

type Ctx = { params: Promise<{ id: string }> };

function parseTags(raw: unknown): string[] | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  if (Array.isArray(raw)) {
    return raw.map(String).map((t) => t.replace(/^#/, "").trim()).filter(Boolean).slice(0, 12);
  }
  if (typeof raw === "string") {
    const text = raw.trim();
    if (!text) return null;
    return text
      .split(/[\s,]+/)
      .map((t) => t.replace(/^#/, "").trim())
      .filter(Boolean)
      .slice(0, 12);
  }
  return undefined;
}

export async function GET(req: NextRequest, ctx: Ctx) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const id = Number((await ctx.params).id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "id inválido" }, { status: 400 });
  const post = await getQueuePost(id);
  if (!post) return NextResponse.json({ error: "não encontrado" }, { status: 404 });
  return NextResponse.json({ post });
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const id = Number((await ctx.params).id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "id inválido" }, { status: 400 });
  const body = (await req.json()) as { caption?: string | null; tags?: unknown };
  const post = await updateQueuePost(id, {
    caption: body.caption !== undefined ? body.caption : undefined,
    tags: parseTags(body.tags),
  });
  if (!post) return NextResponse.json({ error: "não encontrado" }, { status: 404 });
  return NextResponse.json({ ok: true, post });
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const id = Number((await ctx.params).id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "id inválido" }, { status: 400 });

  const existing = await getQueuePost(id);
  if (!existing) return NextResponse.json({ error: "não encontrado" }, { status: 404 });

  const deleted = await deleteQueuePost(id);
  if (existing.blob_pathname) {
    try {
      await del(existing.blob_pathname);
    } catch (err) {
      console.error("[posts] blob delete failed", err);
    }
  }

  return NextResponse.json({ ok: true, post: deleted });
}
