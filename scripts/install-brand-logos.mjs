import fs from "fs";
import path from "path";
import { createRequire } from "module";
import sharp from "sharp";

const require = createRequire(import.meta.url);
const pngToIco = require("png-to-ico");
const toIco = pngToIco.default || pngToIco;

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const assetsWin =
  "/mnt/c/Users/Hitss/.cursor/projects/c-Users-Hitss-Documents-claro-empresas/assets";

const sources = {
  marca: path.join(assetsWin, "prumo-final-marca-web-prumo.jpg"),
  instagram: path.join(assetsWin, "prumo-final-instagram-web-prumo.jpg"),
  favicon: path.join(assetsWin, "prumo-final-favicon-simbolo.jpg"),
};

for (const [k, p] of Object.entries(sources)) {
  if (!fs.existsSync(p)) throw new Error(`missing ${k}: ${p}`);
}

const brandDir = path.join(root, "public", "brand");
fs.mkdirSync(brandDir, { recursive: true });

// Keep originals + clean PNGs
await sharp(sources.marca).png().toFile(path.join(brandDir, "logo-marca.png"));
await sharp(sources.instagram).png().toFile(path.join(brandDir, "logo-instagram.png"));
await sharp(sources.favicon).png().toFile(path.join(brandDir, "logo-favicon.png"));
fs.copyFileSync(sources.marca, path.join(brandDir, "logo-marca.jpg"));
fs.copyFileSync(sources.instagram, path.join(brandDir, "logo-instagram.jpg"));
fs.copyFileSync(sources.favicon, path.join(brandDir, "logo-favicon.jpg"));

const favSrc = sharp(sources.favicon).trim({ threshold: 12 }).resize(512, 512, {
  fit: "contain",
  background: { r: 255, g: 255, b: 255, alpha: 1 },
});

await favSrc.clone().png().toFile(path.join(root, "public", "favicon.png"));
await favSrc
  .clone()
  .resize(32, 32)
  .png()
  .toFile(path.join(root, "public", "favicon-32.png"));
await favSrc
  .clone()
  .resize(16, 16)
  .png()
  .toFile(path.join(root, "public", "favicon-16.png"));
await favSrc
  .clone()
  .resize(180, 180)
  .png()
  .toFile(path.join(root, "public", "apple-touch-icon.png"));
await favSrc
  .clone()
  .resize(512, 512)
  .png()
  .toFile(path.join(root, "app", "icon.png"));
await favSrc
  .clone()
  .resize(180, 180)
  .png()
  .toFile(path.join(root, "app", "apple-icon.png"));

const ico = await toIco([
  path.join(root, "public", "favicon-16.png"),
  path.join(root, "public", "favicon-32.png"),
]);
fs.writeFileSync(path.join(root, "public", "favicon.ico"), ico);
fs.writeFileSync(path.join(root, "app", "favicon.ico"), ico);

// Header/nav mark (compact square from Instagram wordmark crop)
await sharp(sources.instagram)
  .resize(256, 256, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
  .png()
  .toFile(path.join(root, "public", "logo.png"));

// OG: brand on light canvas
const ogBg = Buffer.from(
  `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
    <rect width="1200" height="630" fill="#F4F1EC"/>
    <rect x="48" y="48" width="1104" height="534" rx="28" fill="#FFFFFF" stroke="#E8E0D8" stroke-width="2"/>
  </svg>`
);
const marcaOg = await sharp(sources.marca)
  .resize(520, 520, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } })
  .png()
  .toBuffer();
await sharp(ogBg)
  .composite([{ input: marcaOg, left: 340, top: 55 }])
  .jpeg({ quality: 90 })
  .toFile(path.join(root, "public", "og.jpg"));

console.log("brand assets installed");
console.log(
  fs
    .readdirSync(brandDir)
    .map((f) => `${f} ${fs.statSync(path.join(brandDir, f)).size}`)
    .join("\n")
);
