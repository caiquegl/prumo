import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const url = env.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
if (!url) throw new Error("DATABASE_URL missing in .env.local");

const sql = neon(url);
await sql`CREATE TABLE IF NOT EXISTS ig_auth (
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
await sql`CREATE TABLE IF NOT EXISTS ig_publications (
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
await sql`CREATE TABLE IF NOT EXISTS ig_logs (
  id SERIAL PRIMARY KEY,
  level TEXT NOT NULL,
  event TEXT NOT NULL,
  message TEXT,
  detail JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
)`;
await sql`CREATE INDEX IF NOT EXISTS ig_logs_created_at_idx ON ig_logs (created_at DESC)`;
await sql`CREATE INDEX IF NOT EXISTS ig_publications_published_at_idx ON ig_publications (published_at DESC)`;
const tables = await sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`;
console.log("ok", tables.map((t) => t.tablename).join(","));
