import type { Metadata } from "next";
import { ServicePage } from "../components/ServicePage";
import { SEO_PAGES } from "../../lib/seo-pages";

const page = SEO_PAGES.find((p) => p.path === "/web-prumo")!;

export const metadata: Metadata = {
  title: page.title,
  description: page.description,
  keywords: [
    "Web Prumo",
    "web prumo",
    "webprumo",
    "webprumo.com.br",
    "web.prumo",
    "criação de sites",
    "landing pages",
  ],
  alternates: { canonical: `https://www.webprumo.com.br${page.path}` },
  openGraph: {
    title: "Web Prumo | Quem somos",
    description: page.description,
    url: `https://www.webprumo.com.br${page.path}`,
  },
};

export default function Page() {
  return (
    <ServicePage
      eyebrow={page.eyebrow}
      title={page.h1}
      lead={page.lead}
      bullets={page.bullets}
      waText={page.waText}
      currentPath={page.path}
    />
  );
}
