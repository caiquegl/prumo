import { ImageResponse } from "next/og";
import { loadFonts } from "./fonts";
import { TypeOverlay, type TextZone } from "./TypeOverlay";

export async function renderTypedPost(input: {
  backgroundUrl: string;
  headline: string;
  sub?: string;
  zone: TextZone;
  lightText?: boolean;
}): Promise<Buffer> {
  const fonts = await loadFonts();
  const res = new ImageResponse(
    (
      <TypeOverlay
        backgroundUrl={input.backgroundUrl}
        headline={input.headline}
        sub={input.sub}
        zone={input.zone}
        lightText={input.lightText !== false}
      />
    ),
    { width: 1080, height: 1350, fonts },
  );
  return Buffer.from(await res.arrayBuffer());
}
