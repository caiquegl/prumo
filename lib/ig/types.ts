export const LAYOUTS = [
  "anatomy",
  "perf",
  "hub",
  "quote",
  "split",
  "cards",
  "compare",
  "hero",
  "stat",
  "offer",
] as const;
export type Layout = (typeof LAYOUTS)[number];
export type Visual = "leaves" | "wire" | "chart" | "cloud" | "mark";

/** Layouts de peça desenhada (estilo anatomia / performance / integrações) — preferidos */
export const DESIGNED_LAYOUTS: Layout[] = ["anatomy", "perf", "hub", "quote", "split", "cards", "compare"];

export type FeedItem = {
  id: string;
  layout: Layout;
  visual?: Visual;
  kicker: string;
  title: string;
  sub?: string;
  items?: [string, string?][];
  left?: { label: string; rows: string[] };
  right?: { label: string; rows: string[] };
  stat?: { value: string; label: string };
  bars?: { label: string; value: string; pct: number; accent?: boolean }[];
  score?: { value: string; label: string };
  checks?: { title: string; detail: string }[];
  hubCenter?: string;
  hubNodes?: string[];
  headline: string;
  hook: string;
  tags?: string[];
  photoUrl?: string;
  photoCredit?: string;
  photoId?: string;
  pillar?: string;
  angle?: string;
  concept?: string;
};

export type PublishRecord = {
  slot: string;
  id: string;
  title: string;
  layout: Layout;
  format: "post" | "reel";
  media_id?: string;
  permalink?: string;
  published_at: string;
  item?: FeedItem;
};

export type IgState = {
  published: PublishRecord[];
};
