import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://www.webprumo.com.br";
  return [
    {
      url: `${base}/`,
      lastModified: "2026-10-29",
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
}
