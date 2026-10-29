import type { Metadata } from "next";
import Link from "next/link";

const WA =
  "https://wa.me/5511966331995?text=" +
  encodeURIComponent("Olá! Quero orçamento de site institucional com a Web Prumo.");

export const metadata: Metadata = {
  title: "Sites Institucionais para Empresas | Web Prumo",
  description:
    "Sites institucionais com credibilidade, SEO técnico e estrutura clara para apresentar sua marca e serviços.",
  alternates: { canonical: "https://www.webprumo.com.br/sites-institucionais" },
  openGraph: {
    title: "Sites Institucionais para Empresas | Web Prumo",
    description:
      "Presença digital profissional: quem somos, o que fazemos e como falar com você — com performance e SEO.",
    url: "https://www.webprumo.com.br/sites-institucionais",
  },
};

const bullets = [
  "Narrativa da marca + serviços + prova + contato",
  "Arquitetura pensada para buscas e navegação fácil",
  "Visual alinhado à identidade, sem cara de template",
  "Base técnica pronta para evoluir (blog, área do cliente, etc.)",
];

export default function SitesInstitucionaisPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-20 md:px-8 md:py-28">
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-coral">
        Serviço
      </p>
      <h1 className="display mt-4 text-[clamp(2.4rem,6vw,4rem)]">
        Sites institucionais com presença de verdade.
      </h1>
      <p className="mt-6 text-lg leading-relaxed text-ink-soft">
        Um site institucional bem feito apresenta sua empresa com clareza:
        quem vocês são, o que entregam e por que confiar — sem páginas
        genéricas ou conteúdo vazio.
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
        Combine com{" "}
        <Link href="/landing-pages" className="text-coral underline-offset-2 hover:underline">
          landing pages
        </Link>{" "}
        de campanha ou veja nossa{" "}
        <Link href="/criacao-de-sites" className="text-coral underline-offset-2 hover:underline">
          criação de sites
        </Link>
        .
      </p>
    </main>
  );
}
