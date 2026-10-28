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

export const metadata: Metadata = {
  title: "Prumo Web Studio — Sites e landing pages que convertem",
  description:
    "Studio digital para empresas: sites, landing pages e produtos web com performance, segurança e animações de alto nível. Orçamentos no WhatsApp.",
  openGraph: {
    title: "Prumo Web Studio",
    description:
      "Sites e landing pages com acabamento profissional — do brief ao ar em escopo fechado.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${display.variable} ${body.variable} h-full`}>
      <body className="min-h-full antialiased">
        <div className="grain" aria-hidden />
        <SiteChrome>{children}</SiteChrome>
      </body>
    </html>
  );
}
