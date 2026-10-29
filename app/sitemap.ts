import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://www.webprumo.com.br/",
      lastModified: new Date("2026-10-29T12:00:00.000Z"),
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
}
