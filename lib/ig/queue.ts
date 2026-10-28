import { db } from "@/lib/db";
import { ensureSchema } from "./store";

export type QueueStatus = "pending" | "publishing" | "published" | "failed";

export type MediaKind = "image" | "video";

export type QueuePost = {
  id: number;
  image_url: string;
  blob_pathname: string | null;
  caption: string | null;
  tags: string[] | null;
  media_type: MediaKind;
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

export async function createQueuePost(input: {
  imageUrl: string;
  blobPathname?: string | null;
  caption?: string | null;
  tags?: string[] | null;
  mediaType?: MediaKind;
}): Promise<QueuePost> {
  await ensureQueueSchema();
  const order = await nextSortOrder();
  const tagsJson = input.tags?.length ? JSON.stringify(input.tags) : null;
  const mediaType = input.mediaType === "video" ? "video" : "image";
  const rows = (await db()`
    INSERT INTO ig_queue (image_url, blob_pathname, caption, tags, media_type, status, sort_order)
    VALUES (
      ${input.imageUrl},
      ${input.blobPathname || null},
      ${input.caption || null},
      ${tagsJson}::jsonb,
      ${mediaType},
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

/** Próximo pendente na sequência (para o cron — fase seguinte). */
export async function claimNextPending(): Promise<QueuePost | null> {
  await ensureQueueSchema();
  const rows = (await db()`
    UPDATE ig_queue
    SET status = 'publishing', updated_at = now()
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
