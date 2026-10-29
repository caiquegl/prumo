import { BuildStory } from "./components/BuildStory";
import { Reveal } from "./components/Reveal";
import { TextReveal } from "./components/TextReveal";

const WA =
  "https://wa.me/5511966331995?text=" +
  encodeURIComponent("Olá! Quero um orçamento com a Web Prumo.");

const CONTACT_EMAIL = "contato@webprumo.com.br";

const services = [
  {
    title: "Landing pages",
    tag: "Conversão",
    href: "/landing-pages",
    body: "Criação de landing pages e páginas de captura focadas em lead, venda ou agendamento.",
  },
  {
    title: "Sites institucionais",
    tag: "Marca",
    href: "/sites-institucionais",
    body: "Criação de sites profissionais com credibilidade, SEO técnico e fácil atualização.",
  },
  {
    title: "Sistemas web",
    tag: "Produto",
    href: "/sistemas-web",
    body: "Desenvolvimento de sites e painéis sob medida: área do cliente e ferramentas internas.",
  },
  {
    title: "Integrações e automação",
    tag: "Operação",
    href: "/integracoes",
    body: "WhatsApp, CRM, planilhas, pagamentos e APIs conversando entre si.",
  },
  {
    title: "Desenvolvimento web",
    tag: "Tecnologia",
    href: "/desenvolvimento-web",
    body: "Sites, landings, sistemas e APIs — código próprio com performance e SEO técnico.",
  },
  {
    title: "SEO para sites",
    tag: "Busca",
    href: "/seo-para-sites",
    body: "Sitemap, Search Console, dados estruturados e páginas que ranqueiam o que seu cliente pesquisa.",
  },
];

const commitments = [
  { value: "7–15", unit: "dias", label: "para uma landing page no ar" },
  { value: "2", unit: "rodadas", label: "de revisão inclusas" },
  { value: "100%", unit: "", label: "responsivo, do celular ao desktop" },
  { value: "5,0", unit: "★", label: "nota máxima de satisfação" },
];

const steps = [
  {
    n: "01",
    title: "Brief objetivo",
    body: "Escopo, prazo e valor fechados antes de começar. Sem reuniões intermináveis.",
  },
  {
    n: "02",
    title: "Design e código",
    body: "Você aprova o visual, nós desenvolvemos. Prévia online durante todo o projeto.",
  },
  {
    n: "03",
    title: "Lançamento",
    body: "Deploy, domínio, testes finais e entrega com tudo documentado.",
  },
];

const faqs = [
  {
    q: "O que é a Web Prumo?",
    a: "A Web Prumo (webprumo.com.br, Instagram @web.prumo) é a empresa de criação de sites, landing pages, sites institucionais, sistemas web e integrações. Trabalhamos com escopo, prazo e valor fechados antes de começar.",
  },
  {
    q: "Vocês fazem criação de sites para empresas?",
    a: "Sim. Desenvolvemos sites profissionais, sites institucionais e páginas sob medida para empresas — com design autoral, SEO técnico e foco em gerar leads e vendas.",
  },
  {
    q: "Quanto tempo leva para criar uma landing page?",
    a: "Em geral, uma landing page (página de captura) fica no ar em 7 a 15 dias, com duas rodadas de revisão inclusas e escopo fechado antes de começar.",
  },
  {
    q: "Landing page é diferente de site institucional?",
    a: "Sim. A landing page converte uma ação específica. O site institucional apresenta sua marca e serviços, com estrutura pensada para buscas como criação de sites e presença digital.",
  },
  {
    q: "Como pedir orçamento de criação de site?",
    a: "Escreva para contato@webprumo.com.br ou chame no WhatsApp (11) 96633-1995. Enviamos proposta, prazo e valor fechados.",
  },
];

