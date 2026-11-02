import { put } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";
import { polishCaption } from "@/lib/ig/caption";
import { hashtagsForCaption } from "@/lib/ig/hashtags";
import { createQueuePost, httpUrls, type MediaKind } from "@/lib/ig/queue";

const IMAGE_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"]);
const VIDEO_TYPES = new Set(["video/mp4", "video/quicktime", "video/webm"]);

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function checkAuth(req: NextRequest) {
  const secrets = [
    process.env.UPLOAD_SECRET,
    process.env.QUEUE_API_SECRET,
    process.env.ADMIN_PASSWORD,
    process.env.CRON_SECRET,
  ]
    .map((s) => s?.trim())
    .filter(Boolean) as string[];

  // Sem secret: libera (dev). Em prod configure UPLOAD_SECRET ou QUEUE_API_SECRET.
  if (!secrets.length) return true;

  const header = req.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const query = req.nextUrl.searchParams.get("token") || "";
  return Boolean(token && secrets.includes(token)) || Boolean(query && secrets.includes(query));
}

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

function mediaKind(type: string): "image" | "video" | null {
  if (IMAGE_TYPES.has(type)) return "image";
  if (VIDEO_TYPES.has(type)) return "video";
  return null;
}

async function putFile(file: File, folder: string) {
  const original = file.name.replace(/[^a-zA-Z0-9._-]/g, "_") || "upload.bin";
  const pathname = `${folder}/${Date.now()}-${original}`;
  const blob = await put(pathname, file, {
    access: "public",
    contentType: file.type,
    addRandomSuffix: true,
  });
  return {
    url: blob.url,
    pathname: blob.pathname,
    contentType: blob.contentType || file.type,
    size: file.size,
  };
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) return unauthorized();

  try {
    const ctype = req.headers.get("content-type") || "";

    // JSON: só URL pública → opcionalmente enfileira
    if (ctype.includes("application/json")) {
      const body = (await req.json()) as {
        url?: string;
        imageUrl?: string;
        children?: unknown;
        caption?: string;
        tags?: string[] | string;
        mediaType?: MediaKind;
        enqueue?: boolean;
      };
      const children = httpUrls([body.url || body.imageUrl, ...(Array.isArray(body.children) ? body.children : [])]);
      const imageUrl = children[0] || "";
      if (!/^https?:\/\//i.test(imageUrl)) {
        return NextResponse.json({ error: "url/imageUrl http(s) obrigatória" }, { status: 400 });
      }

      const enqueue = body.enqueue !== false;
      if (!enqueue) {
        return NextResponse.json({ ok: true, url: imageUrl, children: children.length > 1 ? children : undefined });
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
      const tags =
        mediaType === "story"
          ? null
          : rawTags?.length
            ? rawTags
            : hashtagsForCaption(captionRaw || "", mediaType);

      const post = await createQueuePost({
        imageUrl,
        caption,
        tags,
        mediaType,
        children: mediaType === "carousel" ? children : null,
      });
      return NextResponse.json({ ok: true, queued: true, post, url: imageUrl }, { status: 201 });
    }

    const form = await req.formData();
    const files = form
      .getAll("file")
      .filter((item): item is File => item instanceof File && item.size > 0);

    if (!files.length) {
      return NextResponse.json(
        { error: 'Envie multipart com "file" (1+ imagens ou 1 vídeo) ou JSON com url' },
        { status: 400 },
      );
    }

    const folderRaw = String(form.get("folder") || "ig-queue").trim() || "ig-queue";
    const folder = folderRaw.replace(/[^a-zA-Z0-9/_-]/g, "") || "ig-queue";
    const enqueue =
      String(form.get("enqueue") || "1") !== "0" && String(form.get("enqueue") || "").toLowerCase() !== "false";
    const asStory =
      String(form.get("asStory") || "") === "1" || String(form.get("mediaType") || "") === "story";
    const captionRaw = String(form.get("caption") || "").trim() || null;
    const rawTags = parseTags(form.get("tags"));

    for (const file of files) {
      if (!mediaKind(file.type)) {
        return NextResponse.json(
          {
            error: `Tipo não permitido: ${file.type || "unknown"}. Use jpeg/png/webp/gif ou mp4/mov/webm.`,
          },
          { status: 400 },
        );
      }
      const max = VIDEO_TYPES.has(file.type) ? 80 * 1024 * 1024 : 12 * 1024 * 1024;
      if (file.size > max) {
        return NextResponse.json(
          { error: VIDEO_TYPES.has(file.type) ? "Vídeo maior que 80MB" : "Arquivo maior que 12MB" },
          { status: 400 },
        );
      }
    }

    if (files.length > 1) {
      if (asStory) {
        return NextResponse.json({ error: "Story aceita um único arquivo" }, { status: 400 });
      }
      if (files.length > 10) {
        return NextResponse.json({ error: "Carrossel aceita no máximo 10 imagens" }, { status: 400 });
      }
      if (files.some((f) => mediaKind(f.type) !== "image")) {
        return NextResponse.json({ error: "Carrossel só com imagens" }, { status: 400 });
      }

      const uploaded = [];
      for (const file of files) uploaded.push(await putFile(file, folder));
      const urls = uploaded.map((u) => u.url);

      if (!enqueue) {
        return NextResponse.json({ ok: true, files: uploaded, urls });
      }

      const caption = polishCaption(captionRaw, { mediaType: "carousel", tags: rawTags });
      const tags = rawTags?.length ? rawTags : hashtagsForCaption(captionRaw || "", "carousel");
      const post = await createQueuePost({
        imageUrl: urls[0]!,
        blobPathname: uploaded[0]?.pathname || null,
        caption,
        tags,
        mediaType: "carousel",
        children: urls,
      });
      return NextResponse.json({ ok: true, queued: true, post, files: uploaded }, { status: 201 });
    }

    const file = files[0]!;
    const kind = mediaKind(file.type)!;
    const uploaded = await putFile(file, folder);
    const mediaType: MediaKind = asStory ? "story" : kind === "video" ? "video" : "image";

    if (!enqueue) {
      return NextResponse.json({ ok: true, ...uploaded });
    }

    const caption =
      mediaType === "story" ? captionRaw : polishCaption(captionRaw, { mediaType, tags: rawTags });
    const tags =
      mediaType === "story"
        ? null
        : rawTags?.length
          ? rawTags
          : hashtagsForCaption(captionRaw || "", mediaType);

    const post = await createQueuePost({
      imageUrl: uploaded.url,
      blobPathname: uploaded.pathname,
      caption,
      tags,
      mediaType,
    });

    return NextResponse.json({ ok: true, queued: true, post, ...uploaded }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload falhou";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: "POST /api/upload",
    auth: "Bearer UPLOAD_SECRET | QUEUE_API_SECRET | ADMIN_PASSWORD (ou ?token=)",
    multipart: {
      file: "imagem(ns) ou 1 vídeo",
      folder: "opcional (default ig-queue)",
      enqueue: "1 (default) enfileira no Instagram; 0 = só sobe pro Blob",
      asStory: "1 = media_type story",
      caption: "opcional",
      tags: "até 5, separadas por vírgula",
    },
    json: {
      url: "https://...",
      children: ["url2", "url3"],
      mediaType: "image|video|carousel|story",
      caption: "...",
      tags: ["webprumo", "siteparaempresa"],
      enqueue: true,
    },
  });
}
