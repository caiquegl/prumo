import { head, put } from "@vercel/blob";
import type { IgState } from "./types";

const PATH = "ig-auto/state.json";
const EMPTY: IgState = { published: [] };

export async function readState(): Promise<IgState> {
  try {
    const meta = await head(PATH);
    const res = await fetch(meta.url, { cache: "no-store" });
    if (!res.ok) return structuredClone(EMPTY);
    return (await res.json()) as IgState;
  } catch {
    return structuredClone(EMPTY);
  }
}

export async function writeState(state: IgState) {
  const trimmed: IgState = { published: state.published.slice(-500) };
  const blob = await put(PATH, JSON.stringify(trimmed, null, 2), {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
  });
  return blob.url;
}
