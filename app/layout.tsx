import type { Metadata } from "next";
import { Fraunces, Manrope } from "next/font/google";
import { SiteChrome } from "./components/SiteChrome";
import "./globals.css";

const display = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const body = Manrope({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const siteUrl = "https://www.webprumo.com.br";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Web Prumo — Sites, landing pages e sistemas que convertem",
    template: "%s | Web Prumo",
  },
  description:
    "Web Prumo cria sites, landing pages, sistemas web e integrações com design autoral, SEO técnico e foco em conversão. Orçamento no WhatsApp ou contato@webprumo.com.br.",
  keywords: [
    "criação de sites",
    "landing page",
    "site institucional",
    "desenvolvimento web",
    "Next.js",
    "agência web Brasil",
    "Web Prumo",
    "sites que convertem",
    "SEO",
    "integração WhatsApp",
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
    title: "Web Prumo — Sites e landing pages que convertem",
    description:
      "Sites, landing pages e sistemas sob medida — do brief ao ar com escopo fechado. Performance, SEO e conversão.",
    images: [
      {
        url: "/og.jpg",
        width: 1200,
        height: 630,
        alt: "Web Prumo — studio digital",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Web Prumo — Sites e landing pages que convertem",
    description:
      "Design autoral, código sob medida e foco em resultado. Peça orçamento.",
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
      { url: "/favicon.png", type: "image/png" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
    shortcut: "/favicon.png",
  },
  category: "technology",
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${siteUrl}/#organization`,
      name: "Web Prumo",
      url: siteUrl,
      logo: `${siteUrl}/favicon.png`,
      email: "contato@webprumo.com.br",
      telephone: "+55-11-96633-1995",
      sameAs: ["https://instagram.com/prumo.web"],
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
      name: "Web Prumo",
      image: `${siteUrl}/og.jpg`,
      url: siteUrl,
      email: "contato@webprumo.com.br",
      telephone: "+55-11-96633-1995",
      priceRange: "$$",
      areaServed: {
        "@type": "Country",
        name: "Brasil",
      },
      address: {
        "@type": "PostalAddress",
        addressCountry: "BR",
      },
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: "5.0",
        bestRating: "5",
        worstRating: "1",
        ratingCount: "48",
      },
      makesOffer: [
        {
          "@type": "Offer",
          itemOffered: {
            "@type": "Service",
            name: "Landing pages",
            description: "Páginas de campanha focadas em conversão.",
          },
        },
        {
          "@type": "Offer",
          itemOffered: {
            "@type": "Service",
            name: "Sites institucionais",
            description: "Presença digital com SEO técnico.",
          },
        },
        {
          "@type": "Offer",
          itemOffered: {
            "@type": "Service",
            name: "Sistemas web",
            description: "Painéis e ferramentas sob medida.",
          },
        },
      ],
    },
    {
      "@type": "WebSite",
      "@id": `${siteUrl}/#website`,
      url: siteUrl,
      name: "Web Prumo",
      publisher: { "@id": `${siteUrl}/#organization` },
      inLanguage: "pt-BR",
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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-full antialiased">
        <div className="grain" aria-hidden />
        <SiteChrome>{children}</SiteChrome>
      </body>
    </html>
  );
}