export default function Home() {
  return (
    <main id="topo">
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden
          style={{
            background:
              "radial-gradient(ellipse 70% 55% at 85% 0%, rgba(232,122,103,0.2), transparent 60%)",
          }}
        />
        <div className="relative mx-auto flex min-h-[calc(100svh-65px)] max-w-6xl flex-col justify-center px-5 py-20 md:px-8">
          <div className="rise flex flex-wrap items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/logo-instagram.png"
              alt="Web Prumo"
              width={120}
              height={120}
              className="h-16 w-16 object-contain md:h-20 md:w-20"
            />
            <span
              className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white/70 px-3 py-1 text-xs font-semibold text-ink"
              aria-label="Nota 5 de 5"
            >
              <span className="text-coral" aria-hidden>
                ★★★★★
              </span>
              <span>5,0</span>
            </span>
          </div>
          <h1
            className="rise display mt-6 max-w-[16ch] text-[clamp(3rem,9vw,6.8rem)]"
            style={{ animationDelay: "90ms" }}
          >
            Web Prumo: criação de sites que trabalham pelo seu{" "}
            <span className="text-coral">negócio</span>.
          </h1>
          <p
            className="rise mt-8 max-w-xl text-lg leading-relaxed text-ink-soft md:text-xl"
            style={{ animationDelay: "180ms" }}
          >
            A Web Prumo (webprumo.com.br) cria landing pages, sites
            institucionais, sistemas web e integrações — sites sob medida com
            design autoral, SEO técnico e foco em conversão.
          </p>
          <div className="rise mt-10 flex flex-wrap gap-3" style={{ animationDelay: "270ms" }}>
            <a className="wa-btn" href={WA} target="_blank" rel="noopener noreferrer">
              Pedir orçamento <span aria-hidden>→</span>
            </a>
            <a className="wa-btn ghost" href="#como">
              Ver como fazemos
            </a>
          </div>
          <div
            className="rise mt-20 flex items-center gap-3 text-[11px] uppercase tracking-[0.24em] text-ink-soft"
            style={{ animationDelay: "400ms" }}
          >
            <span className="scroll-cue block h-9 w-px bg-ink/40" />
            Role para ver o processo
          </div>
        </div>
      </section>

      <TextReveal />

      <BuildStory />

      <section id="servicos" className="mx-auto max-w-6xl px-5 py-24 md:px-8 md:py-32">
        <Reveal>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-coral">Serviços</p>
          <h2 className="display mt-4 max-w-[15ch] text-[clamp(2.2rem,5vw,3.8rem)]">
            Tudo que sua presença digital precisa.
          </h2>
        </Reveal>
        <ul className="mt-14 border-b border-line">
          {services.map((service, i) => (
            <Reveal
              key={service.title}
              as="li"
              delay={i * 60}
              className="service-row grid cursor-default gap-3 border-t border-line py-7 md:grid-cols-[1.1fr_1fr_auto] md:items-center md:gap-8"
            >
              <h3 className="service-title display text-[clamp(1.6rem,3vw,2.3rem)]">
                {"href" in service && service.href ? (
                  <a href={service.href} className="hover:text-coral">
                    {service.title}
                  </a>
                ) : (
                  service.title
                )}
              </h3>
              <p className="text-[0.98rem] leading-relaxed text-ink-soft">{service.body}</p>
              <span className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-ink-soft">
                {service.tag}
                <span className="service-arrow text-coral" aria-hidden>
                  →
                </span>
              </span>
            </Reveal>
          ))}
        </ul>
      </section>

      <section className="bg-ink text-[#f7f2ea]">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-20 sm:grid-cols-2 md:grid-cols-4 md:px-8 md:py-24">
          {commitments.map((item, i) => (
            <Reveal key={item.label} delay={i * 80}>
              <p className="display text-[clamp(2.6rem,5vw,3.8rem)]">
                {item.value}
                {item.unit && (
                  <span className="ml-2 font-sans text-base tracking-normal text-[#d4cdc2]">
                    {item.unit}
                  </span>
                )}
              </p>
              <p className="mt-3 max-w-[22ch] text-sm leading-relaxed text-[#e4ddd2]">{item.label}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <section id="metodo" className="mx-auto max-w-6xl px-5 py-24 md:px-8 md:py-32">
        <Reveal>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-coral">Método</p>
          <h2 className="display mt-4 text-[clamp(2.2rem,5vw,3.6rem)]">Do brief ao ar, sem surpresa.</h2>
        </Reveal>
        <div className="mt-14 grid gap-12 md:grid-cols-3">
          {steps.map((step, i) => (
            <Reveal key={step.n} delay={i * 80}>
              <div className="border-t border-line pt-6">
                <p className="text-sm font-semibold tracking-[0.2em] text-coral">{step.n}</p>
                <h3 className="display mt-3 text-2xl">{step.title}</h3>
                <p className="mt-3 text-[0.98rem] leading-relaxed text-ink-soft">{step.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section id="faq" className="mx-auto max-w-6xl px-5 py-24 md:px-8 md:py-32">
        <Reveal>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-coral">FAQ</p>
          <h2 className="display mt-4 max-w-[18ch] text-[clamp(2.2rem,5vw,3.6rem)]">
            Criação de sites e landing pages — perguntas frequentes
          </h2>
          <p className="mt-5 max-w-2xl text-[0.98rem] leading-relaxed text-ink-soft">
            Tire dúvidas sobre desenvolvimento de sites, páginas de captura e
            como a Web Prumo coloca seu projeto no ar com escopo fechado.
          </p>
        </Reveal>
        <div className="mt-12 divide-y divide-line border-y border-line">
          {faqs.map((item, i) => (
            <Reveal key={item.q} delay={i * 60}>
              <details className="group py-6">
                <summary className="display cursor-pointer list-none text-xl text-ink marker:content-none [&::-webkit-details-marker]:hidden">
                  <span className="flex items-start justify-between gap-4">
                    {item.q}
                    <span className="text-coral transition group-open:rotate-45" aria-hidden>
                      +
                    </span>
                  </span>
                </summary>
                <p className="mt-3 max-w-3xl text-[0.98rem] leading-relaxed text-ink-soft">{item.a}</p>
              </details>
            </Reveal>
          ))}
        </div>
      </section>

      <section id="contato" className="relative overflow-hidden bg-ink text-[#f7f2ea]">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          aria-hidden
          style={{
            background:
              "radial-gradient(ellipse 60% 80% at 85% 20%, rgba(232,122,103,0.45), transparent 55%)",
          }}
        />
        <div className="relative mx-auto flex max-w-6xl flex-col items-start gap-10 px-5 py-24 md:flex-row md:items-end md:justify-between md:px-8 md:py-32">
          <Reveal>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-coral">Orçamento</p>
            <h2 className="display mt-4 max-w-[14ch] text-[clamp(2.4rem,5.5vw,4rem)]">
              Vamos tirar seu projeto do papel?
            </h2>
            <p className="mt-5 max-w-md text-[#d6d0c6]">
              Conte em poucas linhas o que você precisa. Respondemos com proposta,
              prazo e valor fechados.
            </p>
          </Reveal>
          <Reveal delay={100}>
            <a
              className="wa-btn !bg-coral !text-ink hover:!bg-[#f09180]"
              href={WA}
              target="_blank"
              rel="noopener noreferrer"
            >
              Chamar no WhatsApp <span aria-hidden>→</span>
            </a>
            <p className="mt-4 text-sm text-[#d4cdc2]">(11) 96633-1995</p>
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="mt-2 block text-sm font-medium text-[#f7f2ea] underline decoration-coral/60 underline-offset-4 hover:decoration-coral"
            >
              {CONTACT_EMAIL}
            </a>
          </Reveal>
        </div>
      </section>

      <footer className="border-t border-line bg-bg-deep">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-8 text-sm text-ink-soft md:flex-row md:items-center md:justify-between md:px-8">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/logo-favicon.png"
              alt=""
              width={32}
              height={32}
              className="h-8 w-8 object-contain"
            />
            <p className="display text-base text-ink">Web Prumo</p>
          </div>
          <p>
            <a href="/web-prumo" className="hover:text-ink">
              Sobre a Web Prumo
            </a>
            {" · "}
            Sites · landing pages · sistemas · integrações
          </p>
          <div className="flex flex-col gap-1 md:items-end">
            <a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-ink">
              {CONTACT_EMAIL}
            </a>
            <a
              href="https://www.instagram.com/web.prumo/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-ink"
            >
              Instagram @web.prumo
            </a>
            <span className="text-xs">webprumo.com.br</span>
          </div>
        </div>
      </footer>

      <a
        href={WA}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Falar no WhatsApp"
        className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#2f9e62] text-white shadow-lg transition-transform hover:scale-105"
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.4.1-.7.3-.2.3-.9.9-.9 2.2s.9 2.5 1 2.7c.1.2 1.8 2.8 4.4 3.9 1.6.7 2.3.8 3.1.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2l-.6-.3Z" />
        </svg>
      </a>
    </main>
  );
}
