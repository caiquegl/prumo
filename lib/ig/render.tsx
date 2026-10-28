import { ImageResponse } from "next/og";
import { FeedCard } from "./FeedCard";
import { loadFonts } from "./fonts";
import { resolveFeedPhoto } from "./photo";
import type { FeedItem } from "./types";

export async function renderFeedImage(item: FeedItem, inverted = false) {
  const fonts = await loadFonts();
  const resolved = await resolveFeedPhoto(item);
  const res = new ImageResponse(<FeedCard item={resolved} inverted={inverted} />, {
    width: 1080,
    height: 1350,
    fonts,
  });
  return Buffer.from(await res.arrayBuffer());
}
