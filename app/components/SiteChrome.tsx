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
          <a
            href="/"
            className="flex items-center gap-2.5 text-[color:var(--ink)]"
            aria-label="Web Prumo — início"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/logo-favicon.png"
              alt=""
              width={36}
              height={36}
              decoding="async"
              fetchPriority="high"
              className="h-9 w-9 object-contain"
            />
            <span className="display text-[1.2rem] tracking-tight">
              <span className="font-medium text-[color:var(--coral)]">Web</span>{" "}
              <span className="font-semibold">Prumo</span>
            </span>
          </a>
          <nav className="hidden items-center gap-6 text-sm text-[color:var(--ink-soft)] lg:gap-8 md:flex">
            <a href="/criacao-de-sites" className="hover:text-[color:var(--ink)]">
              Criação de sites
            </a>
            <a href="/landing-pages" className="hover:text-[color:var(--ink)]">
              Landing pages
            </a>
            <a href="/sites-institucionais" className="hover:text-[color:var(--ink)]">
              Institucionais
            </a>
            <a href="/sistemas-web" className="hover:text-[color:var(--ink)]">
              Sistemas
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
