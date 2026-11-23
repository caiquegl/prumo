/**
 * Renderiza os Reels faceless quadro a quadro (reel.html → window.render(t)) em MP4 MUDO 1080×1920 30 fps + capa.
 * A narração entra no CapCut (texto para fala), decisão do Caique em 23/11/2026.
 *   node media/reels-faceless/render.mjs [1 2 3 4] [--preview]   (--preview: só alguns quadros PNG para conferir)
 */
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { mkdir, readFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { chromium } from "/home/hitss/webPrumo/prumo/worker/node_modules/playwright/index.mjs";

const HERE = "/home/hitss/webPrumo/prumo/media/reels-faceless";
const DEMOS = "/home/hitss/webPrumo/demos/public";
const OUT = join(HERE, "out");
const FFMPEG = "/home/hitss/.local/bin/ffmpeg";
const FPS = 30;
const MIME = { ".html": "text/html; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".json": "application/json" };

const args = process.argv.slice(2);
const PREVIEW = args.includes("--preview");
const reels = args.filter((a) => /^[1-4]$/.test(a)).map(Number);
if (!reels.length) reels.push(1, 2, 3, 4);

const server = createServer(async (req, res) => {
  const u = new URL(req.url || "/", "http://x");
  const path = decodeURIComponent(u.pathname);
  const [root, rel] = path.startsWith("/demos-public/") ? [DEMOS, path.slice(14)] : [HERE, path.slice(1)];
  const file = resolve(root, rel || "reel.html");
  if (!file.startsWith(root)) return res.writeHead(403).end();
  let buf;
  try {
    buf = await readFile(file);
  } catch {
    console.error("404", path);
    return res.writeHead(404).end();
  }
  res.writeHead(200, { "content-type": MIME[extname(file)] || "application/octet-stream" }).end(buf);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch();
try {
  for (const r of reels) {
    const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
    page.on("pageerror", (e) => console.error("pageerror", e.message));
    await page.goto(`${origin}/reel.html?r=${r}`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => window.__ready === true, null, { timeout: 60000 });
    const { dur, cover } = await page.evaluate(() => ({ dur: window.DURATION, cover: window.COVER }));
    if (PREVIEW) {
      const marks = [cover, ...Array.from({ length: Math.floor(dur / 2) }, (_, i) => i * 2 + 1)];
      for (const t of marks) {
        await page.evaluate((t) => window.render(t), t);
        await page.screenshot({ path: join(OUT, `p${r}-${String(t).padStart(4, "0")}.png`) });
      }
      console.log(`reel ${r}: preview ${marks.length} quadros`);
      await page.close();
      continue;
    }
    await page.evaluate((t) => window.render(t), cover);
    await page.screenshot({ path: join(OUT, `reel-${r}-capa.jpg`), type: "jpeg", quality: 92 });
    const mp4 = join(OUT, `reel-${r}-mudo.mp4`);
    const ff = spawn(FFMPEG, ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "mjpeg", "-i", "-",
      "-c:v", "libx264", "-profile:v", "high", "-pix_fmt", "yuv420p", "-crf", "19", "-preset", "medium", "-movflags", "+faststart", mp4], { stdio: ["pipe", "inherit", "inherit"] });
    const done = new Promise((ok, ko) => ff.on("close", (c) => (c === 0 ? ok() : ko(new Error("ffmpeg " + c)))));
    const total = Math.round(dur * FPS);
    for (let f = 0; f < total; f++) {
      await page.evaluate((t) => window.render(t), f / FPS);
      const buf = await page.screenshot({ type: "jpeg", quality: 90 });
      if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
      if (f % 150 === 0) console.log(`reel ${r}: ${f}/${total}`);
    }
    ff.stdin.end();
    await done;
    console.log("OK", mp4);
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}
