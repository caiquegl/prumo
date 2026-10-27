import Image from "next/image";
import { Reveal } from "./components/Reveal";
import { ScrollDevice } from "./components/ScrollDevice";

const WA =
  "https://wa.me/5511966331995?text=" +
  encodeURIComponent(
    "Olá! Quero um orçamento de site/landing page com a Prumo Web.",
  );

const pillars = [
  {
    title: "Segurança",
    body: "HTTPS, autenticação e tratamento de dados pensados desde o primeiro commit — não como anexo no final.",
  },
  {
    title: "Automação",
    body: "Fluxos que tiram trabalho repetitivo do caminho: formulários, integrações e operações que rodam sem atrito.",
  },
  {
    title: "Inovação",
    body: "Scroll cinematográfico, microinterações e performance — o tipo de detalhe que o cliente sente sem saber nomear.",
  },
];

const steps = [
  {
    n: "01",
    title: "Brief objetivo",
    body: "Escopo fechado, prazo e valor claros. Sem reuniões eternas.",
  },
  {
    n: "02",
    title: "Design + código",
    body: "Uma composição forte, tipografia expressa e animações com intenção — não decoração.",
  },
  {
    n: "03",
    title: "No ar",
    body: "Deploy, ajustes finais e handoff. Até duas rodadas de revisão inclusas.",
  },
];

