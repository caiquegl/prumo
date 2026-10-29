import type { Metadata } from "next";
import Link from "next/link";

const WA =
  "https://wa.me/5511966331995?text=" +
  encodeURIComponent("Olá! Quero orçamento de landing page com a Web Prumo.");

export const metadata: Metadata = {
  title: "Criação de Landing Pages que Convertem | Web Prumo",
  description:
    "Landing pages e páginas de captura focadas em lead, venda ou agendamento. No ar em 7 a 15 dias, com duas rodadas de revisão.",
  alternates: { canonical: "https://www.webprumo.com.br/landing-pages" },
  openGraph: {
    title: "Criação de Landing Pages que Convertem | Web Prumo",
    description:
      "Páginas de captura com mensagem clara, prova social e CTA forte — feitas para converter.",
    url: "https://www.webprumo.com.br/landing-pages",
  },
};

const bullets = [
  "Uma oferta, uma mensagem, um CTA — sem distração",
  "Estrutura pensada em conversão (hero, prova, objeções, formulário/WhatsApp)",
  "Prazo típico: 7 a 15 dias com 2 rodadas de revisão",
  "Integração com WhatsApp, CRM ou planilha quando precisar",
];

export default function LandingPagesPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-20 md:px-8 md:py-28">
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-coral">
        Serviço
      </p>
      <h1 className="display mt-4 text-[clamp(2.4rem,6vw,4rem)]">
        Landing pages feitas para gerar lead.
      </h1>
      <p className="mt-6 text-lg leading-relaxed text-ink-soft">
        Criamos páginas de captura para campanhas, lançamentos e anúncios.
        Escopo fechado, visual autoral e foco em uma ação: clicar, preencher ou
        chamar no WhatsApp.
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
        Veja também{" "}
        <Link href="/criacao-de-sites" className="text-coral underline-offset-2 hover:underline">
          criação de sites
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
