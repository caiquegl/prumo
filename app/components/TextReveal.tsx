"use client";

import { segment, useScrollProgress } from "./useScrollProgress";

const TEXT =
  "Não fazemos sites para enfeitar. Construímos páginas, sistemas e integrações que atraem clientes, automatizam o operacional e deixam sua empresa pronta para crescer.";

const ACCENT = new Set(["atraem", "automatizam", "crescer."]);

export function TextReveal() {
  const [ref, p] = useScrollProgress<HTMLElement>();
  const words = TEXT.split(" ");

  return (
    <section ref={ref} className="relative h-[220vh]">
      <div className="sticky top-0 flex h-screen items-center">
        <div className="mx-auto max-w-5xl px-5 md:px-8">
          <p className="display text-[clamp(1.9rem,4.6vw,3.9rem)] leading-[1.12]">
            {words.map((word, i) => {
              const start = (i / words.length) * 0.85;
              const opacity = 0.12 + 0.88 * segment(p, start, start + 0.08);
              return (
                <span
                  key={i}
                  className={ACCENT.has(word) ? "text-coral" : undefined}
                  style={{ opacity }}
                >
                  {word}{" "}
                </span>
              );
            })}
          </p>
        </div>
      </div>
    </section>
  );
}
