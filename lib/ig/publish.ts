import { inspectToken, resolvePageToken } from "./auth";

const API = "https://graph.facebook.com/v26.0";

type GraphError = { error?: { message?: string; code?: number; type?: string } };

async function call(method: "GET" | "POST", path: string, params: Record<string, string>) {
  const token = await resolvePageToken();
  const body = new URLSearchParams({ ...params, access_token: token });
  const res =
    method === "GET"
      ? await fetch(`${API}/${path}?${body}`)
      : await fetch(`${API}/${path}`, { method, body });
  const json = (await res.json()) as GraphError & Record<string, string>;
  if (!res.ok || json.error) {
    throw new Error(`${method} ${path} -> ${res.status}: ${JSON.stringify(json.error ?? json)}`);
  }
  return json;
}

export function igUserId() {
  return process.env.IG_USER_ID || "17841427877735853";
}

export async function account() {
  return call("GET", igUserId(), { fields: "username,media_count" });
}

export async function recentCaptions(limit = 40) {
  const json = await call("GET", `${igUserId()}/media`, {
    fields: "caption,timestamp",
    limit: String(limit),
  });
  const data = (json as { data?: Array<{ caption?: string }> }).data ?? [];
  return data.map((m) => m.caption || "");
}

async function waitContainer(container: string, attempts = 48, delayMs = 3000) {
  for (let i = 0; i < attempts; i++) {
    const { status_code, status } = await call("GET", container, { fields: "status_code,status" });
    if (status_code === "FINISHED") return;
    if (status_code === "ERROR" || status_code === "EXPIRED") {
      throw new Error(`container ${container}: ${status || status_code}`);
    }
    if (i === attempts - 1) throw new Error(`container ${container} não ficou pronto a tempo`);
    await new Promise((r) => setTimeout(r, delayMs));
  }
}

export async function publishImage(imageUrl: string, caption: string) {
  const igId = igUserId();
  const { id: container } = await call("POST", `${igId}/media`, { image_url: imageUrl, caption });
  await waitContainer(container);
  const { id } = await call("POST", `${igId}/media_publish`, { creation_id: container });
  const { permalink } = await call("GET", id, { fields: "permalink" });
  return { id, permalink };
}

/** Reel vertical (9:16) a partir de video_url público. */
export async function publishVideo(videoUrl: string, caption: string) {
  const igId = igUserId();
  const { id: container } = await call("POST", `${igId}/media`, {
    media_type: "REELS",
    video_url: videoUrl,
    caption,
    share_to_feed: "true",
  });
  await waitContainer(container, 60, 4000);
  const { id } = await call("POST", `${igId}/media_publish`, { creation_id: container });
  const { permalink } = await call("GET", id, { fields: "permalink" });
  return { id, permalink };
}

/** Carrossel de 2–10 imagens (Graph media_type=CAROUSEL). */
export async function publishCarousel(imageUrls: string[], caption: string) {
  if (imageUrls.length < 2 || imageUrls.length > 10) {
    throw new Error("Carrossel precisa de 2 a 10 imagens");
  }
  const igId = igUserId();
  const childIds: string[] = [];
  for (const url of imageUrls) {
    const { id } = await call("POST", `${igId}/media`, {
      image_url: url,
      is_carousel_item: "true",
    });
    await waitContainer(id);
    childIds.push(id);
  }
  const { id: container } = await call("POST", `${igId}/media`, {
    media_type: "CAROUSEL",
    children: childIds.join(","),
    caption,
  });
  await waitContainer(container);
  const { id } = await call("POST", `${igId}/media_publish`, { creation_id: container });
  const { permalink } = await call("GET", id, { fields: "permalink" });
  return { id, permalink };
}

export async function publishQueueMedia(input: {
  mediaType: "image" | "video" | "carousel";
  mediaUrl: string;
  caption: string;
  children?: string[];
}) {
  if (input.mediaType === "video") {
    return publishVideo(input.mediaUrl, input.caption);
  }
  if (input.mediaType === "carousel") {
    const urls = input.children?.length ? input.children : [input.mediaUrl];
    return publishCarousel(urls, input.caption);
  }
  return publishImage(input.mediaUrl, input.caption);
}

export async function debugToken() {
  const token = await resolvePageToken();
  return inspectToken(token);
}
