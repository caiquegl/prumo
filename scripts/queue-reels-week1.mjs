#!/usr/bin/env node
/**
 * Enfileira os 7 Reels da semana 1 (URLs públicas do site após deploy).
 * Uso:
 *   ADMIN_PASSWORD=… node scripts/queue-reels-week1.mjs
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const ROOT = "/home/hitss/prumo";
const base = (process.env.PRUMO_URL || "https://prumo-tawny.vercel.app").replace(/\/$/, "");
const token = process.env.QUEUE_API_SECRET || process.env.ADMIN_PASSWORD || process.env.UPLOAD_SECRET;
if (!token) {
  console.error("Defina QUEUE_API_SECRET, ADMIN_PASSWORD ou UPLOAD_SECRET");
  process.exit(1);
}

const manifest = JSON.parse(await readFile(join(ROOT, "public/ig/reels-week1/manifest.json"), "utf8"));

for (const item of manifest) {
  const imageUrl = `${base}${item.video}`;
  const head = await fetch(imageUrl, { method: "HEAD" });
  if (!head.ok) {
    console.error(item.id, "media not public", head.status, imageUrl);
    process.exit(1);
  }

  const res = await fetch(`${base}/api/upload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      imageUrl,
      mediaType: "video",
      caption: item.caption,
      tags: item.tags,
    }),
  });
  const json = await res.json().catch(() => ({}));
  console.log(item.id, res.status, json.post?.id || json.error || json);
  if (!res.ok) process.exit(1);
}

console.log("Queued", manifest.length, "reels on", base);
