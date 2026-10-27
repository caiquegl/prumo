import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";
import { join } from "node:path";
import { chromium } from "playwright";
import ffmpegPath from "ffmpeg-static";

const run = promisify(execFile);
const TEMPLATE = fileURLToPath(new URL("./template.html", import.meta.url));
const SYNTH = fileURLToPath(new URL("../media/synth-music.js", import.meta.url));
const FPS = 30;
const SECONDS = 12;

async function openPage(browser, cfg) {
  const height = cfg.format === "reel" ? 1920 : 1350;
  const page = await browser.newPage({ viewport: { width: 1080, height }, deviceScaleFactor: 1 });
  await page.goto(`${pathToFileURL(TEMPLATE).href}#${encodeURIComponent(JSON.stringify(cfg))}`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 30000 });
  if (await page.evaluate(() => window.__overflow)) throw new Error(`conteúdo "${cfg.item.id}" não coube no layout ${cfg.format}`);
  return page;
}

function encoder(out, audio) {
  const args = ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "mjpeg", "-i", "-"];
  if (audio) args.push("-i", audio);
  args.push("-c:v", "libx264", "-profile:v", "high", "-pix_fmt", "yuv420p", "-crf", "20", "-preset", "medium", "-movflags", "+faststart");
  args.push(...(audio ? ["-c:a", "aac", "-b:a", "160k", "-ar", "44100", "-shortest"] : ["-an"]), out);
  const proc = spawn(ffmpegPath, args, { stdio: ["pipe", "inherit", "inherit"] });
  const done = new Promise((resolve, reject) => {
    proc.on("error", reject);
    proc.on("close", code => (code === 0 ? resolve() : reject(new Error(`ffmpeg saiu com código ${code}`))));
  });
  const write = buf => new Promise(resolve => (proc.stdin.write(buf) ? resolve() : proc.stdin.once("drain", resolve)));
  return { write, end: () => { proc.stdin.end(); return done; } };
}

/** Renders a feed image (1080x1350) or a reel (1080x1920 mp4 + cover). Returns the generated file paths. */
export async function render({ item, format, dark, transpose, outDir, name, stillOnly = false }) {
  const browser = await chromium.launch();
  try {
    const cfg = { item, format, dark, t: 99 };
    const page = await openPage(browser, cfg);
    if (format === "post") {
      const image = join(outDir, `${name}.jpg`);
      await page.screenshot({ path: image, type: "jpeg", quality: 92 });
      return { image };
    }

    const cover = join(outDir, `${name}-cover.jpg`);
    await page.screenshot({ path: cover, type: "jpeg", quality: 92 });
    if (stillOnly) return { cover };

    let audio = null;
    if (transpose !== null) {
      audio = join(outDir, `${name}.wav`);
      await run(process.execPath, [SYNTH, audio, String(SECONDS), String(transpose)]);
    }
    const video = join(outDir, `${name}.mp4`);
    const enc = encoder(video, audio);
    for (let f = 0; f < FPS * SECONDS; f++) {
      await page.evaluate(t => window.render(t), f / FPS);
      await enc.write(await page.screenshot({ type: "jpeg", quality: 90 }));
    }
    await enc.end();
    return { video, cover };
  } finally {
    await browser.close();
  }
}
