/**
 * JSON2Video — animação programática (fase 2: reels Terra/Prisma-like).
 * Free tier ~600s. Feed estático usa SceneCompose; este módulo prepara motion.
 */

export type J2VElement = Record<string, unknown>;

export type J2VMovie = {
  resolution?: string;
  width?: number;
  height?: number;
  quality?: string;
  scenes: Array<{ duration?: number; elements: J2VElement[] }>;
};

export function json2videoConfigured() {
  return Boolean(process.env.JSON2VIDEO_API_KEY);
}

export async function createMovie(movie: J2VMovie): Promise<{ project: string } | null> {
  const key = process.env.JSON2VIDEO_API_KEY;
  if (!key) return null;
  const res = await fetch("https://api.json2video.com/v2/movies", {
    method: "POST",
    headers: { "x-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify(movie),
  });
  const json = (await res.json()) as { success?: boolean; project?: string; message?: string };
  if (!res.ok || !json.project) {
    console.error("[json2video] create failed", res.status, json);
    return null;
  }
  return { project: json.project };
}

export async function getMovie(project: string): Promise<{
  status: string;
  url?: string;
  error?: string;
} | null> {
  const key = process.env.JSON2VIDEO_API_KEY;
  if (!key) return null;
  const res = await fetch(`https://api.json2video.com/v2/movies?project=${encodeURIComponent(project)}`, {
    headers: { "x-api-key": key },
  });
  const json = (await res.json()) as {
    movie?: { status?: string; url?: string; error?: string };
  };
  if (!res.ok || !json.movie) {
    console.error("[json2video] status failed", res.status, json);
    return null;
  }
  return {
    status: String(json.movie.status || "unknown"),
    url: json.movie.url,
    error: json.movie.error,
  };
}

export async function waitForMovie(
  project: string,
  opts?: { timeoutMs?: number; pollMs?: number },
): Promise<{ url: string } | null> {
  const timeout = opts?.timeoutMs ?? 180_000;
  const poll = opts?.pollMs ?? 5_000;
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const st = await getMovie(project);
    if (!st) return null;
    if (st.status === "done" && st.url) return { url: st.url };
    if (st.status === "error" || st.status === "timeout") {
      console.error("[json2video] render error", st);
      return null;
    }
    await new Promise((r) => setTimeout(r, poll));
  }
  return null;
}

/**
 * Reel curto a partir de arte estática + tipografia (placeholder de motion).
 * Não é chamado no cron de feed ainda — fase 2.
 */
export async function renderSceneReel(input: {
  artUrl: string;
  headline: string;
  sub?: string;
  durationSec?: number;
}): Promise<{ url: string; project: string } | null> {
  const duration = input.durationSec ?? 6;
  const created = await createMovie({
    resolution: "instagram-story",
    width: 1080,
    height: 1920,
    quality: "high",
    scenes: [
      {
        duration,
        elements: [
          {
            type: "image",
            src: input.artUrl,
            resize: "cover",
            duration,
            zoom: 1.08,
          },
          {
            type: "text",
            text: input.headline,
            duration,
            style: "001",
            settings: {
              "font-size": "64px",
              "font-color": "#ffffff",
              "text-align": "center",
              "vertical-position": "70%",
            },
          },
          ...(input.sub
            ? [
                {
                  type: "text",
                  text: input.sub,
                  duration,
                  style: "001",
                  settings: {
                    "font-size": "32px",
                    "font-color": "#e5e7eb",
                    "text-align": "center",
                    "vertical-position": "82%",
                  },
                } as J2VElement,
              ]
            : []),
        ],
      },
    ],
  });
  if (!created) return null;
  const done = await waitForMovie(created.project);
  if (!done) return null;
  return { url: done.url, project: created.project };
}
