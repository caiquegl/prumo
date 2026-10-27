import { readFile } from "node:fs/promises";
import { join } from "node:path";

export type OgFont = { name: string; data: ArrayBuffer; weight: 500 | 600 | 700; style: "normal" };

let cache: OgFont[] | null = null;

async function woff(file: string) {
  const buf = await readFile(join(process.cwd(), "lib/ig/fonts", file));
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

export async function loadFonts(): Promise<OgFont[]> {
  if (cache) return cache;
  const [fraunces, manrope600, manrope700] = await Promise.all([
    woff("fraunces-500.woff"),
    woff("manrope-600.woff"),
    woff("manrope-700.woff"),
  ]);
  cache = [
    { name: "Fraunces", data: fraunces, weight: 500, style: "normal" },
    { name: "Manrope", data: manrope600, weight: 600, style: "normal" },
    { name: "Manrope", data: manrope700, weight: 700, style: "normal" },
  ];
  return cache;
}
