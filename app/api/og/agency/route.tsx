import { ImageResponse } from "next/og";
import { FeedCard } from "@/lib/ig/FeedCard";
import { loadFonts } from "@/lib/ig/fonts";
import { getDraft } from "@/lib/ig/store";
import type { FeedItem } from "@/lib/ig/types";

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return new Response("id ausente", { status: 400 });
  const draft = await getDraft(id);
  if (!draft) return new Response("draft não encontrado", { status: 404 });
  const item = draft.payload as FeedItem;
  const fonts = await loadFonts();
  return new ImageResponse(<FeedCard item={item} inverted={draft.dark} />, {
    width: 1080,
    height: 1350,
    fonts,
  });
}
