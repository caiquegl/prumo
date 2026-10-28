import bankJson from "@/worker/bank.json";
import type { FeedItem, IgState } from "./types";
import { LAYOUTS } from "./types";

const BASE_TAGS = ["prumoweb", "tecnologia", "empresas"];

export const bank = bankJson as unknown as FeedItem[];

export function plain(s: string) {
  return String(s).replace(/<br>/g, " ");
}

export function titleOf(it: FeedItem) {
  return plain(it.title).replace(/\s+/g, " ").trim();
}

export function buildCaption(it: FeedItem) {
  // Caption curta estilo agência: 1 gancho + CTA + hashtags. Sem parágrafo.
  const bits: string[] = [it.hook || titleOf(it), "WhatsApp (11) 96633-1995 · link na bio."];
  if (it.photoCredit) bits.push(it.photoCredit);
  const tags = [...new Set([...(it.tags || []), ...BASE_TAGS])]
    .slice(0, 5)
    .map((t) => `#${t.replace(/[^\p{L}\p{N}_]/gu, "")}`);
  bits.push(tags.join(" "));
  return bits.join("\n\n");
}

function recentLayouts(state: IgState, n = 2) {
  return state.published.slice(-n).map((p) => p.layout);
}

export function pickItem(state: IgState): FeedItem {
  const avoid = recentLayouts(state, 2);
  const last = avoid.at(-1);
  const used = new Set(state.published.map((p) => p.id));
  const unused = bank.filter((it) => !used.has(it.id));
  const pool = unused.length ? unused : [...bank];
  const skipTwo = pool.filter((it) => !avoid.includes(it.layout));
  if (skipTwo.length) return skipTwo[0];
  const skipOne = pool.filter((it) => it.layout !== last);
  if (skipOne.length) return skipOne[0];
  const next = LAYOUTS.find((l) => l !== last) ?? LAYOUTS[0];
  return bank.find((it) => it.layout === next) ?? pool[0];
}

export function slotKey(now = new Date()) {
  const hour = now.getUTCHours();
  const slots = [11, 15, 21];
  const nearest = slots.reduce((a, b) => (Math.abs(b - hour) < Math.abs(a - hour) ? b : a));
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), nearest));
  return d.toISOString().slice(0, 13);
}

export function assertNoRepeat(state: IgState, item: FeedItem) {
  const title = titleOf(item).toLowerCase();
  const sameTitle = state.published.some((p) => p.title.toLowerCase() === title);
  if (sameTitle) {
    throw new Error(`título "${titleOf(item)}" já foi publicado`);
  }
  const recent = state.published.slice(-5);
  if (item.concept) {
    const sameConcept = recent.some(
      (p) => p.item?.concept === item.concept || p.id.includes(item.concept!),
    );
    if (sameConcept) throw new Error(`conceito visual "${item.concept}" já saiu recentemente`);
  }
  if (item.angle) {
    const ang = item.angle.toLowerCase();
    const sameAngle = recent.some((p) => {
      const prev = (p.item?.angle || "").toLowerCase();
      if (prev && prev === ang) return true;
      // id no formato agency-{angle}-{rand}
      const parts = p.id.toLowerCase().split("-");
      if (parts[0] !== "agency" || parts.length < 3) return false;
      const mid = parts.slice(1, -1).join("-");
      return mid === ang;
    });
    if (sameAngle) throw new Error(`ângulo "${item.angle}" já saiu nos últimos posts`);
  }
  if (item.photoId) {
    const used = state.published.some((p) => p.item?.photoId === item.photoId);
    if (used) throw new Error(`arte "${item.photoId}" já foi publicada`);
  }
}
