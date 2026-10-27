import bankJson from "@/worker/bank.json";
import type { FeedItem, IgState } from "./types";

const BASE_TAGS = ["prumoweb", "tecnologia", "empresas"];

export const bank = bankJson as unknown as FeedItem[];

export function plain(s: string) {
  return String(s).replace(/<br>/g, " ");
}

export function titleOf(it: FeedItem) {
  return plain(it.title).replace(/\s+/g, " ").trim();
}

export function buildCaption(it: FeedItem) {
  let body: string;
  if (it.layout === "compare" && it.left && it.right) {
    body = `${it.left.label}:\n${it.left.rows.map((r) => `✕ ${r}`).join("\n")}\n\n${it.right.label}:\n${it.right.rows.map((r) => `✓ ${r}`).join("\n")}`;
  } else {
    const mark = (i: number) => (it.layout === "flow" ? `${i + 1}.` : it.layout === "checklist" ? "✓" : "▸");
    body = (it.items ?? []).map(([t, d], i) => `${mark(i)} ${t}${d ? ` — ${d}` : ""}`).join("\n");
  }
  const tags = [...new Set([...(it.tags || []), ...BASE_TAGS])]
    .slice(0, 8)
    .map((t) => `#${t.replace(/[^\p{L}\p{N}_]/gu, "")}`);
  const titleLine = [titleOf(it), it.sub].filter(Boolean).join(/[?!.:]$/.test(titleOf(it)) ? " " : ": ");
  return [
    it.hook,
    titleLine,
    body,
    `${plain(it.headline)} Fale com a Prumo Web: orçamento sem compromisso no WhatsApp (11) 96633-1995 ou pelo link na bio.`,
    tags.join(" "),
  ].join("\n\n");
}

export function pickItem(state: IgState): FeedItem {
  const used = new Set(state.published.map((p) => p.id));
  const fresh = bank.find((it) => !used.has(it.id));
  if (fresh) return fresh;
  const oldest = [...bank].sort((a, b) => {
    const ia = state.published.findLastIndex((p) => p.id === a.id);
    const ib = state.published.findLastIndex((p) => p.id === b.id);
    return ia - ib;
  })[0];
  return oldest;
}

export function slotKey(now = new Date()) {
  const hour = now.getUTCHours();
  const slots = [11, 15, 21];
  const nearest = slots.reduce((a, b) => (Math.abs(b - hour) < Math.abs(a - hour) ? b : a));
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), nearest));
  return d.toISOString().slice(0, 13);
}
