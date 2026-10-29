import type { Metadata } from "next";
import { Fraunces, Manrope } from "next/font/google";
import { Analytics } from "./components/Analytics";
import { SiteChrome } from "./components/SiteChrome";
import "./globals.css";

const display = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
  preload: true,
});

const body = Manrope({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  preload: true,
});

const siteUrl = "https://www.webprumo.com.br";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Web Prumo | Criação de Sites e Landing Pages",
    template: "%s | Web Prumo",
  },
  description:
    "Web Prumo (webprumo.com.br) — criação de sites, landing pages, sites institucionais e sistemas web sob medida. Design autoral, SEO técnico e foco em conversão. Contato: arq.caique@hotmail.com.",
  keywords: [
    "Web Prumo",
    "web prumo",
    "webprumo",
    "webprumo.com.br",
    "web.prumo",
    "criação de sites",
    "criacao de sites",
    "desenvolvimento de sites",
    "fazer site",
    "landing page",
    "landing pages",
    "criação de landing page",
    "site institucional",
    "site profissional",
    "desenvolvimento web",
    "sistemas web",
    "sistema web sob medida",
    "integrações",
    "automação",
    "integração WhatsApp",
    "integração CRM",
    "API",
    "tecnologia",
    "agência de sites",
    "empresa de criação de sites",
    "site para empresa",
    "página de captura",
    "SEO para sites",
    "SEO técnico",
    "sites que convertem",
    "software sob medida",
  ],
  authors: [{ name: "Web Prumo", url: siteUrl }],
  creator: "Web Prumo",
  publisher: "Web Prumo",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: siteUrl,
    siteName: "Web Prumo",
    title: "Web Prumo | Criação de Sites e Landing Pages",
    description:
      "A Web Prumo cria sites profissionais, landing pages e sistemas sob medida — do brief ao ar com escopo fechado.",
    images: [
      {
        url: "/og.jpg",
        width: 1200,
        height: 630,
        alt: "Web Prumo — criação de sites e landing pages",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Web Prumo | Criação de Sites e Landing Pages",
    description:
      "Web Prumo: criação de sites, landing pages e sistemas web com foco em conversão. Peça orçamento.",
    images: ["/og.jpg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  icons: {
    icon: [
      { url: "/favicon-48.png", sizes: "48x48", type: "image/png" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon.png", sizes: "192x192", type: "image/png" },
      { url: "/favicon.png", sizes: "512x512", type: "image/png" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: "/favicon-48.png",
  },
  category: "technology",
  manifest: "/site.webmanifest",
  other: {
    "msapplication-TileColor": "#1a1917",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${siteUrl}/#organization`,
      name: "Web Prumo",
      legalName: "Web Prumo",
      alternateName: [
        "WebPrumo",
        "web prumo",
        "webprumo",
        "Web.Prumo",
        "web.prumo",
        "Prumo Web",
      ],
      brand: {
        "@type": "Brand",
        name: "Web Prumo",
        url: siteUrl,
        logo: `${siteUrl}/brand/logo-marca.png`,
      },
      url: siteUrl,
      logo: {
        "@type": "ImageObject",
        url: `${siteUrl}/brand/logo-marca.png`,
        width: 1024,
        height: 1024,
      },
      image: `${siteUrl}/og.jpg`,
      email: "arq.caique@hotmail.com",
      telephone: "+55-11-96633-1995",
      contactPoint: {
        "@type": "ContactPoint",
        contactType: "sales",
        email: "arq.caique@hotmail.com",
        telephone: "+55-11-96633-1995",
        availableLanguage: ["Portuguese", "pt-BR"],
        areaServed: "BR",
      },
      sameAs: [
        "https://www.instagram.com/web.prumo/",
        "https://instagram.com/web.prumo",
      ],
      description:
        "Web Prumo é a empresa de criação de sites, landing pages, sites institucionais e sistemas web com foco em conversão. Site oficial: webprumo.com.br.",
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: "5",
        bestRating: "5",
        worstRating: "1",
        ratingCount: "48",
        reviewCount: "48",
      },
    },
    {
      "@type": "ProfessionalService",
      "@id": `${siteUrl}/#service`,
      name: "Web Prumo — Criação de Sites e Landing Pages",
      alternateName: ["WebPrumo", "web prumo", "webprumo.com.br"],
      image: `${siteUrl}/og.jpg`,
      url: siteUrl,
      brand: { "@id": `${siteUrl}/#organization` },
      email: "arq.caique@hotmail.com",
      telephone: "+55-11-96633-1995",
      priceRange: "$$",
      openingHours: "Mo-Fr 09:00-18:00",
      areaServed: [
        { "@type": "Country", name: "Brasil" },
        { "@type": "City", name: "São Paulo" },
      ],
      address: {
        "@type": "PostalAddress",
        addressLocality: "São Paulo",
        addressRegion: "SP",
        addressCountry: "BR",
      },
      geo: {
        "@type": "GeoCoordinates",
        latitude: -23.5505,
        longitude: -46.6333,
      },
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: "5.0",
        bestRating: "5",
        worstRating: "1",
        ratingCount: "48",
      },
      knowsAbout: [
        "criação de sites",
        "landing pages",
        "desenvolvimento web",
        "sites institucionais",
        "SEO técnico",
        "sistemas web",
        "integrações",
        "automação",
        "WhatsApp Business",
        "APIs",
        "tecnologia",
      ],
      makesOffer: [
        {
          "@type": "Offer",
          url: `${siteUrl}/landing-pages`,
          itemOffered: {
            "@type": "Service",
            name: "Criação de landing pages",
            url: `${siteUrl}/landing-pages`,
            description:
              "Landing pages e páginas de captura focadas em lead, venda ou agendamento.",
          },
        },
        {
          "@type": "Offer",
          url: `${siteUrl}/sites-institucionais`,
          itemOffered: {
            "@type": "Service",
            name: "Criação de sites institucionais",
            url: `${siteUrl}/sites-institucionais`,
            description:
              "Sites profissionais para empresas com SEO técnico e design autoral.",
          },
        },
        {
          "@type": "Offer",
          url: `${siteUrl}/sistemas-web`,
          itemOffered: {
            "@type": "Service",
            name: "Desenvolvimento de sistemas web",
            url: `${siteUrl}/sistemas-web`,
            description: "Painéis, áreas de cliente e ferramentas sob medida.",
          },
        },
        {
          "@type": "Offer",
          url: `${siteUrl}/integracoes`,
          itemOffered: {
            "@type": "Service",
            name: "Integrações e automação",
            url: `${siteUrl}/integracoes`,
            description:
              "WhatsApp, CRM, planilhas, pagamentos e APIs conversando entre si.",
          },
        },
        {
          "@type": "Offer",
          url: `${siteUrl}/criacao-de-sites`,
          itemOffered: {
            "@type": "Service",
            name: "Criação de sites para empresas",
            url: `${siteUrl}/criacao-de-sites`,
            description:
              "Do brief ao ar: site completo com domínio, HTTPS e performance.",
          },
        },
        {
          "@type": "Offer",
          url: `${siteUrl}/desenvolvimento-web`,
          itemOffered: {
            "@type": "Service",
            name: "Desenvolvimento web",
            url: `${siteUrl}/desenvolvimento-web`,
            description:
              "Sites, landings, sistemas e APIs com performance e SEO técnico.",
          },
        },
      ],
    },
    {
      "@type": "WebSite",
      "@id": `${siteUrl}/#website`,
      url: siteUrl,
      name: "Web Prumo",
      alternateName: ["webprumo.com.br", "WebPrumo", "web prumo"],
      description:
        "Site oficial da Web Prumo: criação de sites, landing pages e sistemas web que convertem.",
      publisher: { "@id": `${siteUrl}/#organization` },
      inLanguage: "pt-BR",
    },
    {
      "@type": "FAQPage",
      "@id": `${siteUrl}/#faq`,
      mainEntity: [
        {
          "@type": "Question",
          name: "O que é a Web Prumo?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "A Web Prumo (webprumo.com.br) é a empresa de criação de sites, landing pages, sites institucionais, sistemas web e integrações. Instagram oficial: @web.prumo.",
          },
        },
        {
          "@type": "Question",
          name: "Vocês fazem criação de sites para empresas?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Sim. A Web Prumo desenvolve sites profissionais, sites institucionais e páginas sob medida para empresas de qualquer porte, com design autoral e foco em conversão.",
          },
        },
        {
          "@type": "Question",
          name: "Quanto tempo leva para criar uma landing page?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Em geral, uma landing page fica no ar em 7 a 15 dias, com escopo, prazo e valor fechados antes de começar e duas rodadas de revisão inclusas.",
          },
        },
        {
          "@type": "Question",
          name: "Landing page é diferente de site institucional?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Sim. A landing page foca em uma ação (lead, venda ou agendamento). O site institucional apresenta a marca, serviços e credibilidade com SEO técnico para atrair buscas orgânicas.",
          },
        },
        {
          "@type": "Question",
          name: "Como pedir orçamento de criação de site ou landing page?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Envie um resumo do projeto para arq.caique@hotmail.com ou chame no WhatsApp (11) 96633-1995. Respondemos com proposta, prazo e valor fechados.",
          },
        },
      ],
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${display.variable} ${body.variable} h-full`}>
      <head>
        <link
          rel="preload"
          href="/brand/logo-favicon.png"
          as="image"
          type="image/png"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-full antialiased">
        <div className="grain" aria-hidden />
        <SiteChrome>{children}</SiteChrome>
        <Analytics />
      </body>
    </html>
  );
}
