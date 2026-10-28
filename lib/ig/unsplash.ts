export type UnsplashPhoto = {
  id: string;
  url: string;
  thumb: string;
  downloadLocation: string;
  photographer: string;
  photographerUrl: string;
  query: string;
};

export async function findPortraitPhoto(query: string, excludeIds: string[] = []): Promise<UnsplashPhoto | null> {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) return null;

  const qs = new URLSearchParams({
    query,
    orientation: "portrait",
    content_filter: "high",
    per_page: "12",
  });
  const res = await fetch(`https://api.unsplash.com/search/photos?${qs}`, {
    headers: { Authorization: `Client-ID ${key}`, "Accept-Version": "v1" },
  });
  if (!res.ok) {
    console.error("[unsplash]", res.status, await res.text());
    return null;
  }
  const json = (await res.json()) as {
    results?: Array<{
      id: string;
      urls: { raw: string; regular: string; small: string };
      links: { download_location: string };
      user: { name: string; links: { html: string } };
    }>;
  };
  const hit = (json.results || []).find((p) => !excludeIds.includes(p.id));
  if (!hit) return null;

  return {
    id: hit.id,
    url: `${hit.urls.raw}&w=1200&h=1500&fit=crop&crop=entropy&q=80&fm=jpg`,
    thumb: hit.urls.small,
    downloadLocation: hit.links.download_location,
    photographer: hit.user.name,
    photographerUrl: hit.user.links.html,
    query,
  };
}

/** Unsplash guideline: trigger download when using a photo in production. */
export async function trackUnsplashDownload(downloadLocation: string) {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key || !downloadLocation) return;
  try {
    await fetch(downloadLocation, {
      headers: { Authorization: `Client-ID ${key}`, "Accept-Version": "v1" },
    });
  } catch (err) {
    console.error("[unsplash] download track failed", err);
  }
}
