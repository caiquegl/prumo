#!/usr/bin/env node
import { execFile } from "node:child_process";
import { createServer } from "node:http";
import { promisify } from "node:util";
import { mkdir, copyFile, readFile } from "node:fs/promises";
import { join, extname, resolve } from "node:path";
import { createRequire } from "node:module";

const require = createRequire("/home/hitss/prumo/worker/package.json");
const { chromium } = require("playwright");

const run = promisify(execFile);
const ROOT = "/home/hitss/prumo";
const SRC = "/mnt/c/Users/Hitss/Downloads/Reels Prumo Web.html";
const HTML = join(ROOT, "media/reel-prumo-web.html");
const SYNTH = join(ROOT, "media/synth-music.js");
const FFMPEG = "/home/hitss/.local/bin/ffmpeg";
const IG = join(ROOT, "public/ig");
const OUT = join(ROOT, "tmp/reel-prumo-web");
const SECONDS = 15;
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
};

await mkdir(IG, { recursive: true });
await mkdir(OUT, { recursive: true });
await copyFile(SRC, HTML);

const server = createServer(async (req, res) => {
  const u = new URL(req.url || "/", "http://127.0.0.1");
  const file = resolve(ROOT, "." + decodeURIComponent(u.pathname));
  if (!file.startsWith(ROOT)) {
    res.writeHead(403);
    res.end();
    return;
  }
  try {
    const buf = await readFile(file);
    res.writeHead(200, { "content-type": MIME[extname(file)] || "application/octet-stream" });
    res.end(buf);
  } catch {
    res.writeHead(404);
    res.end("not found");
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;

const wav = join(OUT, "music.wav");
const mp4 = join(IG, "prumo-reel-web.mp4");
const cover = join(IG, "prumo-reel-web-cover.jpg");
console.log("synth…");
await run(process.execPath, [SYNTH, wav, String(SECONDS), "-4"]);

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1080, height: 1920 },
  deviceScaleFactor: 1,
  recordVideo: { dir: OUT, size: { width: 1080, height: 1920 } },
});
let webm = "";
try {
  const page = await context.newPage();
  await page.addInitScript(() => {
    const css = `html,body{width:1080px!important;height:1920px!important;margin:0!important;overflow:hidden!important}
      body{display:block!important}
      #stage{width:1080px!important;height:1920px!important;max-width:none!important;border-radius:0!important;aspect-ratio:auto!important}
      #r{display:none!important}`;
    const put = () => {
      if (!document.head || document.getElementById("reel-fit")) return;
      const s = document.createElement("style");
      s.id = "reel-fit";
      s.textContent = css;
      document.head.appendChild(s);
    };
    new MutationObserver(put).observe(document, { childList: true, subtree: true });
  });
  await page.goto(`${origin}/media/reel-prumo-web.html`, { waitUntil: "domcontentloaded", timeout: 20000 });
  await page.waitForFunction(() => (document.getElementById("cap")?.innerHTML || "").length > 8, null, { timeout: 10000 });
  await page.evaluate(async () => {
    if (document.fonts?.ready) {
      await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 2500))]);
    }
  });
  await page.screenshot({ path: cover, type: "jpeg", quality: 92 });
  console.log("cover", cover);
  await page.waitForTimeout(15200);
  const video = page.video();
  await page.close();
  webm = await video.path();
} finally {
  await context.close();
  await browser.close();
  server.close();
}

console.log("webm", webm);
await run(FFMPEG, [
  "-y", "-loglevel", "error",
  "-ss", "0.15", "-i", webm, "-t", String(SECONDS),
  "-i", wav,
  "-c:v", "libx264", "-profile:v", "high", "-pix_fmt", "yuv420p",
  "-crf", "19", "-preset", "medium", "-movflags", "+faststart",
  "-c:a", "aac", "-b:a", "160k", "-ar", "44100", "-shortest",
  mp4,
]);
console.log("OK", mp4);
