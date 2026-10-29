import fs from "node:fs";
import sharp from "sharp";

const src = "public/brand/logo-favicon.png";

async function png(size, out) {
  await sharp(src)
    .resize(size, size, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toFile(out);
}

const tmp16 = "/tmp/wp-f16.png";
const tmp32 = "/tmp/wp-f32.png";
const tmp48 = "/tmp/wp-f48.png";

await png(16, tmp16);
await png(32, tmp32);
await png(48, tmp48);
await png(32, "public/favicon-32.png");
await png(16, "public/favicon-16.png");
await png(48, "public/favicon-48.png");
await png(180, "public/apple-touch-icon.png");
await png(180, "app/apple-icon.png");
await png(512, "public/favicon.png");
await png(512, "app/icon.png");

try {
  const pngToIco = (await import("png-to-ico")).default;
  const buf = await pngToIco([tmp16, tmp32, tmp48]);
  fs.writeFileSync("public/favicon.ico", buf);
  fs.writeFileSync("app/favicon.ico", buf);
  console.log("ico multi-size ok", buf.length);
} catch (err) {
  console.warn("png-to-ico unavailable, writing 48px png as ico fallback", err.message);
  await sharp(tmp48).toFile("public/favicon.ico");
  await sharp(tmp48).toFile("app/favicon.ico");
}

console.log("favicons regenerated");
