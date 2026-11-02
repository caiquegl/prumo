#!/usr/bin/env node
/**
 * Renderiza os 7 Reels da semana 1 (Playwright + ffmpeg local).
 * Uso: node scripts/render-reels-week1.mjs
 *      node scripts/render-reels-week1.mjs r01-ig-atrai
 */
import { spawn, execFile } from "node:child_process";
import { createServer } from "node:http";
import { promisify } from "node:util";
import { mkdir, access, readFile, copyFile, writeFile } from "node:fs/promises";
import { join, extname, resolve } from "node:path";
import { createRequire } from "node:module";

const require = createRequire("/home/hitss/prumo/worker/package.json");
const { chromium } = require("playwright");

const run = promisify(execFile);
const ROOT = "/home/hitss/prumo";
const SYNTH = join(ROOT, "media/synth-music.js");
const FFMPEG = "/home/hitss/.local/bin/ffmpeg";
const OUT_DIR = join(ROOT, "public/ig/reels-week1");
const TMP = join(ROOT, "tmp/reels-week1");
const FPS = 30;
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".json": "application/json",
  ".js": "text/javascript",
};

const only = process.argv[2] || null;
const catalog = JSON.parse(await readFile(join(ROOT, "media/reels-week1.json"), "utf8"));
const jobs = only ? catalog.filter((r) => r.id === only || r.id.startsWith(only)) : catalog;
if (!jobs.length) {
  console.error("Nenhum reel encontrado para", only);
  process.exit(1);
}

await access(join(ROOT, "public/brand/logo-marca.png"));
await mkdir(OUT_DIR, { recursive: true });
await mkdir(TMP, { recursive: true });

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

function encoder(out, audio) {
  const args = [
    "-y",
    "-loglevel",
    "error",
    "-f",
    "image2pipe",
    "-framerate",
    String(FPS),
    "-c:v",
    "mjpeg",
    "-i",
    "-",
    "-i",
    audio,
    "-c:v",
    "libx264",
    "-profile:v",
    "high",
    "-pix_fmt",
    "yuv420p",
    "-crf",
    "19",
    "-preset",
    "medium",
    "-movflags",
    "+faststart",
    "-c:a",
    "aac",
    "-b:a",
    "160k",
    "-ar",
    "44100",
    "-shortest",
    out,
  ];
  const proc = spawn(FFMPEG, args, { stdio: ["pipe", "inherit", "inherit"] });
  const done = new Promise((resolvePromise, reject) => {
    proc.on("error", reject);
    proc.on("close", (code) => (code === 0 ? resolvePromise() : reject(new Error(`ffmpeg ${code}`))));
  });
  const write = (buf) =>
    new Promise((resolveWrite) => (proc.stdin.write(buf) ? resolveWrite() : proc.stdin.once("drain", resolveWrite)));
  return {
    write,
    end: () => {
      proc.stdin.end();
      return done;
    },
  };
}

const browser = await chromium.launch();
const manifest = [];

try {
  for (const job of jobs) {
    const seconds = Number(job.duration) || 18;
    const mp4 = join(OUT_DIR, `${job.id}.mp4`);
    const coverOut = join(OUT_DIR, `${job.id}-cover.jpg`);
    const wav = join(TMP, `${job.id}.wav`);
    console.log(`\n=== ${job.id} (${seconds}s) ===`);

    console.log("synth…");
    await run(process.execPath, [SYNTH, wav, String(seconds), "2"]);

    const page = await browser.newPage({
      viewport: { width: 1080, height: 1920 },
      deviceScaleFactor: 1,
    });
    page.on("pageerror", (e) => console.error("pageerror", e.message));

    const hash = encodeURIComponent(
      JSON.stringify({
        id: job.id,
        duration: seconds,
        scenes: job.scenes,
      }),
    );
    await page.goto(`${origin}/media/reel-week1.html#${hash}`, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await page.waitForFunction(() => window.__ready === true, null, { timeout: 20000 });
    await page.evaluate(async () => {
      if (document.fonts?.ready) {
        await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 2500))]);
      }
    });

    // capa: usa arte gerada se existir; senão screenshot t=0
    if (job.cover) {
      try {
        await copyFile(join(ROOT, job.cover), coverOut);
        console.log("cover (arte)", coverOut);
      } catch {
        await page.evaluate((t) => window.render(t), 0);
        await page.screenshot({ path: coverOut, type: "jpeg", quality: 92 });
        console.log("cover (frame)", coverOut);
      }
    } else {
      await page.evaluate((t) => window.render(t), 0);
      await page.screenshot({ path: coverOut, type: "jpeg", quality: 92 });
    }

    console.log("recording…");
    const enc = encoder(mp4, wav);
    const total = FPS * seconds;
    for (let f = 0; f < total; f++) {
      await page.evaluate((t) => window.render(t), f / FPS);
      await enc.write(await page.screenshot({ type: "jpeg", quality: 84 }));
      if (f % 90 === 0) console.log(`  frame ${f}/${total}`);
    }
    await enc.end();
    await page.close();
    console.log("OK", mp4);

    manifest.push({
      id: job.id,
      video: `/ig/reels-week1/${job.id}.mp4`,
      cover: `/ig/reels-week1/${job.id}-cover.jpg`,
      caption: job.caption,
      tags: job.tags,
      duration: seconds,
    });
  }
} finally {
  await browser.close();
  server.close();
}

await writeFile(join(OUT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log("\nManifest:", join(OUT_DIR, "manifest.json"));
console.log("Done", manifest.length, "reels");
