import type { MetadataRoute } from "next";
import { SEO_PAGES } from "../lib/seo-pages";

const site = "https://www.webprumo.com.br";
const now = new Date();

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${site}/`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
    ...SEO_PAGES.map((p) => ({
      url: `${site}${p.path}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: p.priority,
    })),
  ];
}
