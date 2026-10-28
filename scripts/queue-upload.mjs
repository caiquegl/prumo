#!/usr/bin/env node
/**
 * Upload de arquivo para a fila IG (agente / CLI).
 * Uso:
 *   QUEUE_API_SECRET=... node scripts/queue-upload.mjs ./arte.png --caption "..." --tags "a,b,c"
 *   ADMIN_PASSWORD=... node scripts/queue-upload.mjs ./clip.mp4 --caption "..."
 */
import { readFile } from "node:fs/promises";
import { basename } from "node:path";

const args = process.argv.slice(2);
const filePath = args.find((a) => !a.startsWith("--"));
if (!filePath) {
  console.error("usage: queue-upload.mjs <file> --caption \"...\" --tags \"a,b\"");
  process.exit(1);
}

function flag(name) {
  const i = args.indexOf(`--${name}`);
  if (i < 0) return "";
  return args[i + 1] || "";
}

const caption = flag("caption");
const tags = flag("tags");
const base = process.env.PRUMO_URL || "https://prumo-tawny.vercel.app";
const token = process.env.QUEUE_API_SECRET || process.env.ADMIN_PASSWORD;
if (!token) {
  console.error("Defina QUEUE_API_SECRET ou ADMIN_PASSWORD");
  process.exit(1);
}

const buf = await readFile(filePath);
const name = basename(filePath);
const lower = name.toLowerCase();
const type = lower.endsWith(".mp4")
  ? "video/mp4"
  : lower.endsWith(".webm")
    ? "video/webm"
    : lower.endsWith(".mov")
      ? "video/quicktime"
      : lower.endsWith(".png")
        ? "image/png"
        : lower.endsWith(".webp")
          ? "image/webp"
          : "image/jpeg";

const form = new FormData();
form.set("file", new Blob([buf], { type }), name);
if (caption) form.set("caption", caption);
if (tags) form.set("tags", tags);

const res = await fetch(`${base}/api/posts`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}` },
  body: form,
});
const json = await res.json();
console.log(JSON.stringify(json, null, 2));
if (!res.ok) process.exit(1);
