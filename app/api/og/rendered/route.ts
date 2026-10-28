import { getDraft } from "@/lib/ig/store";

/** Serve PNG já composto (salvo no draft) — fallback quando o Vercel Blob falha. */
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return new Response("id ausente", { status: 400 });
  const draft = await getDraft(id);
  if (!draft) return new Response("draft não encontrado", { status: 404 });
  const payload = draft.payload as { __renderedPng?: string };
  const b64 = payload?.__renderedPng;
  if (!b64) return new Response("png ausente", { status: 404 });
  const bytes = Buffer.from(b64, "base64");
  return new Response(bytes, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400, immutable",
    },
  });
}
