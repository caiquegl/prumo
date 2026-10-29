import Link from "next/link";
import { SEO_PAGES } from "../../lib/seo-pages";

const siteUrl = "https://www.webprumo.com.br";

const WA_BASE =
  "https://wa.me/5511966331995?text=" +
  encodeURIComponent("Olá! Quero um orçamento com a Web Prumo.");

const related = [
  { href: "/criacao-de-sites", label: "criação de sites" },
  { href: "/landing-pages", label: "landing pages" },
  { href: "/sites-institucionais", label: "sites institucionais" },
  { href: "/site-para-empresa", label: "site para empresa" },
  { href: "/sistemas-web", label: "sistemas web" },
  { href: "/integracoes", label: "integrações e automação" },
  { href: "/desenvolvimento-web", label: "desenvolvimento web" },
  { href: "/seo-para-sites", label: "SEO para sites" },
  { href: "/web-prumo", label: "sobre a Web Prumo" },
];

export function ServicePage({
  eyebrow,
  title,
  lead,
  bullets,
  waText,
  currentPath,
}: {
  eyebrow: string;
  title: string;
  lead: string;
  bullets: string[];
  waText?: string;
  currentPath: string;
}) {
  const wa = waText
    ? "https://wa.me/5511966331995?text=" + encodeURIComponent(waText)
    : WA_BASE;

  const pageMeta = SEO_PAGES.find((p) => p.path === currentPath);
  const pageUrl = `${siteUrl}${currentPath}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Início",
            item: `${siteUrl}/`,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: pageMeta?.title ?? title,
            item: pageUrl,
          },
        ],
      },
      {
        "@type": "Service",
        name: pageMeta?.title ?? title,
        description: pageMeta?.description ?? lead,
        url: pageUrl,
        provider: { "@id": `${siteUrl}/#organization` },
        areaServed: {
          "@type": "Country",
          name: "Brasil",
        },
      },
    ],
  };

  return (
    <main className="mx-auto max-w-3xl px-5 py-20 md:px-8 md:py-28">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-coral">
        {eyebrow}
      </p>
      <h1 className="display mt-4 text-[clamp(2.4rem,6vw,4rem)]">{title}</h1>
      <p className="mt-6 text-lg leading-relaxed text-ink-soft">{lead}</p>
      <ul className="mt-10 space-y-3 text-[0.98rem] leading-relaxed text-ink-soft">
        {bullets.map((item) => (
          <li key={item} className="flex gap-3 border-t border-line pt-3">
            <span className="text-coral" aria-hidden>
              →
            </span>
            {item}
          </li>
        ))}
      </ul>
      <div className="mt-12 flex flex-wrap gap-4">
        <a className="wa-btn" href={wa} target="_blank" rel="noopener noreferrer">
          Pedir orçamento no WhatsApp
        </a>
        <a
          href="mailto:arq.caique@hotmail.com"
          className="inline-flex items-center text-sm font-semibold uppercase tracking-[0.18em] text-ink-soft hover:text-ink"
        >
          arq.caique@hotmail.com
        </a>
      </div>
      <nav className="mt-16 border-t border-line pt-8" aria-label="Outros serviços">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-ink-soft">
          Também oferecemos
        </p>
        <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm text-ink-soft">
          {related
            .filter((r) => r.href !== currentPath)
            .map((r) => (
              <li key={r.href}>
                <Link href={r.href} className="text-coral underline-offset-2 hover:underline">
                  {r.label}
                </Link>
              </li>
            ))}
        </ul>
      </nav>
    </main>
  );
}
