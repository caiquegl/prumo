"use client";

import { segment, useScrollProgress } from "./useScrollProgress";

const STEPS = [
  {
    k: "01",
    title: "Estratégia",
    body: "Começamos pelo objetivo: gerar leads, vender ou agendar. Cada decisão de layout nasce daqui.",
  },
  {
    k: "02",
    title: "Estrutura",
    body: "A arquitetura da página: o que o visitante vê primeiro, o que convence e onde ele age.",
  },
  {
    k: "03",
    title: "Design",
    body: "Tipografia, cor e ritmo com a identidade da sua marca. Nada de template genérico.",
  },
  {
    k: "04",
    title: "Código",
    body: "Next.js, React e TypeScript. Código limpo, rápido e fácil de evoluir.",
  },
  {
    k: "05",
    title: "Integrações",
    body: "WhatsApp, CRM, pagamentos e analytics conectados. O lead chega onde sua equipe já trabalha.",
  },
  {
    k: "06",
    title: "No ar",
    body: "Domínio, HTTPS e performance medida. Site pronto para receber tráfego e clientes.",
  },
];

const GOALS = ["Gerar leads", "Vender online", "Agendar horários"];

const CODE = `export default function Page() {
  return (
    <Hero
      title="Seu negócio, no ponto."
      cta={{
        label: "Falar no WhatsApp",
        href: whatsapp,
      }}
    />
  );
}`;

const NODES = [
  { label: "WhatsApp", color: "#2f9e62", pos: "left-0 top-1" },
  { label: "CRM", color: "#1a1917", pos: "right-0 top-1" },
  { label: "Analytics", color: "#e87a67", pos: "left-0 bottom-1" },
  { label: "Pagamentos", color: "#b8922e", pos: "right-0 bottom-1" },
];

const LINE_ORIGINS: [number, number][] = [
  [6, 6],
  [94, 6],
  [6, 94],
  [94, 94],
];

