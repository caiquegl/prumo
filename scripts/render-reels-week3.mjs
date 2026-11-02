#!/usr/bin/env node
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

const run = promisify(execFile);
const ROOT = "/home/hitss/prumo";
const HTML = join(ROOT, "media/reel-clean.html");
const SYNTH = join(ROOT, "media/synth-music.js");
const FFMPEG = "/home/hitss/.local/bin/ffmpeg";
const OUT_DIR = join(ROOT, "public/ig/reels-week3");
const TMP = join(ROOT, "tmp/reels-week3");
const FPS = 30;

function encoder(out, audio) {
  const args = [
    "-y", "-loglevel", "error",
    "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "mjpeg", "-i", "-",
    "-i", audio,
    "-c:v", "libx264", "-profile:v", "high", "-pix_fmt", "yuv420p",
    "-crf", "18", "-preset", "medium", "-movflags", "+faststart",
    "-c:a", "aac", "-b:a", "160k", "-ar", "44100", "-shortest",
    out,
  ];
  const proc = spawn(FFMPEG, args, { stdio: ["pipe", "inherit", "inherit"] });
  const done = new Promise((resolve, reject) => {
    proc.on("error", reject);
    proc.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg ${code}`))));
  });
  const write = (buf) =>
    new Promise((resolve) => (proc.stdin.write(buf) ? resolve() : proc.stdin.once("drain", resolve)));
  return { write, end: () => { proc.stdin.end(); return done; } };
}

const items = JSON.parse(await readFile(join(ROOT, "media/reels-week3.json"), "utf8"));
await mkdir(OUT_DIR, { recursive: true });
await mkdir(TMP, { recursive: true });

const browser = await chromium.launch();
const manifest = [];
try {
  for (const item of items) {
    const seconds = item.duration || 15;
    const wav = join(TMP, `${item.id}.wav`);
    const mp4 = join(OUT_DIR, `${item.id}.mp4`);
    const cover = join(OUT_DIR, `${item.id}-cover.jpg`);
    console.log("\n===", item.id, `${seconds}s ===`);
    await run(process.execPath, [SYNTH, wav, String(seconds), String(-3 - (manifest.length % 4))]);

    const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
    const cfg = { duration: item.duration, photo: item.photo, beats: item.beats };
    const url = `${pathToFileURL(HTML).href}#${encodeURIComponent(JSON.stringify(cfg))}`;
    await page.goto(url);
    await page.waitForFunction(() => window.__ready === true, null, { timeout: 45000 });
    await page.evaluate(async () => {
      if (document.fonts?.ready) await document.fonts.ready;
      await Promise.all(
        [...document.images].map((img) =>
          img.complete ? null : new Promise((res) => { img.onload = img.onerror = res; }),
        ),
      );
    });
    await page.evaluate(() => new Promise((r) => setTimeout(r, 250)));

    // Cover = mid-hook beat (~1.2s), text centered in safe zone
    await page.evaluate((t) => window.render(t), 1.2);
    await page.screenshot({ path: cover, type: "jpeg", quality: 92 });

    const enc = encoder(mp4, wav);
    const total = FPS * seconds;
    for (let f = 0; f < total; f++) {
      await page.evaluate((t) => window.render(t), f / FPS);
      await enc.write(await page.screenshot({ type: "jpeg", quality: 88 }));
      if (f % 90 === 0) console.log(`  frame ${f}/${total}`);
    }
    await enc.end();
    await page.close();

    manifest.push({
      id: item.id,
      video: `/ig/reels-week3/${item.id}.mp4`,
      cover: `/ig/reels-week3/${item.id}-cover.jpg`,
      caption: item.caption,
      tags: item.tags,
      duration: seconds,
    });
    console.log("OK", mp4);
  }
} finally {
  await browser.close();
}

await writeFile(join(OUT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log("\nManifest", manifest.length);
