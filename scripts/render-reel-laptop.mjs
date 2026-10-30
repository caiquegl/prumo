#!/usr/bin/env node
import { spawn, execFile } from "node:child_process";
import { createServer } from "node:http";
import { promisify } from "node:util";
import { mkdir, access, readFile } from "node:fs/promises";
import { join, extname, resolve } from "node:path";
import { createRequire } from "node:module";

const require = createRequire("/home/hitss/prumo/worker/package.json");
const { chromium } = require("playwright");

const run = promisify(execFile);
const ROOT = "/home/hitss/prumo";
const SYNTH = join(ROOT, "media/synth-music.js");
const FFMPEG = "/home/hitss/.local/bin/ffmpeg";
const IG = join(ROOT, "public/ig");
const OUT = join(ROOT, "tmp/reel-laptop");
const FPS = 30;
const SECONDS = 14;
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

await access(join(ROOT, "public/brand/logo-marca.png"));
await mkdir(IG, { recursive: true });
await mkdir(OUT, { recursive: true });

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

const wav = join(OUT, "laptop.wav");
const mp4 = join(IG, "prumo-reel-laptop.mp4");
const cover = join(IG, "prumo-reel-laptop-cover.jpg");

console.log("synth music…");
await run(process.execPath, [SYNTH, wav, String(SECONDS), "-6"]);

function encoder(out, audio) {
  const args = [
    "-y", "-loglevel", "error",
    "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "mjpeg", "-i", "-",
    "-i", audio,
    "-c:v", "libx264", "-profile:v", "high", "-pix_fmt", "yuv420p",
    "-crf", "19", "-preset", "medium", "-movflags", "+faststart",
    "-c:a", "aac", "-b:a", "160k", "-ar", "44100", "-shortest",
    out,
  ];
  const proc = spawn(FFMPEG, args, { stdio: ["pipe", "inherit", "inherit"] });
  const done = new Promise((resolve, reject) => {
    proc.on("error", reject);
    proc.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`ffmpeg ${code}`)),
    );
  });
  const write = (buf) =>
    new Promise((resolve) => (proc.stdin.write(buf) ? resolve() : proc.stdin.once("drain", resolve)));
  return {
    write,
    end: () => {
      proc.stdin.end();
      return done;
    },
  };
}

const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1080, height: 1920 },
    deviceScaleFactor: 1,
  });
  page.on("pageerror", (e) => console.error("pageerror", e.message));
  await page.goto(`${origin}/media/reel-laptop.html`, { waitUntil: "domcontentloaded", timeout: 20000 });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 15000 });
  await page.waitForFunction(
    () => Boolean(document.querySelector("img.logo")?.naturalWidth > 20),
    null,
    { timeout: 10000 },
  );
  await page.waitForFunction(
    () => [...document.querySelectorAll(".screen img")].every((img) => img.naturalWidth > 80),
    null,
    { timeout: 12000 },
  );
  await page.evaluate(async () => {
    if (document.fonts?.ready) {
      await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 2500))]);
    }
    await Promise.all(
      [...document.images].map((img) =>
        img.complete ? null : new Promise((res) => { img.onload = img.onerror = res; }),
      ),
    );
  });
  await page.evaluate(() => new Promise((r) => setTimeout(r, 250)));

  await page.evaluate((t) => window.render(t), 0);
  await page.screenshot({ path: cover, type: "jpeg", quality: 92 });
  console.log("cover", cover);

  console.log("recording frames…");
  const enc = encoder(mp4, wav);
  const total = FPS * SECONDS;
  for (let f = 0; f < total; f++) {
    await page.evaluate((t) => window.render(t), f / FPS);
    await enc.write(await page.screenshot({ type: "jpeg", quality: 86 }));
    if (f % 60 === 0) console.log(`  frame ${f}/${total}`);
  }
  await enc.end();
} finally {
  await browser.close();
  server.close();
}

console.log("OK", mp4);
