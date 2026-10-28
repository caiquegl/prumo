import type { FeedItem } from "./types";

/** Converte photoUrl em data URL local. Se falhar, remove a foto (evita retângulo branco no Satori). */
export async function resolveFeedPhoto(item: FeedItem): Promise<FeedItem> {
  if (!item.photoUrl) {
    return { ...item, visual: item.visual || "mark" };
  }

  if (item.photoUrl.startsWith("data:image/")) {
    // data URL enorme costuma quebrar o ImageResponse → cai no visual
    if (item.photoUrl.length > 2_400_000) {
      console.error("[photo] data URL grande demais, usando visual");
      return { ...item, photoUrl: undefined, visual: item.visual || "wire" };
    }
    return item;
  }

  try {
    const res = await fetch(item.photoUrl, {
      headers: { Accept: "image/*" },
      signal: AbortSignal.timeout(18_000),
      redirect: "follow",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.byteLength < 800) throw new Error(`bytes=${bytes.byteLength}`);
    const ct = (res.headers.get("content-type") || "image/jpeg").split(";")[0].trim();
    if (!ct.startsWith("image/")) throw new Error(`content-type ${ct}`);
    if (bytes.byteLength > 1_800_000) {
      // ainda tenta; se estourar o OG, o catch do caller usa visual
      console.warn("[photo] imagem grande", bytes.byteLength);
    }
    return {
      ...item,
      photoUrl: `data:${ct};base64,${bytes.toString("base64")}`,
    };
  } catch (err) {
    console.error("[photo] resolve failed, fallback visual", err);
    return { ...item, photoUrl: undefined, visual: item.visual || "mark" };
  }
}