export default function Home() {
  return (
    <main id="topo">
      {/* Hero — one composition */}
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden
          style={{
            background:
              "radial-gradient(ellipse 80% 55% at 70% -10%, rgba(232,122,103,0.22), transparent 55%), radial-gradient(ellipse 50% 40% at 10% 80%, rgba(26,25,23,0.06), transparent 50%)",
          }}
        />
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 pb-16 pt-14 md:grid-cols-[1.05fr_0.95fr] md:gap-6 md:px-8 md:pb-24 md:pt-20">
          <div>
            <p className="mb-5 text-xs font-semibold uppercase tracking-[0.28em] text-[color:var(--coral)]">
              Prumo Web Studio
            </p>
            <h1 className="display max-w-[11ch] text-[clamp(2.8rem,8vw,5.4rem)] text-[color:var(--ink)]">
              Sites que <span className="text-[color:var(--coral)]">convertem</span>
              <span className="text-[color:var(--ink-soft)]">.</span>
            </h1>
            <p className="mt-6 max-w-md text-base leading-relaxed text-[color:var(--ink-soft)] md:text-lg">
              Landing pages e produtos web com acabamento de marca premium —
              performance, segurança e movimento no scroll, no estilo das
              melhores vitrines digitais.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <a className="wa-btn" href={WA} target="_blank" rel="noopener noreferrer">
                Pedir orçamento
                <span aria-hidden>→</span>
              </a>
              <a className="wa-btn ghost" href="#craft">
                Ver o craft
              </a>
            </div>
            <p className="mt-5 text-sm text-[color:var(--ink-soft)]">
              WhatsApp{" "}
              <a
                className="font-medium text-[color:var(--ink)] underline-offset-4 hover:underline"
                href={WA}
                target="_blank"
                rel="noopener noreferrer"
              >
                (11) 96633-1995
              </a>
            </p>
          </div>
          <ScrollDevice />
        </div>
      </section>

      <div className="section-rule mx-auto max-w-6xl" />

      {/* Craft */}
      <section id="craft" className="mx-auto max-w-6xl px-5 py-20 md:px-8 md:py-28">
        <Reveal>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[color:var(--coral)]">
            Craft
          </p>
          <h2 className="display mt-4 max-w-[16ch] text-[clamp(2rem,5vw,3.4rem)]">
            Scroll que conta história — sem barulho.
          </h2>
        </Reveal>
        <div className="mt-12 grid gap-10 md:grid-cols-2 md:items-center">
          <Reveal delay={80}>
            <p className="text-lg leading-relaxed text-[color:var(--ink-soft)]">
              Em landing pages de alto nível, o produto responde ao scroll,
              a tipografia tem respiro e cada seção tem um único trabalho.
              O resultado é presença — não um carrossel de efeitos.
            </p>
            <ul className="mt-8 space-y-4 text-[color:var(--ink)]">
              {[
                "Animação guiada pelo scroll (tilt 3D do produto)",
                "Hierarquia tipográfica forte e poucos elementos no primeiro viewport",
                "Microinterações só onde aumentam clareza ou desejo",
              ].map((item) => (
                <li key={item} className="flex gap-3 text-[0.98rem] leading-snug">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--coral)]" />
                  {item}
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={160} className="relative">
            <div className="relative aspect-[4/5] overflow-hidden rounded-[1.6rem] bg-[color:var(--bg-deep)]">
              <Image
                src="/ig/prumo-feed-13-microinteracoes.jpg"
                alt="Composição sobre microinterações e acabamento de interface"
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 40vw"
                priority={false}
              />
            </div>
          </Reveal>
        </div>
      </section>

      <div className="section-rule mx-auto max-w-6xl" />

      {/* Pilares */}
      <section id="pilares" className="mx-auto max-w-6xl px-5 py-20 md:px-8 md:py-28">
        <Reveal>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[color:var(--coral)]">
            Pilares
          </p>
          <h2 className="display mt-4 max-w-[14ch] text-[clamp(2rem,5vw,3.2rem)]">
            Segurança. Automação. Inovação.
          </h2>
        </Reveal>
        <div className="mt-14 grid gap-8 md:grid-cols-3">
          {pillars.map((p, i) => (
            <Reveal key={p.title} delay={i * 90}>
              <article className="h-full border-t border-[color:var(--line)] pt-6">
                <h3 className="display text-2xl">{p.title}</h3>
                <p className="mt-4 text-[0.98rem] leading-relaxed text-[color:var(--ink-soft)]">
                  {p.body}
                </p>
              </article>
            </Reveal>
          ))}
        </div>
        <div className="mt-14 grid gap-4 sm:grid-cols-3">
          {[
            "/ig/prumo-feed-09-seguranca.jpg",
            "/ig/prumo-feed-10-automacao.jpg",
            "/ig/prumo-feed-11-inovacao.jpg",
          ].map((src, i) => (
            <Reveal key={src} delay={120 + i * 70} className="relative aspect-square overflow-hidden rounded-2xl">
              <Image src={src} alt="" fill className="object-cover" sizes="33vw" />
            </Reveal>
          ))}
        </div>
      </section>

      <div className="section-rule mx-auto max-w-6xl" />

      {/* Método */}
      <section id="metodo" className="mx-auto max-w-6xl px-5 py-20 md:px-8 md:py-28">
        <Reveal>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[color:var(--coral)]">
            Método
          </p>
          <h2 className="display mt-4 text-[clamp(2rem,5vw,3.2rem)]">
            Do brief ao ar, sem surpresa.
          </h2>
        </Reveal>
        <div className="mt-14 grid gap-10 md:grid-cols-3">
          {steps.map((s, i) => (
            <Reveal key={s.n} delay={i * 80}>
              <p className="text-sm font-semibold tracking-[0.2em] text-[color:var(--coral)]">
                {s.n}
              </p>
              <h3 className="display mt-3 text-2xl">{s.title}</h3>
              <p className="mt-3 text-[0.98rem] leading-relaxed text-[color:var(--ink-soft)]">
                {s.body}
              </p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden border-t border-[color:var(--line)] bg-[color:var(--ink)] text-[#f7f2ea]">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          aria-hidden
          style={{
            background:
              "radial-gradient(ellipse 60% 80% at 85% 20%, rgba(232,122,103,0.45), transparent 55%)",
          }}
        />
        <div className="relative mx-auto flex max-w-6xl flex-col items-start gap-8 px-5 py-20 md:flex-row md:items-end md:justify-between md:px-8 md:py-28">
          <Reveal>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[color:var(--coral)]">
              Orçamento
            </p>
            <h2 className="display mt-4 max-w-[14ch] text-[clamp(2.2rem,5vw,3.6rem)]">
              Vamos alinhar o próximo lançamento.
            </h2>
            <p className="mt-5 max-w-md text-[#d6d0c6]">
              Escopo fechado, comunicação direta e entrega async. Fale no
              WhatsApp e receba a proposta com prazo e valor.
            </p>
          </Reveal>
          <Reveal delay={100}>
            <a
              className="wa-btn !bg-[color:var(--coral)] !text-[color:var(--ink)] hover:!bg-[#f09180]"
              href={WA}
              target="_blank"
              rel="noopener noreferrer"
            >
              Chamar no WhatsApp
              <span aria-hidden>→</span>
            </a>
            <p className="mt-4 text-sm text-[#a9a29a]">(11) 96633-1995</p>
          </Reveal>
        </div>
      </section>

      <footer className="border-t border-[color:var(--line)] bg-[color:var(--bg-deep)]">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-8 text-sm text-[color:var(--ink-soft)] md:flex-row md:items-center md:justify-between md:px-8">
          <p className="display text-base text-[color:var(--ink)]">Prumo Web Studio</p>
          <p>Sites · landing pages · produtos web</p>
          <a
            href="https://instagram.com/prumo264"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[color:var(--ink)]"
          >
            @prumo264
          </a>
        </div>
      </footer>
    </main>
  );
}
