import type { Metadata } from "next";
import { Fraunces, Manrope } from "next/font/google";
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

const WA =
  "https://wa.me/5511966331995?text=" +
  encodeURIComponent(
    "Olá! Quero um orçamento de site/landing page com a Prumo Web.",
  );

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${display.variable} ${body.variable} h-full`}>
      <body className="min-h-full antialiased">
        <div className="grain" aria-hidden />
        <header className="sticky top-0 z-40 border-b border-[color:var(--line)] bg-[color:var(--glass)] backdrop-blur-md">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 md:px-8">
            <a href="#topo" className="display text-[1.35rem] tracking-tight text-[color:var(--ink)]">
              Prumo <span className="text-[color:var(--coral)]">Web</span>
            </a>
            <nav className="hidden items-center gap-8 text-sm text-[color:var(--ink-soft)] md:flex">
              <a href="#craft" className="hover:text-[color:var(--ink)]">
                Craft
              </a>
              <a href="#pilares" className="hover:text-[color:var(--ink)]">
                Pilares
              </a>
              <a href="#metodo" className="hover:text-[color:var(--ink)]">
                Método
              </a>
            </nav>
            <a className="wa-btn !py-2.5 !px-4 text-sm" href={WA} target="_blank" rel="noopener noreferrer">
              WhatsApp
            </a>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
