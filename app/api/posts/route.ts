import { put } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/guard";
import { polishCaption } from "@/lib/ig/caption";
import { hashtagsForCaption } from "@/lib/ig/hashtags";
import { createQueuePost, httpUrls, listQueuePosts, type MediaKind } from "@/lib/ig/queue";

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
        return arr.map(String).map((t) => t.replace(/^#/, "").trim()).filter(Boolean).slice(0, 5);
      }
    }
  } catch {
    /* fall through */
  }
  return text
    .split(/[\s,]+/)
    .map((t) => t.replace(/^#/, "").trim())
    .filter(Boolean)
    .slice(0, 5);
}

function resolveTags(caption: string | null, tags: string[] | null, mediaType: MediaKind): string[] | null {
  if (mediaType === "story") return null;
  if (tags?.length) return tags.slice(0, 5);
  if (!caption) return hashtagsForCaption("", mediaType);
  return hashtagsForCaption(caption, mediaType);
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
    const ctype = req.headers.get("content-type") || "";

    // JSON: { imageUrl, children?, caption?, tags?, mediaType? } — agente pode apontar URL pública
    if (ctype.includes("application/json")) {
      const body = (await req.json()) as {
        imageUrl?: string;
        children?: unknown;
        caption?: string;
        tags?: string[] | string;
        mediaType?: MediaKind;
      };
      const children = httpUrls([body.imageUrl, ...(Array.isArray(body.children) ? body.children : [])]);
      const imageUrl = children[0] || String(body.imageUrl || "").trim();
      if (!/^https?:\/\//i.test(imageUrl)) {
        return NextResponse.json({ error: "imageUrl http(s) obrigatória" }, { status: 400 });
      }
      const rawTags =
        typeof body.tags === "string"
          ? parseTags(body.tags)
          : Array.isArray(body.tags)
            ? body.tags.map(String).map((t) => t.replace(/^#/, "").trim()).filter(Boolean).slice(0, 5)
            : null;
      const mediaType: MediaKind =
        body.mediaType === "story"
          ? "story"
          : body.mediaType === "video"
            ? "video"
            : body.mediaType === "carousel" || children.length >= 2
              ? "carousel"
              : "image";
      const captionRaw = body.caption?.trim() || null;
      const caption =
        mediaType === "story" ? captionRaw : polishCaption(captionRaw, { mediaType, tags: rawTags });
      const tags = resolveTags(captionRaw, rawTags, mediaType);
      const post = await createQueuePost({
        imageUrl,
        blobPathname: null,
        caption,
        tags,
        mediaType,
        children: mediaType === "carousel" ? children : null,
      });
      return NextResponse.json({ ok: true, post }, { status: 201 });
    }

    const form = await req.formData();
    const files = form
      .getAll("file")
      .filter((item): item is File => item instanceof File && item.size > 0);
    const asStory = String(form.get("asStory") || "") === "1" || String(form.get("mediaType") || "") === "story";
    const captionRaw = String(form.get("caption") || "").trim() || null;
    const rawTags = parseTags(form.get("tags"));

    if (!files.length) {
      return NextResponse.json({ error: 'Envie multipart com "file" ou JSON com imageUrl' }, { status: 400 });
    }

    if (files.length > 1) {
      if (files.length > 10) {
        return NextResponse.json({ error: "Carrossel aceita no máximo 10 imagens" }, { status: 400 });
      }
      if (files.some((file) => mediaKind(file.type) !== "image")) {
        return NextResponse.json({ error: "Carrossel só com imagens (jpeg/png/webp/gif)" }, { status: 400 });
      }
      const urls: string[] = [];
      let firstPath: string | null = null;
      for (const [index, file] of files.entries()) {
        if (file.size > 12 * 1024 * 1024) {
          return NextResponse.json({ error: "Arquivo maior que 12MB" }, { status: 400 });
        }
        const original = file.name.replace(/[^a-zA-Z0-9._-]/g, "_") || `slide-${index + 1}.jpg`;
        const blob = await put(`ig-queue/${Date.now()}-${original}`, file, {
          access: "public",
          contentType: file.type,
          addRandomSuffix: true,
        });
        urls.push(blob.url);
        if (!firstPath) firstPath = blob.pathname;
      }
      if (asStory) {
        return NextResponse.json({ error: "Story aceita um único arquivo (foto ou vídeo)" }, { status: 400 });
      }
      const caption = polishCaption(captionRaw, { mediaType: "carousel", tags: rawTags });
      const tags = resolveTags(captionRaw, rawTags, "carousel");
      const post = await createQueuePost({
        imageUrl: urls[0]!,
        blobPathname: firstPath,
        caption,
        tags,
        mediaType: "carousel",
        children: urls,
      });
      return NextResponse.json({ ok: true, post }, { status: 201 });
    }

    const file = files[0]!;
    const kind = mediaKind(file.type);
    if (!kind) {
      return NextResponse.json(
        { error: `Tipo não permitido: ${file.type}. Use imagem (jpeg/png/webp/gif) ou vídeo (mp4/mov/webm).` },
        { status: 400 },
      );
    }

    const mediaType: MediaKind = asStory ? "story" : kind;
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

    const caption =
      mediaType === "story" ? captionRaw : polishCaption(captionRaw, { mediaType, tags: rawTags });
    const tags = resolveTags(captionRaw, rawTags, mediaType);
    const post = await createQueuePost({
      imageUrl: blob.url,
      blobPathname: blob.pathname,
      caption,
      tags,
      mediaType,
    });

    return NextResponse.json({ ok: true, post }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload falhou";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
