#!/usr/bin/env node
// Renders bank items locally without publishing. Usage: node worker/preview.mjs [post|reel|all-formats] [id...]
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { loadBank } from "./content.mjs";
import { render } from "./render.mjs";

const [mode = "post", ...ids] = process.argv.slice(2);
const root = fileURLToPath(new URL("..", import.meta.url));
const outDir = process.env.OUT_DIR || join(root, "worker", "out");
await mkdir(outDir, { recursive: true });

const bank = (await loadBank(join(root, "worker", "bank.json"))).filter(it => !ids.length || ids.includes(it.id));
const formats = mode === "all-formats" ? ["post", "reel"] : [mode];
let failed = 0;
for (const [i, item] of bank.entries()) {
  for (const format of formats) {
    try {
      const files = await render({ item, format, dark: i % 3 === 2, transpose: 0, outDir, name: `preview-${format}-${item.id}`, stillOnly: format === "reel" && mode === "all-formats" });
      console.log(`ok   ${format.padEnd(4)} ${item.id} -> ${Object.values(files).join(", ")}`);
    } catch (err) {
      failed++;
      console.log(`FAIL ${format.padEnd(4)} ${item.id}: ${err.message}`);
    }
  }
}
process.exit(failed ? 1 : 0);
