import { put } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/guard";
import { createQueuePost, listQueuePosts, type MediaKind } from "@/lib/ig/queue";

const IMAGE_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"]);
const VIDEO_TYPES = new Set(["video/mp4", "video/quicktime", "video/webm"]);

function parseTags(raw: FormDataEntryValue | null): string[] | null {
  if (raw == null) return null;
  const text = String(raw).trim();
  if (!text) return null;
  try {
    if (text.startsWith("[")) {
      const arr = JSON.parse(text) as unknown;
      if (Array.isArray(arr)) {
        return arr.map(String).map((t) => t.replace(/^#/, "").trim()).filter(Boolean).slice(0, 12);
      }
    }
  } catch {
    /* fall through */
  }
  return text
    .split(/[\s,]+/)
    .map((t) => t.replace(/^#/, "").trim())
    .filter(Boolean)
    .slice(0, 12);
}

function mediaKind(type: string): MediaKind | null {
  if (IMAGE_TYPES.has(type)) return "image";
  if (VIDEO_TYPES.has(type)) return "video";
  return null;
}

export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const posts = await listQueuePosts({ status: "all" });
  return NextResponse.json({ posts });
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const form = await req.formData();
    const file = form.get("file");
    const caption = String(form.get("caption") || "").trim() || null;
    const tags = parseTags(form.get("tags"));

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'Envie multipart com campo "file"' }, { status: 400 });
    }

    const kind = mediaKind(file.type);
    if (!kind) {
      return NextResponse.json(
        { error: `Tipo não permitido: ${file.type}. Use imagem (jpeg/png/webp/gif) ou vídeo (mp4/mov/webm).` },
        { status: 400 },
      );
    }

    const maxBytes = kind === "video" ? 80 * 1024 * 1024 : 12 * 1024 * 1024;
    if (file.size > maxBytes) {
      return NextResponse.json(
        { error: kind === "video" ? "Vídeo maior que 80MB" : "Arquivo maior que 12MB" },
        { status: 400 },
      );
    }

    const original = file.name.replace(/[^a-zA-Z0-9._-]/g, "_") || (kind === "video" ? "post.mp4" : "post.png");
    const pathname = `ig-queue/${Date.now()}-${original}`;
    const blob = await put(pathname, file, {
      access: "public",
      contentType: file.type,
      addRandomSuffix: true,
    });

    const post = await createQueuePost({
      imageUrl: blob.url,
      blobPathname: blob.pathname,
      caption,
      tags,
      mediaType: kind,
    });

    return NextResponse.json({ ok: true, post }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload falhou";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
