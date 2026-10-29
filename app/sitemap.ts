import type { MetadataRoute } from "next";

const site = "https://www.webprumo.com.br";
const now = new Date("2026-10-29T13:00:00.000Z");

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${site}/`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
      images: [`${site}/og.jpg`],
    },
    {
      url: `${site}/criacao-de-sites`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${site}/landing-pages`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${site}/sites-institucionais`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.85,
    },
  ];
}
