export const LAYOUTS = ["hero", "quote", "split", "stat", "cards", "compare"] as const;
export type Layout = (typeof LAYOUTS)[number];
export type Visual = "leaves" | "wire" | "chart" | "cloud" | "mark";

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
  headline: string;
  hook: string;
  tags?: string[];
  /** Foto real (Unsplash) para layouts hero/split — estilo agência. */
  photoUrl?: string;
  photoCredit?: string;
  photoId?: string;
  pillar?: string;
  angle?: string;
  /** Conceito visual único gerado pela IA (anti-repetição de composição) */
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
