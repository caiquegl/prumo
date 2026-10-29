import type { Metadata } from "next";
import Link from "next/link";

const WA =
  "https://wa.me/5511966331995?text=" +
  encodeURIComponent("Olá! Quero orçamento de criação de site com a Web Prumo.");

export const metadata: Metadata = {
  title: "Criação de Sites Profissionais | Web Prumo",
  description:
    "Criação de sites para empresas com design autoral, SEO técnico e foco em conversão. Sites rápidos, responsivos e prontos para gerar leads.",
  alternates: { canonical: "https://www.webprumo.com.br/criacao-de-sites" },
  openGraph: {
    title: "Criação de Sites Profissionais | Web Prumo",
    description:
      "Sites institucionais e páginas sob medida com escopo fechado, prazo e valor definidos antes de começar.",
    url: "https://www.webprumo.com.br/criacao-de-sites",
  },
};

const bullets = [
  "Brief objetivo com escopo, prazo e valor fechados",
  "Design autoral + código limpo (sem template genérico)",
  "SEO técnico, performance e mobile-first",
  "Entrega com domínio, HTTPS e documentação",
];

export default function CriacaoDeSitesPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-20 md:px-8 md:py-28">
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-coral">
        Serviço
      </p>
      <h1 className="display mt-4 text-[clamp(2.4rem,6vw,4rem)]">
        Criação de sites que convertem.
      </h1>
      <p className="mt-6 text-lg leading-relaxed text-ink-soft">
        A Web Prumo desenvolve sites profissionais para empresas que precisam de
        presença digital séria: credibilidade, busca orgânica e caminho claro
        até o WhatsApp ou formulário.
      </p>
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
        <a className="wa-btn" href={WA} target="_blank" rel="noopener noreferrer">
          Pedir orçamento no WhatsApp
        </a>
        <Link
          href="/#contato"
          className="inline-flex items-center text-sm font-semibold uppercase tracking-[0.18em] text-ink-soft hover:text-ink"
        >
          contato@webprumo.com.br
        </Link>
      </div>
      <p className="mt-16 text-sm text-ink-soft">
        Também fazemos{" "}
        <Link href="/landing-pages" className="text-coral underline-offset-2 hover:underline">
          landing pages
        </Link>{" "}
        e{" "}
        <Link
          href="/sites-institucionais"
          className="text-coral underline-offset-2 hover:underline"
        >
          sites institucionais
        </Link>
        .
      </p>
    </main>
  );
}
