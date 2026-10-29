import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/login", "/posts", "/api/"],
      },
      {
        userAgent: "Googlebot",
        allow: "/",
        disallow: ["/login", "/posts", "/api/"],
      },
    ],
    sitemap: "https://www.webprumo.com.br/sitemap.xml",
    host: "https://www.webprumo.com.br",
  };
}
