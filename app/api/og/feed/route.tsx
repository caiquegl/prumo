import { ImageResponse } from "next/og";
import { bank } from "@/lib/ig/content";
import { FeedCard } from "@/lib/ig/FeedCard";
import { loadFonts } from "@/lib/ig/fonts";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const layout = url.searchParams.get("layout");
  const id =
    url.searchParams.get("id") ||
    (layout ? bank.find((it) => it.layout === layout)?.id : undefined) ||
    bank[0]?.id;
  const inverted = url.searchParams.get("dark") === "1";
  const item = bank.find((it) => it.id === id);
  if (!item) return new Response("conteúdo não encontrado", { status: 404 });
  const fonts = await loadFonts();
  return new ImageResponse(<FeedCard item={item} inverted={inverted} />, {
    width: 1080,
    height: 1350,
    fonts,
  });
}
