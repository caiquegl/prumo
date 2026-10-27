import { put } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";

const ALLOWED = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
]);

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function checkAuth(req: NextRequest) {
  const secret = process.env.UPLOAD_SECRET;
  if (!secret) return true;
  const header = req.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const query = req.nextUrl.searchParams.get("token") || "";
  return token === secret || query === secret;
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) return unauthorized();

  try {
    const form = await req.formData();
    const file = form.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: 'Envie multipart/form-data com campo "file"' },
        { status: 400 },
      );
    }

    if (!ALLOWED.has(file.type)) {
      return NextResponse.json(
        {
          error: `Tipo não permitido: ${file.type || "unknown"}. Use jpeg, png, webp ou gif.`,
        },
        { status: 400 },
      );
    }

    const maxBytes = 8 * 1024 * 1024;
    if (file.size > maxBytes) {
      return NextResponse.json(
        { error: "Arquivo maior que 8MB" },
        { status: 400 },
      );
    }

    const folder = (form.get("folder") as string | null)?.trim() || "ig";
    const safeFolder = folder.replace(/[^a-zA-Z0-9/_-]/g, "") || "ig";
    const original = file.name.replace(/[^a-zA-Z0-9._-]/g, "_") || "upload.jpg";
    const pathname = `${safeFolder}/${Date.now()}-${original}`;

    const blob = await put(pathname, file, {
      access: "public",
      contentType: file.type,
      addRandomSuffix: false,
    });

    return NextResponse.json({
      url: blob.url,
      pathname: blob.pathname,
      contentType: blob.contentType,
      size: file.size,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload falhou";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: "POST /api/upload",
    fields: { file: "imagem (multipart)", folder: "opcional, default ig" },
    auth: "Header Authorization: Bearer <UPLOAD_SECRET> se configurado",
  });
}
