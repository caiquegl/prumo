import { db } from "@/lib/db";
import { ensureSchema } from "./store";

export type QueueStatus = "pending" | "publishing" | "published" | "failed";

export type MediaKind = "image" | "video" | "carousel";

export type QueuePost = {
  id: number;
  image_url: string;
  blob_pathname: string | null;
  caption: string | null;
  tags: string[] | null;
  media_type: MediaKind;
  children: string[] | null;
  status: QueueStatus;
  sort_order: number;
  published_at: string | null;
  media_id: string | null;
  permalink: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
};

let queueReady = false;

export async function ensureQueueSchema() {
  await ensureSchema();
  if (queueReady) return;
  const sql = db();
  await sql`
    CREATE TABLE IF NOT EXISTS ig_queue (
      id SERIAL PRIMARY KEY,
      image_url TEXT NOT NULL,
      blob_pathname TEXT,
      caption TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      sort_order INTEGER NOT NULL DEFAULT 0,
      published_at TIMESTAMPTZ,
      media_id TEXT,
      permalink TEXT,
      error TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
  await sql`ALTER TABLE ig_queue ADD COLUMN IF NOT EXISTS media_type TEXT NOT NULL DEFAULT 'image'`;
  await sql`ALTER TABLE ig_queue ADD COLUMN IF NOT EXISTS tags JSONB`;
  await sql`ALTER TABLE ig_queue ADD COLUMN IF NOT EXISTS children JSONB`;
  await sql`CREATE INDEX IF NOT EXISTS ig_queue_status_sort_idx ON ig_queue (status, sort_order ASC, id ASC)`;
  queueReady = true;
}

export async function listQueuePosts(opts?: { status?: QueueStatus | "all" }): Promise<QueuePost[]> {
  await ensureQueueSchema();
  const status = opts?.status || "all";
  if (status === "all") {
    return (await db()`
      SELECT * FROM ig_queue
      ORDER BY
        CASE status
          WHEN 'pending' THEN 0
          WHEN 'publishing' THEN 1
          WHEN 'failed' THEN 2
          ELSE 3
        END,
        sort_order ASC,
        id ASC
    `) as QueuePost[];
  }
  return (await db()`
    SELECT * FROM ig_queue
    WHERE status = ${status}
    ORDER BY sort_order ASC, id ASC
  `) as QueuePost[];
}

export async function getQueuePost(id: number): Promise<QueuePost | null> {
  await ensureQueueSchema();
  const rows = (await db()`SELECT * FROM ig_queue WHERE id = ${id} LIMIT 1`) as QueuePost[];
  return rows[0] ?? null;
}

export async function nextSortOrder(): Promise<number> {
  await ensureQueueSchema();
  const rows = (await db()`SELECT COALESCE(MAX(sort_order), 0) + 1 AS n FROM ig_queue`) as Array<{ n: number }>;
  return Number(rows[0]?.n || 1);
}

export function httpUrls(raw: unknown): string[] {
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of list) {
    const url = String(item || "").trim();
    if (!/^https?:\/\//i.test(url) || seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out;
}

export function carouselUrls(post: Pick<QueuePost, "media_type" | "image_url" | "children">): string[] {
  const kids = httpUrls(post.children);
  if (post.media_type === "carousel" && kids.length >= 2) return kids;
  return post.image_url ? [post.image_url] : [];
}

function parseMediaKind(raw: unknown, childCount: number): MediaKind {
  if (raw === "video") return "video";
  if (raw === "carousel" || childCount >= 2) return "carousel";
  return "image";
}

export async function createQueuePost(input: {
  imageUrl: string;
  blobPathname?: string | null;
  caption?: string | null;
  tags?: string[] | null;
  mediaType?: MediaKind;
  children?: string[] | null;
}): Promise<QueuePost> {
  await ensureQueueSchema();
  const order = await nextSortOrder();
  const tagsJson = input.tags?.length ? JSON.stringify(input.tags) : null;
  const children = httpUrls(input.children);
  const mediaType = parseMediaKind(input.mediaType, children.length);
  if (mediaType === "carousel" && (children.length < 2 || children.length > 10)) {
    throw new Error("Carrossel precisa de 2 a 10 imagens");
  }
  const childrenJson = mediaType === "carousel" ? JSON.stringify(children) : null;
  const cover = mediaType === "carousel" ? children[0]! : input.imageUrl;
  const rows = (await db()`
    INSERT INTO ig_queue (image_url, blob_pathname, caption, tags, media_type, children, status, sort_order)
    VALUES (
      ${cover},
      ${input.blobPathname || null},
      ${input.caption || null},
      ${tagsJson}::jsonb,
      ${mediaType},
      ${childrenJson}::jsonb,
      'pending',
      ${order}
    )
    RETURNING *
  `) as QueuePost[];
  return rows[0]!;
}

export async function updateQueuePost(
  id: number,
  input: { caption?: string | null; tags?: string[] | null },
): Promise<QueuePost | null> {
  await ensureQueueSchema();
  const current = await getQueuePost(id);
  if (!current) return null;
  const caption = input.caption !== undefined ? input.caption : current.caption;
  const tagsJson =
    input.tags !== undefined
      ? input.tags?.length
        ? JSON.stringify(input.tags)
        : null
      : current.tags
        ? JSON.stringify(current.tags)
        : null;
  const rows = (await db()`
    UPDATE ig_queue
    SET caption = ${caption}, tags = ${tagsJson}::jsonb, updated_at = now()
    WHERE id = ${id}
    RETURNING *
  `) as QueuePost[];
  return rows[0] ?? null;
}

export async function deleteQueuePost(id: number): Promise<QueuePost | null> {
  await ensureQueueSchema();
  const rows = (await db()`DELETE FROM ig_queue WHERE id = ${id} RETURNING *`) as QueuePost[];
  return rows[0] ?? null;
}

/** Reabre itens travados em publishing (crash/timeout do worker). */
export async function reclaimStalePublishing(minutes = 20): Promise<number> {
  await ensureQueueSchema();
  const mins = Math.max(5, Math.min(180, Math.floor(minutes)));
  const rows = (await db()`
    UPDATE ig_queue
    SET status = 'pending', error = COALESCE(error, 'reclaim: publishing stale'), updated_at = now()
    WHERE status = 'publishing'
      AND updated_at < now() - make_interval(mins => ${mins})
    RETURNING id
  `) as Array<{ id: number }>;
  return rows.length;
}

/** Claim de um item específico (publicação manual). */
export async function claimQueuePost(id: number): Promise<QueuePost | null> {
  await ensureQueueSchema();
  const rows = (await db()`
    UPDATE ig_queue
    SET status = 'publishing', error = null, updated_at = now()
    WHERE id = ${id} AND status IN ('pending', 'failed')
    RETURNING *
  `) as QueuePost[];
  return rows[0] ?? null;
}

/** Próximo pendente na sequência (cron). */
export async function claimNextPending(): Promise<QueuePost | null> {
  await ensureQueueSchema();
  await reclaimStalePublishing(20);
  const rows = (await db()`
    UPDATE ig_queue
    SET status = 'publishing', error = null, updated_at = now()
    WHERE id = (
      SELECT id FROM ig_queue
      WHERE status = 'pending'
      ORDER BY sort_order ASC, id ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *
  `) as QueuePost[];
  return rows[0] ?? null;
}

export async function markQueuePublished(
  id: number,
  input: { mediaId: string; permalink: string },
): Promise<QueuePost | null> {
  await ensureQueueSchema();
  const rows = (await db()`
    UPDATE ig_queue
    SET
      status = 'published',
      media_id = ${input.mediaId},
      permalink = ${input.permalink},
      published_at = now(),
      error = null,
      updated_at = now()
    WHERE id = ${id}
    RETURNING *
  `) as QueuePost[];
  return rows[0] ?? null;
}

export async function markQueueFailed(id: number, error: string): Promise<QueuePost | null> {
  await ensureQueueSchema();
  const rows = (await db()`
    UPDATE ig_queue
    SET status = 'failed', error = ${error.slice(0, 2000)}, updated_at = now()
    WHERE id = ${id}
    RETURNING *
  `) as QueuePost[];
  return rows[0] ?? null;
}

function normalizeTags(tags: unknown): string[] {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags.map(String);
  if (typeof tags === "string") {
    try {
      const parsed = JSON.parse(tags) as unknown;
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      return tags.split(",").map((t) => t.trim()).filter(Boolean);
    }
  }
  return [];
}

/** Monta legenda final com hashtags das tags (sem duplicar). */
export function captionWithTags(caption: string | null | undefined, tags: unknown): string {
  const base = (caption || "").trim();
  const list = normalizeTags(tags)
    .map((t) => t.replace(/^#/, "").trim())
    .filter(Boolean);
  if (!list.length) return base;
  const lower = base.toLowerCase();
  const missing = list.filter((t) => !lower.includes(`#${t.toLowerCase()}`));
  if (!missing.length) return base;
  const hashLine = missing.map((t) => `#${t}`).join(" ");
  return base ? `${base}\n\n${hashLine}` : hashLine;
}
