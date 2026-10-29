"use client";

import { usePathname } from "next/navigation";

const WA =
  "https://wa.me/5511966331995?text=" +
  encodeURIComponent("Olá! Quero um orçamento de site/landing page com a Web Prumo.");

export function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "";
  const isAdmin = pathname.startsWith("/login") || pathname.startsWith("/posts");

  if (isAdmin) {
    return <>{children}</>;
  }

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-[color:var(--line)] bg-[color:var(--glass)] backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 md:px-8">
          <a href="/" className="display text-[1.35rem] tracking-tight text-[color:var(--ink)]">
            Web <span className="text-[color:var(--coral)]">Prumo</span>
          </a>
          <nav className="hidden items-center gap-8 text-sm text-[color:var(--ink-soft)] md:flex">
            <a href="/#como" className="hover:text-[color:var(--ink)]">
              Como fazemos
            </a>
            <a href="/#servicos" className="hover:text-[color:var(--ink)]">
              Serviços
            </a>
            <a href="/#metodo" className="hover:text-[color:var(--ink)]">
              Método
            </a>
            <a href="/#contato" className="hover:text-[color:var(--ink)]">
              Contato
            </a>
          </nav>
          <a className="wa-btn !py-2.5 !px-4 text-sm" href={WA} target="_blank" rel="noopener noreferrer">
            WhatsApp
          </a>
        </div>
      </header>
      {children}
    </>
  );
}
