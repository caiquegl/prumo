import { db } from "@/lib/db";
import type { IgState, Layout, PublishRecord } from "./types";

export type AuthRow = {
  id: number;
  page_token: string;
  user_token: string | null;
  page_id: string | null;
  ig_user_id: string | null;
  page_name: string | null;
  user_expires_at: string | null;
  page_expires_at: string | null;
  refreshed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PublicationRow = {
  id: number;
  slot: string;
  item_id: string;
  title: string | null;
  layout: string | null;
  format: string;
  media_id: string | null;
  permalink: string | null;
  image_url: string | null;
  caption: string | null;
  dark: boolean | null;
  published_at: string;
};

export type LogRow = {
  id: number;
  level: string;
  event: string;
  message: string | null;
  detail: unknown;
  created_at: string;
};

let migrated = false;

export async function ensureSchema() {
  if (migrated) return;
  const sql = db();
  await sql`
    CREATE TABLE IF NOT EXISTS ig_auth (
      id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      page_token TEXT NOT NULL,
      user_token TEXT,
      page_id TEXT,
      ig_user_id TEXT,
      page_name TEXT,
      user_expires_at TIMESTAMPTZ,
      page_expires_at TIMESTAMPTZ,
      refreshed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS ig_publications (
      id SERIAL PRIMARY KEY,
      slot TEXT NOT NULL UNIQUE,
      item_id TEXT NOT NULL,
      title TEXT,
      layout TEXT,
      format TEXT NOT NULL DEFAULT 'post',
      media_id TEXT,
      permalink TEXT,
      image_url TEXT,
      caption TEXT,
      dark BOOLEAN DEFAULT false,
      published_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS ig_logs (
      id SERIAL PRIMARY KEY,
      level TEXT NOT NULL,
      event TEXT NOT NULL,
      message TEXT,
      detail JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
  await sql`CREATE INDEX IF NOT EXISTS ig_logs_created_at_idx ON ig_logs (created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS ig_publications_published_at_idx ON ig_publications (published_at DESC)`;
  migrated = true;
}

export async function logEvent(
  level: "info" | "warn" | "error",
  event: string,
  message: string,
  detail?: unknown,
) {
  try {
    await ensureSchema();
    await db()`
      INSERT INTO ig_logs (level, event, message, detail)
      VALUES (${level}, ${event}, ${message}, ${detail == null ? null : JSON.parse(JSON.stringify(detail))})`;
  } catch (err) {
    console.error("[ig-log]", level, event, message, err);
  }
}

export async function getAuth(): Promise<AuthRow | null> {
  await ensureSchema();
  const rows = (await db()`SELECT * FROM ig_auth WHERE id = 1 LIMIT 1`) as AuthRow[];
  return rows[0] ?? null;
}

export async function saveAuth(input: {
  pageToken: string;
  userToken?: string | null;
  pageId?: string | null;
  igUserId?: string | null;
  pageName?: string | null;
  userExpiresAt?: Date | null;
  pageExpiresAt?: Date | null;
}) {
  await ensureSchema();
  const userExpires = input.userExpiresAt?.toISOString() ?? null;
  const pageExpires = input.pageExpiresAt?.toISOString() ?? null;
  await db()`
    INSERT INTO ig_auth (
      id, page_token, user_token, page_id, ig_user_id, page_name,
      user_expires_at, page_expires_at, refreshed_at, updated_at
    )
    VALUES (
      1, ${input.pageToken}, ${input.userToken ?? null}, ${input.pageId ?? null},
      ${input.igUserId ?? null}, ${input.pageName ?? null},
      ${userExpires}, ${pageExpires}, now(), now()
    )
    ON CONFLICT (id) DO UPDATE SET
      page_token = EXCLUDED.page_token,
      user_token = COALESCE(EXCLUDED.user_token, ig_auth.user_token),
      page_id = COALESCE(EXCLUDED.page_id, ig_auth.page_id),
      ig_user_id = COALESCE(EXCLUDED.ig_user_id, ig_auth.ig_user_id),
      page_name = COALESCE(EXCLUDED.page_name, ig_auth.page_name),
      user_expires_at = EXCLUDED.user_expires_at,
      page_expires_at = EXCLUDED.page_expires_at,
      refreshed_at = now(),
      updated_at = now()`;
}

export async function listPublications(limit = 50): Promise<PublicationRow[]> {
  await ensureSchema();
  const rows = await db()`
    SELECT * FROM ig_publications
    ORDER BY published_at ASC
    LIMIT ${limit}`;
  return rows as PublicationRow[];
}

export async function insertPublication(input: {
  slot: string;
  itemId: string;
  title: string;
  layout: string;
  format?: string;
  mediaId?: string | null;
  permalink?: string | null;
  imageUrl?: string | null;
  caption?: string | null;
  dark?: boolean;
}) {
  await ensureSchema();
  await db()`
    INSERT INTO ig_publications (
      slot, item_id, title, layout, format, media_id, permalink, image_url, caption, dark
    )
    VALUES (
      ${input.slot}, ${input.itemId}, ${input.title}, ${input.layout},
      ${input.format ?? "post"}, ${input.mediaId ?? null}, ${input.permalink ?? null},
      ${input.imageUrl ?? null}, ${input.caption ?? null}, ${input.dark ?? false}
    )
    ON CONFLICT (slot) DO UPDATE SET
      item_id = EXCLUDED.item_id,
      title = EXCLUDED.title,
      layout = EXCLUDED.layout,
      format = EXCLUDED.format,
      media_id = EXCLUDED.media_id,
      permalink = EXCLUDED.permalink,
      image_url = EXCLUDED.image_url,
      caption = EXCLUDED.caption,
      dark = EXCLUDED.dark,
      published_at = now()`;
}

export async function listLogs(limit = 30): Promise<LogRow[]> {
  await ensureSchema();
  const rows = await db()`
    SELECT * FROM ig_logs
    ORDER BY created_at DESC
    LIMIT ${limit}`;
  return rows as LogRow[];
}

export async function publishedState(): Promise<IgState> {
  const rows = await listPublications(500);
  return {
    published: rows.map(
      (row): PublishRecord => ({
        slot: row.slot,
        id: row.item_id,
        title: row.title || row.item_id,
        layout: (row.layout || "hero") as Layout,
        format: row.format === "reel" ? "reel" : "post",
        media_id: row.media_id || undefined,
        permalink: row.permalink || undefined,
        published_at: row.published_at,
      }),
    ),
  };
}

export function publicAuth(row: AuthRow | null) {
  if (!row) return null;
  return {
    page_id: row.page_id,
    ig_user_id: row.ig_user_id,
    page_name: row.page_name,
    user_expires_at: row.user_expires_at,
    page_expires_at: row.page_expires_at,
    refreshed_at: row.refreshed_at,
    has_page_token: Boolean(row.page_token),
    has_user_token: Boolean(row.user_token),
    updated_at: row.updated_at,
  };
}
