export const LAYOUTS = ["list", "flow", "compare", "checklist"] as const;
export type Layout = (typeof LAYOUTS)[number];

export type FeedItem = {
  id: string;
  layout: Layout;
  kicker: string;
  title: string;
  sub?: string;
  items?: [string, string][];
  left?: { label: string; rows: string[] };
  right?: { label: string; rows: string[] };
  headline: string;
  hook: string;
  tags?: string[];
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
