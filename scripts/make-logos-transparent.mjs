import fs from "fs";
import path from "path";
import { createRequire } from "module";
import sharp from "sharp";

const require = createRequire(import.meta.url);
const pngToIco = require("png-to-ico");
const toIco = pngToIco.default || pngToIco;

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const brand = path.join(root, "public", "brand");

/** Make near-white / light-gray pixels transparent */
async function knockOutBg(inputPath, outputPath, { threshold = 235 } = {}) {
  const { data, info } = await sharp(inputPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    // white / cream / light gray → transparent
    if (r >= threshold && g >= threshold && b >= threshold) {
      data[i + 3] = 0;
    } else if (r >= 220 && g >= 220 && b >= 220) {
      // soft edge fade
      const avg = (r + g + b) / 3;
      data[i + 3] = Math.max(0, Math.min(255, Math.round((255 - avg) * 8)));
    }
  }

  await sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toFile(outputPath);
}

async function trimTransparent(inputPath, outputPath, pad = 24) {
  const buf = await sharp(inputPath)
    .trim({ threshold: 1 })
    .extend({
      top: pad,
      bottom: pad,
      left: pad,
      right: pad,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
  await sharp(buf).png().toFile(outputPath);
}

// Sources (opaque JPGs/PNGs)
const marcaSrc = path.join(brand, "logo-marca.jpg");
const igSrc = path.join(brand, "logo-instagram.jpg");
const favSrc = path.join(brand, "logo-favicon.jpg");

await knockOutBg(marcaSrc, path.join(brand, "logo-marca.png"), { threshold: 232 });
await knockOutBg(igSrc, path.join(brand, "logo-instagram.png"), { threshold: 232 });
await knockOutBg(favSrc, path.join(brand, "logo-favicon.png"), { threshold: 240 });

await trimTransparent(
  path.join(brand, "logo-favicon.png"),
  path.join(brand, "logo-favicon.png"),
  32
);
await trimTransparent(
  path.join(brand, "logo-instagram.png"),
  path.join(brand, "logo-instagram.png"),
  16
);
await trimTransparent(
  path.join(brand, "logo-marca.png"),
  path.join(brand, "logo-marca.png"),
  8
);

// Favicon sizes from transparent symbol (on transparent; ICO needs white/opaque for some browsers — keep PNG transparent, ICO on white)
const favPng = path.join(brand, "logo-favicon.png");

await sharp(favPng)
  .resize(512, 512, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toFile(path.join(root, "public", "favicon.png"));

await sharp(favPng)
  .resize(32, 32, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toFile(path.join(root, "public", "favicon-32.png"));

await sharp(favPng)
  .resize(16, 16, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toFile(path.join(root, "public", "favicon-16.png"));

await sharp(favPng)
  .resize(180, 180, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toFile(path.join(root, "public", "apple-touch-icon.png"));

await sharp(favPng)
  .resize(512, 512, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toFile(path.join(root, "app", "icon.png"));

await sharp(favPng)
  .resize(180, 180, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toFile(path.join(root, "app", "apple-icon.png"));

// ICO: white bg for browser tab clarity
const ico16 = await sharp(favPng)
  .resize(16, 16, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
  .flatten({ background: "#ffffff" })
  .png()
  .toBuffer();
const ico32 = await sharp(favPng)
  .resize(32, 32, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
  .flatten({ background: "#ffffff" })
  .png()
  .toBuffer();
fs.writeFileSync(path.join(root, "tmp-ico-16.png"), ico16);
fs.writeFileSync(path.join(root, "tmp-ico-32.png"), ico32);
const ico = await toIco([
  path.join(root, "tmp-ico-16.png"),
  path.join(root, "tmp-ico-32.png"),
]);
fs.writeFileSync(path.join(root, "public", "favicon.ico"), ico);
fs.writeFileSync(path.join(root, "app", "favicon.ico"), ico);
fs.unlinkSync(path.join(root, "tmp-ico-16.png"));
fs.unlinkSync(path.join(root, "tmp-ico-32.png"));

await sharp(path.join(brand, "logo-instagram.png"))
  .resize(256, 256, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toFile(path.join(root, "public", "logo.png"));

console.log("transparent logos ready");