function MockPage({ build, variant }: { build: number; variant: "wire" | "design" }) {
  const wire = variant === "wire";
  const item = (j: number) => {
    const t = segment(build, j * 0.1, j * 0.1 + 0.4);
    return { opacity: t, transform: `translateY(${(1 - t) * 14}px)` };
  };
  const dashed = "border border-dashed border-ink/25";

  return (
    <div className="absolute inset-0 flex flex-col gap-2.5 p-3.5 md:gap-4 md:p-6">
      <div
        style={item(0)}
        className={`flex items-center justify-between rounded-md px-3 py-2 ${wire ? dashed : "bg-white/80"}`}
      >
        {wire ? (
          <span className="h-2 w-14 rounded bg-ink/15" />
        ) : (
          <span className="display text-[11px] md:text-sm">Sua Marca</span>
        )}
        <div className="flex gap-2 md:gap-3">
          {["Serviços", "Sobre", "Contato"].map((label) =>
            wire ? (
              <span key={label} className="h-1.5 w-7 rounded bg-ink/15 md:w-9" />
            ) : (
              <span key={label} className="text-[8px] text-ink-soft md:text-[10px]">
                {label}
              </span>
            ),
          )}
        </div>
      </div>

      <div
        style={item(1)}
        className={`flex flex-1 flex-col justify-center gap-2 rounded-lg px-4 md:px-6 ${
          wire ? dashed : "bg-ink text-[#f7f2ea]"
        }`}
      >
        {wire ? (
          <>
            <span className="h-3 w-3/4 rounded bg-ink/15" />
            <span className="h-3 w-1/2 rounded bg-ink/15" />
            <span className="mt-1 h-2 w-2/3 rounded bg-ink/10" />
          </>
        ) : (
          <>
            <p className="display text-[15px] leading-tight md:text-[28px]">
              Seu negócio,
              <br />
              no ponto.
            </p>
            <p className="text-[8px] text-[#d6d0c6] md:text-[11px]">
              Atendimento rápido e orçamento em minutos.
            </p>
          </>
        )}
        <span
          style={item(2)}
          className={`mt-1.5 inline-flex w-fit rounded-full px-3 py-1.5 text-[8px] font-semibold md:text-[11px] ${
            wire ? "border border-dashed border-ink/30 text-transparent" : "bg-coral text-ink"
          }`}
        >
          Falar no WhatsApp
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 md:gap-3">
        {["Rápido", "Seguro", "Integrado"].map((label, i) => (
          <div
            key={label}
            style={item(3 + i)}
            className={`h-12 rounded-md p-2 md:h-20 md:p-3 ${wire ? dashed : "bg-white/85"}`}
          >
            {wire ? (
              <span className="block h-1.5 w-2/3 rounded bg-ink/15" />
            ) : (
              <>
                <span className="block h-2 w-2 rounded-full bg-coral" />
                <span className="mt-1.5 block text-[8px] font-semibold md:mt-2 md:text-[11px]">
                  {label}
                </span>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function BuildStory() {
  const [ref, p] = useScrollProgress<HTMLElement>();
  const n = STEPS.length;
  const s = (i: number) => segment(p, i / n, (i + 0.75) / n);
  const active = Math.min(n - 1, Math.floor(p * n));
  const [s0, s1, s2, s3, s4, s5] = STEPS.map((_, i) => s(i));

  const typed = CODE.slice(0, Math.floor(s3 * CODE.length));
  const live = s5 > 0.35;
  const ring = 2 * Math.PI * 18;
  const score = Math.round(segment(s5, 0, 0.8) * 100);
  const toast = segment(s5, 0.5, 0.9);

  return (
    <section id="como" ref={ref} className="relative h-[700vh] bg-bg-deep">
      <div className="sticky top-0 flex h-screen items-center overflow-hidden">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-6 px-5 md:grid-cols-[0.8fr_1.2fr] md:gap-12 md:px-8">
          <div className="order-2 md:order-1">
            <h2 className="text-xs font-semibold uppercase tracking-[0.28em] text-coral">
              Como construímos
            </h2>

            <ol className="mt-6 hidden space-y-5 md:block">
              {STEPS.map((step, i) => (
                <li
                  key={step.k}
                  className="flex gap-4 transition-opacity duration-500"
                  style={{ opacity: i === active ? 1 : 0.28 }}
                >
                  <span className="mt-1.5 text-xs font-semibold tracking-[0.2em] text-coral">
                    {step.k}
                  </span>
                  <div>
                    <h3 className="display text-2xl">{step.title}</h3>
                    <p
                      className={`overflow-hidden text-[0.95rem] leading-relaxed text-ink-soft transition-all duration-500 ${
                        i === active ? "mt-2 max-h-32 opacity-100" : "max-h-0 opacity-0"
                      }`}
                    >
                      {step.body}
                    </p>
                  </div>
                </li>
              ))}
            </ol>

            <div className="mt-3 md:hidden">
              <p className="text-xs font-semibold tracking-[0.2em] text-coral">
                {STEPS[active].k}
              </p>
              <h3 className="display mt-1 text-2xl">{STEPS[active].title}</h3>
              <p className="mt-2 text-[0.95rem] leading-relaxed text-ink-soft">
                {STEPS[active].body}
              </p>
            </div>

            <div className="mt-8 h-px w-full bg-ink/10">
              <div className="h-px bg-coral" style={{ width: `${p * 100}%` }} />
            </div>
          </div>

          <div className="order-1 md:order-2">
            <div className="relative px-3 py-9 md:px-12 md:py-14">
              <svg
                className="pointer-events-none absolute inset-0 h-full w-full"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                aria-hidden
              >
                {LINE_ORIGINS.map(([x, y], i) => (
                  <line
                    key={i}
                    x1={x}
                    y1={y}
                    x2={50}
                    y2={50}
                    stroke="var(--coral)"
                    strokeWidth={1.2}
                    vectorEffect="non-scaling-stroke"
                    pathLength={100}
                    strokeDasharray="100"
                    strokeDashoffset={100 * (1 - segment(s4, i * 0.12, i * 0.12 + 0.55))}
                  />
                ))}
              </svg>

              {NODES.map((node, i) => {
                const t = segment(s4, i * 0.12, i * 0.12 + 0.55);
                return (
                  <div
                    key={node.label}
                    className={`absolute z-20 ${node.pos} flex items-center gap-1.5 rounded-full border border-ink/10 bg-white px-3 py-1.5 text-[10px] font-semibold shadow-sm md:text-xs`}
                    style={{ opacity: t, transform: `scale(${0.85 + 0.15 * t})` }}
                  >
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: node.color }} />
                    {node.label}
                  </div>
                );
              })}

              <div className="relative z-10 overflow-hidden rounded-xl border border-ink/10 bg-[#fbf8f3] shadow-[0_30px_80px_-30px_rgba(26,25,23,0.35)]">
                <div className="flex items-center gap-2 border-b border-ink/10 bg-white/70 px-3 py-2">
                  <span className="flex gap-1">
                    <span className="h-2 w-2 rounded-full bg-ink/15" />
                    <span className="h-2 w-2 rounded-full bg-ink/15" />
                    <span className="h-2 w-2 rounded-full bg-ink/15" />
                  </span>
                  <div className="ml-1 flex flex-1 items-center gap-1.5 truncate rounded-md bg-ink/5 px-2.5 py-1 text-[10px] text-ink-soft md:text-xs">
                    {live ? (
                      <>
                        <svg width="9" height="10" viewBox="0 0 9 10" aria-hidden>
                          <rect x="0.5" y="4" width="8" height="5.5" rx="1" fill="#2f9e62" />
                          <path d="M2.2 4V2.8a2.3 2.3 0 0 1 4.6 0V4" stroke="#2f9e62" fill="none" />
                        </svg>
                        <span className="text-ink">https://seunegocio.com.br</span>
                      </>
                    ) : (
                      <span>rascunho · projeto-novo</span>
                    )}
                  </div>
                  {live && (
                    <span className="hidden text-[10px] font-semibold text-[#2f9e62] sm:inline">
                      ● online
                    </span>
                  )}
                </div>

                <div className="relative aspect-[16/11]">
                  <div
                    className="absolute inset-0 flex flex-col items-center justify-center gap-3"
                    style={{ opacity: s0 * (1 - s1) }}
                  >
                    <p className="text-[10px] uppercase tracking-[0.24em] text-ink-soft md:text-xs">
                      Qual é o objetivo?
                    </p>
                    <div className="flex flex-wrap justify-center gap-2 px-4">
                      {GOALS.map((goal, i) => {
                        const t = segment(s0, i * 0.15, i * 0.15 + 0.4);
                        const picked = i === 0 && s0 > 0.65;
                        return (
                          <span
                            key={goal}
                            className={`rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors duration-300 md:text-sm ${
                              picked ? "border-coral bg-coral/15 text-ink" : "border-ink/15 bg-white text-ink-soft"
                            }`}
                            style={{ opacity: t, transform: `translateY(${(1 - t) * 10}px)` }}
                          >
                            {goal}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  <div className="absolute inset-0" style={{ opacity: s1 * (1 - s2) }}>
                    <MockPage build={s1} variant="wire" />
                  </div>

                  <div
                    className="absolute inset-0"
                    style={{ opacity: s2, transform: `scale(${0.97 + 0.03 * s2})` }}
                  >
                    <MockPage build={1} variant="design" />
                  </div>

                  <div
                    className="absolute bottom-0 right-0 top-0 w-[64%] bg-[#161513] p-3 md:p-5"
                    style={{
                      opacity: s3 * (1 - segment(s4, 0, 0.4)),
                      transform: `translateX(${(1 - s3) * 30}%)`,
                    }}
                  >
                    <div className="mb-2 flex gap-3 text-[8px] text-[#8d867c] md:text-[10px]">
                      <span className="text-[#e9e3d8]">page.tsx</span>
                      <span>hero.tsx</span>
                    </div>
                    <pre className="whitespace-pre-wrap font-mono text-[8px] leading-relaxed text-[#e9e3d8] md:text-[11px]">
                      {typed}
                      <span className="caret text-coral">▍</span>
                    </pre>
                  </div>

                  <div
                    className="absolute right-3 top-3 flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-[10px] shadow-md md:text-xs"
                    style={{ opacity: toast, transform: `translateX(${(1 - toast) * 24}px)` }}
                  >
                    <span className="h-2 w-2 rounded-full bg-[#2f9e62]" />
                    <span className="font-semibold">Novo lead</span>
                    <span className="text-ink-soft">via WhatsApp</span>
                  </div>

                  <div
                    className="absolute bottom-3 right-3 flex items-center gap-2.5 rounded-lg bg-white px-3 py-2 shadow-md"
                    style={{ opacity: segment(s5, 0, 0.3) }}
                  >
                    <svg width="44" height="44" viewBox="0 0 44 44" aria-hidden>
                      <circle cx="22" cy="22" r="18" stroke="rgba(26,25,23,0.1)" strokeWidth="4" fill="none" />
                      <circle
                        cx="22"
                        cy="22"
                        r="18"
                        stroke="#2f9e62"
                        strokeWidth="4"
                        fill="none"
                        strokeLinecap="round"
                        strokeDasharray={ring}
                        strokeDashoffset={ring * (1 - score / 100)}
                        transform="rotate(-90 22 22)"
                      />
                      <text x="22" y="26" textAnchor="middle" fontSize="12" fontWeight="700" fill="#1a1917">
                        {score}
                      </text>
                    </svg>
                    <div className="leading-tight">
                      <p className="text-[10px] font-semibold md:text-xs">Performance</p>
                      <p className="text-[9px] text-ink-soft md:text-[11px]">Carrega em &lt; 1s</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
