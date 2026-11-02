"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Dashboard = {
  ok: boolean;
  igError: string | null;
  instagram: { username?: string; media_count?: number } | null;
  queue: {
    pending: number;
    publishing: number;
    published: number;
    failed: number;
    byType: Record<string, number>;
    pendingByType: Record<string, number>;
  };
  pendingPreview: Array<{
    id: number;
    media_type: string;
    sort_order: number;
    caption: string;
  }>;
  publications: Array<{
    slot?: string;
    title?: string;
    format?: string;
    permalink?: string | null;
    published_at?: string;
  }>;
  logs: Array<{ level?: string; scope?: string; message?: string; created_at?: string }>;
  playbook: {
    weeklyMix: { reels: number; carousels: number; images: number; promotionMax: number };
    sampleWeek: Array<{
      day: string;
      format: string;
      pillar: string;
      angle: string;
      goal: string;
      timeBrt: string;
    }>;
    growthRules: string[];
    competitors: Array<{ handle: string; followers: number; takeaway: string }>;
  };
  crons: { token: string; feed: string[]; stories: string[] };
};

export default function IgMonitorPage() {
  const router = useRouter();
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setError("");
    const res = await fetch("/api/ig/dashboard");
    if (res.status === 401) {
      router.replace("/login?next=/ig");
      return;
    }
    const json = (await res.json()) as Dashboard & { error?: string };
    if (!res.ok) {
      setError(json.error || "Falha ao carregar");
      setLoading(false);
      return;
    }
    setData(json);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-5 py-10 md:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold tracking-[0.2em] text-[color:var(--ink-soft)]">INSTAGRAM</p>
          <h1 className="display mt-2 text-4xl md:text-5xl">Monitor</h1>
          <p className="mt-2 max-w-xl text-[color:var(--ink-soft)]">
            Fila, crons, playbook editorial e o que saiu no ar — @web.prumo
          </p>
        </div>
        <div className="flex gap-2">
          <a
            href="/posts"
            className="rounded-full border border-[color:var(--line)] px-4 py-2 text-sm font-semibold text-[color:var(--ink-soft)] hover:text-[color:var(--ink)]"
          >
            Fila
          </a>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-full bg-[color:var(--ink)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[color:var(--coral)]"
          >
            Atualizar
          </button>
        </div>
      </div>

      {loading ? <p className="mt-10 text-[color:var(--ink-soft)]">Carregando…</p> : null}
      {error ? <p className="mt-6 text-sm text-[color:var(--coral-deep)]">{error}</p> : null}

      {data ? (
        <div className="mt-10 grid gap-8">
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Pendentes" value={String(data.queue.pending)} />
            <Stat label="Publicados" value={String(data.queue.published)} />
            <Stat label="Falhas" value={String(data.queue.failed)} warn={data.queue.failed > 0} />
            <Stat
              label="Conta"
              value={data.instagram?.username ? `@${data.instagram.username}` : "—"}
              sub={data.igError || (data.instagram?.media_count != null ? `${data.instagram.media_count} mídias` : undefined)}
            />
          </section>

          <section className="rounded-2xl border border-[color:var(--line)] bg-white/70 p-5 md:p-6">
            <h2 className="text-lg font-semibold">Crons (BRT)</h2>
            <p className="mt-2 text-sm text-[color:var(--ink-soft)]">
              Token {data.crons.token} · Feed {data.crons.feed.join(" / ")} · Stories{" "}
              {data.crons.stories.join(" / ")}
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-sm">
              {Object.entries(data.queue.pendingByType).map(([type, n]) => (
                <span
                  key={type}
                  className="rounded-full border border-[color:var(--line)] px-3 py-1 font-medium"
                >
                  {type}: {n} na fila
                </span>
              ))}
              {!Object.keys(data.queue.pendingByType).length ? (
                <span className="text-[color:var(--ink-soft)]">Nada pendente</span>
              ) : null}
            </div>
          </section>

          <section className="rounded-2xl border border-[color:var(--line)] bg-white/70 p-5 md:p-6">
            <h2 className="text-lg font-semibold">Próximos na fila</h2>
            <ul className="mt-4 divide-y divide-[color:var(--line)]">
              {data.pendingPreview.map((p) => (
                <li key={p.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-baseline sm:justify-between">
                  <span className="text-sm font-semibold">
                    #{p.sort_order} · {p.media_type} · id {p.id}
                  </span>
                  <span className="max-w-xl text-sm text-[color:var(--ink-soft)]">
                    {p.caption || "(sem legenda)"}
                  </span>
                </li>
              ))}
              {!data.pendingPreview.length ? (
                <li className="py-3 text-sm text-[color:var(--ink-soft)]">Fila vazia — envie em /posts</li>
              ) : null}
            </ul>
          </section>

          <section className="rounded-2xl border border-[color:var(--line)] bg-white/70 p-5 md:p-6">
            <h2 className="text-lg font-semibold">Semana modelo (PME Brasil)</h2>
            <p className="mt-1 text-sm text-[color:var(--ink-soft)]">
              Alvo: {data.playbook.weeklyMix.reels} reels · {data.playbook.weeklyMix.carousels}{" "}
              carrosséis · {data.playbook.weeklyMix.images} foto · máx{" "}
              {data.playbook.weeklyMix.promotionMax} promo
            </p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-[color:var(--line)] text-[color:var(--ink-soft)]">
                    <th className="py-2 pr-3 font-medium">Dia</th>
                    <th className="py-2 pr-3 font-medium">Formato</th>
                    <th className="py-2 pr-3 font-medium">Ângulo</th>
                    <th className="py-2 pr-3 font-medium">Meta</th>
                    <th className="py-2 font-medium">Hora</th>
                  </tr>
                </thead>
                <tbody>
                  {data.playbook.sampleWeek.map((row) => (
                    <tr key={row.day} className="border-b border-[color:var(--line)]/70 align-top">
                      <td className="py-2.5 pr-3 font-semibold">{row.day}</td>
                      <td className="py-2.5 pr-3">{row.format}</td>
                      <td className="py-2.5 pr-3 text-[color:var(--ink-soft)]">{row.angle}</td>
                      <td className="py-2.5 pr-3">{row.goal}</td>
                      <td className="py-2.5">{row.timeBrt}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-[color:var(--line)] bg-white/70 p-5 md:p-6">
              <h2 className="text-lg font-semibold">Regras de crescimento</h2>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-[color:var(--ink-soft)]">
                {data.playbook.growthRules.map((rule) => (
                  <li key={rule}>{rule}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-[color:var(--line)] bg-white/70 p-5 md:p-6">
              <h2 className="text-lg font-semibold">Concorrentes (leitura)</h2>
              <ul className="mt-3 space-y-3 text-sm">
                {data.playbook.competitors.map((c) => (
                  <li key={c.handle}>
                    <p className="font-semibold">
                      @{c.handle} · {c.followers} seguidores
                    </p>
                    <p className="text-[color:var(--ink-soft)]">{c.takeaway}</p>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section className="rounded-2xl border border-[color:var(--line)] bg-white/70 p-5 md:p-6">
            <h2 className="text-lg font-semibold">Últimas publicações</h2>
            <ul className="mt-4 space-y-2 text-sm">
              {data.publications.map((p, i) => (
                <li key={`${p.slot}-${i}`} className="flex flex-wrap items-baseline justify-between gap-2">
                  <span>
                    {p.format || "post"} · {p.title || p.slot}
                  </span>
                  {p.permalink ? (
                    <a
                      href={p.permalink}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-[color:var(--coral)] hover:underline"
                    >
                      Abrir
                    </a>
                  ) : null}
                </li>
              ))}
              {!data.publications.length ? (
                <li className="text-[color:var(--ink-soft)]">Nenhuma publicação registrada ainda</li>
              ) : null}
            </ul>
          </section>

          <section className="rounded-2xl border border-[color:var(--line)] bg-white/70 p-5 md:p-6">
            <h2 className="text-lg font-semibold">Logs recentes</h2>
            <ul className="mt-4 max-h-64 space-y-2 overflow-y-auto text-xs text-[color:var(--ink-soft)]">
              {data.logs.map((log, i) => (
                <li key={`${log.created_at}-${i}`}>
                  <span className="font-semibold text-[color:var(--ink)]">
                    [{log.level}] {log.scope}
                  </span>{" "}
                  {log.message}
                </li>
              ))}
            </ul>
          </section>
        </div>
      ) : null}
    </main>
  );
}

function Stat({
  label,
  value,
  sub,
  warn,
}: {
  label: string;
  value: string;
  sub?: string;
  warn?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-[color:var(--line)] bg-white/70 px-4 py-4">
      <p className="text-xs font-semibold tracking-wide text-[color:var(--ink-soft)]">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${warn ? "text-[color:var(--coral-deep)]" : ""}`}>
        {value}
      </p>
      {sub ? <p className="mt-1 text-xs text-[color:var(--ink-soft)]">{sub}</p> : null}
    </div>
  );
}
