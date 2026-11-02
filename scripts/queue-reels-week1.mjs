#!/usr/bin/env node
/**
 * Sobe os 7 Reels da semana 1 no Blob e enfileira (URL pública p/ Graph).
 * Uso:
 *   ADMIN_PASSWORD=… node scripts/queue-reels-week1.mjs
 *   PRUMO_URL=https://… QUEUE_API_SECRET=… node scripts/queue-reels-week1.mjs
 */
import { readFile } from "node:fs/promises";
import { basename, join } from "node:path";

const ROOT = "/home/hitss/prumo";
const base = (process.env.PRUMO_URL || "https://prumo-tawny.vercel.app").replace(/\/$/, "");
const token = process.env.QUEUE_API_SECRET || process.env.ADMIN_PASSWORD || process.env.UPLOAD_SECRET;
if (!token) {
  console.error("Defina QUEUE_API_SECRET, ADMIN_PASSWORD ou UPLOAD_SECRET");
  process.exit(1);
}

const manifest = JSON.parse(await readFile(join(ROOT, "public/ig/reels-week1/manifest.json"), "utf8"));

for (const item of manifest) {
  const filePath = join(ROOT, "public", item.video.replace(/^\//, ""));
  const buf = await readFile(filePath);
  const name = basename(filePath);
  const form = new FormData();
  form.set("file", new Blob([buf], { type: "video/mp4" }), name);
  form.set("caption", item.caption);
  form.set("tags", JSON.stringify(item.tags));
  form.set("enqueue", "1");

  const res = await fetch(`${base}/api/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const json = await res.json().catch(() => ({}));
  console.log(item.id, res.status, json.post?.id || json.url || json.error || json);
  if (!res.ok) process.exit(1);
}

console.log("Queued", manifest.length, "reels on", base);
