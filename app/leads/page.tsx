"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DEFAULT_AREAS, NICHE_BY_ID, NICHES } from "@/lib/leads/niches";
import {
  LEAD_STATUSES,
  LEAD_STATUS_LABEL,
  type Lead,
  type LeadEvent,
  type LeadStatus,
} from "@/lib/leads/types";

const DEFAULT_SCRIPT =
  "Oi, tudo bem? Sou o Caique, da Web Prumo. Vi a {empresa} no Google, com {nota}★, e notei que vocês ainda não têm site. " +
  "Montei uma página de exemplo pra vocês, sem compromisso: {link}\n\n" +
  "Se gostar, deixo no ar com o domínio de vocês. Posso te mandar os valores? " +
  "(Se não tiver interesse, é só avisar que não te chamo mais.)";

const SCRIPT_KEY = "leads.script";

const STATUS_COLOR: Record<LeadStatus, string> = {
  sem_site: "bg-stone-200 text-stone-800",
  criando: "bg-amber-100 text-amber-900",
  publicado: "bg-sky-100 text-sky-900",
  abordado: "bg-indigo-100 text-indigo-900",
  respondeu: "bg-violet-100 text-violet-900",
  aceitou: "bg-emerald-100 text-emerald-900",
  recusou: "bg-rose-100 text-rose-900",
  sem_resposta: "bg-stone-100 text-stone-600",
  descartado: "bg-stone-100 text-stone-500",
};

/** Etapas do funil: quem já passou por cada uma. */
const FUNNEL: Array<{ label: string; statuses: LeadStatus[] }> = [
  { label: "Coletados", statuses: [...LEAD_STATUSES] },
  {
    label: "Demo no ar",
    statuses: ["publicado", "abordado", "respondeu", "aceitou", "recusou", "sem_resposta"],
  },
  { label: "Abordados", statuses: ["abordado", "respondeu", "aceitou", "recusou", "sem_resposta"] },
  { label: "Responderam", statuses: ["respondeu", "aceitou", "recusou"] },
  { label: "Fecharam", statuses: ["aceitou"] },
];

function fillScript(tpl: string, lead: Lead) {
  return tpl
    .replaceAll("{empresa}", lead.name)
    .replaceAll("{nota}", lead.rating != null ? lead.rating.toFixed(1).replace(".", ",") : "boa avaliação")
    .replaceAll("{link}", lead.demo_url || "(link da demo)")
    .replaceAll("{bairro}", lead.neighborhood || lead.city || "");
}

function daysSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

const pill =
  "rounded-full border border-[color:var(--line)] px-4 py-2 text-sm font-semibold text-[color:var(--ink-soft)] hover:text-[color:var(--ink)]";
const input =
  "rounded-xl border border-[color:var(--line)] bg-white/70 px-3 py-2 text-sm outline-none focus:border-[color:var(--ink)]";

export default function LeadsPage() {
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState<LeadStatus | "all">("all");
  const [q, setQ] = useState("");
  const [niche, setNiche] = useState(NICHES[0]!.queries[0]!);
  const [city, setCity] = useState(DEFAULT_AREAS[0]!);
  const [nicheFilter, setNicheFilter] = useState<string>("all");
  const [nicheCounts, setNicheCounts] = useState<Record<string, number>>({});
  const [max, setMax] = useState(20);
  const [collecting, setCollecting] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);
  const [events, setEvents] = useState<LeadEvent[]>([]);
  const [script, setScript] = useState(DEFAULT_SCRIPT);
  const [showScript, setShowScript] = useState(false);

  function toggleScript() {
    if (!showScript) {
      try {
        const saved = localStorage.getItem(SCRIPT_KEY);
        if (saved) setScript(saved);
      } catch {
        /* storage indisponível */
      }
    }
    setShowScript((v) => !v);
  }

  /** Lê a mensagem salva na hora do uso (sem efeito no mount). */
  function currentScript() {
    try {
      return localStorage.getItem(SCRIPT_KEY) || script;
    } catch {
      return script;
    }
  }

  const load = useCallback(async () => {
    const res = await fetch("/api/leads");
    setError("");
    if (res.status === 401) {
      router.replace("/login?next=/leads");
      return;
    }
    const json = (await res.json()) as {
      leads?: Lead[];
      counts?: Record<string, number>;
      niches?: Record<string, number>;
      error?: string;
    };
    if (!res.ok) {
      setError(json.error || "Falha ao listar");
      return;
    }
    setLeads(json.leads || []);
    setCounts(json.counts || {});
    setNicheCounts(json.niches || {});
    setLoading(false);
  }, [router]);

  useEffect(() => {
    let alive = true;
    Promise.resolve().then(() => {
      if (alive) void load();
    });
    return () => {
      alive = false;
    };
  }, [load]);

  const funnel = useMemo(() => {
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    return FUNNEL.map((step, i) => {
      const n = step.statuses.reduce((a, s) => a + (counts[s] || 0), 0);
      const prev = i === 0 ? total : FUNNEL[i - 1]!.statuses.reduce((a, s) => a + (counts[s] || 0), 0);
      return { ...step, n, rate: i === 0 || !prev ? null : Math.round((n / prev) * 100) };
    });
  }, [counts]);

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    return leads.filter((l) => {
      if (filter !== "all" && l.status !== filter) return false;
      if (nicheFilter === "outros" && l.niche) return false;
      if (nicheFilter !== "all" && nicheFilter !== "outros" && l.niche !== nicheFilter) return false;
      if (!term) return true;
      return [l.name, l.neighborhood, l.category, l.city].some((v) => v?.toLowerCase().includes(term));
    });
  }, [leads, filter, q, nicheFilter]);

  async function onCollect(e: FormEvent) {
    e.preventDefault();
    setCollecting(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/leads/collect", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: niche, city, max }),
      });
      const json = (await res.json()) as {
        error?: string;
        found?: number;
        inserted?: number;
        updated?: number;
        skippedWithSite?: number;
      };
      if (!res.ok) {
        setError(json.error || "Coleta falhou");
        return;
      }
      setNotice(
        `${json.found} encontrados · ${json.inserted} novos sem site · ${json.updated} já existiam · ${json.skippedWithSite} já têm site`,
      );
      await load();
    } finally {
      setCollecting(false);
    }
  }

  async function patch(id: number, body: Record<string, unknown>) {
    setError("");
    const res = await fetch(`/api/leads/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as { lead?: Lead; error?: string };
    if (!res.ok || !json.lead) {
      setError(json.error || "Falha ao salvar");
      return;
    }
    setLeads((list) => list.map((l) => (l.id === id ? json.lead! : l)));
    void load();
    if (openId === id) void loadEvents(id);
  }

  async function remove(id: number) {
    if (!confirm("Apagar este lead? (não remove a demo da Vercel)")) return;
    await fetch(`/api/leads/${id}`, { method: "DELETE" });
    setOpenId(null);
    void load();
  }

  async function loadEvents(id: number) {
    const res = await fetch(`/api/leads/${id}`);
    const json = (await res.json()) as { events?: LeadEvent[] };
    setEvents(json.events || []);
  }

  function toggle(id: number) {
    if (openId === id) {
      setOpenId(null);
      return;
    }
    setOpenId(id);
    setEvents([]);
    void loadEvents(id);
  }

  function openWhatsApp(lead: Lead) {
    if (!lead.whatsapp) return;
    const url = `https://wa.me/${lead.whatsapp}?text=${encodeURIComponent(fillScript(currentScript(), lead))}`;
    window.open(url, "_blank", "noopener");
    if (lead.status === "publicado" && confirm("Marcar como abordado?")) {
      void patch(lead.id, { status: "abordado", event_note: "mensagem WhatsApp" });
    }
  }

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      setNotice(`${label} copiado`);
    } catch {
      setError("Não consegui copiar");
    }
  }

  function saveScript(value: string) {
    setScript(value);
    try {
      localStorage.setItem(SCRIPT_KEY, value);
    } catch {
      /* ignore */
    }
  }

  async function onLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-5 py-10 md:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold tracking-[0.2em] text-[color:var(--ink-soft)]">PROSPECÇÃO</p>
          <h1 className="display mt-2 text-4xl md:text-5xl">Leads sem site</h1>
          <p className="mt-2 max-w-xl text-[color:var(--ink-soft)]">
            Coleta no Google → demo com <code>/landing-demo &lt;id&gt;</code> → abordagem manual no WhatsApp.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a href="/leads/disparos" className={pill}>
            Disparos
          </a>
          <a href="/posts" className={pill}>
            Fila IG
          </a>
          <button type="button" onClick={toggleScript} className={pill}>
            Mensagem
          </button>
          <button type="button" onClick={() => void onLogout()} className={pill}>
            Sair
          </button>
        </div>
      </div>

      {/* Funil */}
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {funnel.map((f) => (
          <div key={f.label} className="rounded-2xl border border-[color:var(--line)] bg-white/50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-[color:var(--ink-soft)]">{f.label}</p>
            <p className="display mt-1 text-3xl">{f.n}</p>
            {f.rate != null ? <p className="text-xs text-[color:var(--ink-soft)]">{f.rate}% da etapa anterior</p> : null}
          </div>
        ))}
      </div>

      {showScript ? (
        <div className="mt-6 rounded-2xl border border-[color:var(--line)] bg-white/50 p-4">
          <p className="text-sm font-semibold">
            Mensagem de abordagem: variáveis <code>{"{empresa}"}</code> <code>{"{nota}"}</code> <code>{"{link}"}</code>{" "}
            <code>{"{bairro}"}</code>
          </p>
          <textarea
            value={script}
            onChange={(e) => saveScript(e.target.value)}
            rows={5}
            className={`${input} mt-2 w-full`}
          />
          <button type="button" onClick={() => saveScript(DEFAULT_SCRIPT)} className="mt-2 text-xs font-semibold underline">
            Restaurar padrão
          </button>
        </div>
      ) : null}

      {/* Coleta */}
      <form
        onSubmit={(e) => void onCollect(e)}
        className="mt-6 flex flex-wrap items-end gap-3 rounded-2xl border border-[color:var(--line)] bg-white/50 p-4"
      >
        <label className="flex flex-col gap-1 text-xs font-semibold">
          Nicho prioritário
          <select
            className={input}
            value={NICHES.find((n) => n.queries.includes(niche))?.id ?? ""}
            onChange={(e) => {
              const n = NICHE_BY_ID[e.target.value];
              if (n) setNiche(n.queries[0]!);
            }}
          >
            {NICHES.map((n) => (
              <option key={n.id} value={n.id}>
                {n.rank}. {n.label}
              </option>
            ))}
            <option value="">Outro (digite ao lado)</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold">
          Termo de busca
          <input
            value={niche}
            onChange={(e) => setNiche(e.target.value)}
            list="niche-queries"
            className={`${input} min-w-48`}
            required
          />
          <datalist id="niche-queries">
            {NICHES.flatMap((n) => n.queries).map((qq) => (
              <option key={qq} value={qq} />
            ))}
          </datalist>
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold">
          Bairro / cidade
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            list="areas"
            className={`${input} min-w-56`}
            required
          />
          <datalist id="areas">
            {DEFAULT_AREAS.map((a) => (
              <option key={a} value={a} />
            ))}
          </datalist>
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold">
          Máx.
          <input
            type="number"
            min={1}
            max={60}
            value={max}
            onChange={(e) => setMax(Number(e.target.value))}
            className={`${input} w-20`}
          />
        </label>
        <button
          type="submit"
          disabled={collecting}
          className="rounded-full bg-[color:var(--ink)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[color:var(--coral)] disabled:opacity-60"
        >
          {collecting ? "Buscando no Google Maps (até 2 min)…" : "Coletar"}
        </button>
      </form>

      {error ? <p className="mt-4 rounded-xl bg-rose-100 px-4 py-2 text-sm text-rose-900">{error}</p> : null}
      {notice ? <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-2 text-sm text-emerald-900">{notice}</p> : null}

      {/* Nichos */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        {[
          { id: "all", label: "Todos os nichos" },
          ...NICHES.map((n) => ({ id: n.id, label: `${n.rank}. ${n.label}` })),
          { id: "outros", label: "Fora da prioridade" },
        ].map((n) => {
          const total = n.id === "all" ? Object.values(nicheCounts).reduce((a, b) => a + b, 0) : nicheCounts[n.id] || 0;
          return (
            <button
              key={n.id}
              type="button"
              onClick={() => setNicheFilter(n.id)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold ${
                nicheFilter === n.id
                  ? "bg-[color:var(--ink)] text-white"
                  : `border border-[color:var(--line)] text-[color:var(--ink-soft)] ${total ? "" : "opacity-50"}`
              }`}
            >
              {n.label} ({total})
            </button>
          );
        })}
      </div>

      {/* Filtros */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {(["all", ...LEAD_STATUSES] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilter(s)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold ${
              filter === s
                ? "bg-[color:var(--coral)] text-white"
                : "border border-[color:var(--line)] text-[color:var(--ink-soft)]"
            }`}
          >
            {s === "all" ? "Todos" : LEAD_STATUS_LABEL[s]} (
            {s === "all" ? Object.values(counts).reduce((a, b) => a + b, 0) : counts[s] || 0})
          </button>
        ))}
        <input
          placeholder="Buscar nome, bairro, nicho"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className={`${input} ml-auto w-full sm:w-64`}
        />
      </div>

      {/* Lista */}
      <div className="mt-4 flex flex-col gap-3">
        {loading ? <p className="text-[color:var(--ink-soft)]">Carregando…</p> : null}
        {!loading && !visible.length ? (
          <p className="text-[color:var(--ink-soft)]">Nenhum lead aqui. Faça uma coleta acima.</p>
        ) : null}
        {visible.map((lead) => {
          const open = openId === lead.id;
          const staleDemo = lead.status === "recusou" && lead.demo_url && daysSince(lead.updated_at) >= 7;
          return (
            <div key={lead.id} className="rounded-2xl border border-[color:var(--line)] bg-white/60 p-4">
              <div className="flex flex-wrap items-start gap-3">
                {lead.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element -- logo externo, miniatura
                  <img
                    src={lead.logo_url}
                    alt={`Logo ${lead.name}`}
                    className="h-12 w-12 shrink-0 rounded-xl border border-[color:var(--line)] bg-white object-contain p-1"
                  />
                ) : null}
                <button type="button" onClick={() => toggle(lead.id)} className="min-w-0 flex-1 text-left">
                  {lead.brand_colors?.length ? (
                    <span className="mb-1 flex gap-1" aria-label="Cores da marca">
                      {lead.brand_colors.map((c) => (
                        <span key={c} title={c} className="h-3 w-6 rounded-sm border border-black/10" style={{ background: c }} />
                      ))}
                    </span>
                  ) : null}
                  <p className="text-xs text-[color:var(--ink-soft)]">
                    {lead.niche && NICHE_BY_ID[lead.niche] ? (
                      <span className="mr-1 rounded-full bg-[color:var(--ink)] px-2 py-0.5 font-semibold text-white">
                        {NICHE_BY_ID[lead.niche]!.rank}. {NICHE_BY_ID[lead.niche]!.label}
                      </span>
                    ) : null}
                    #{lead.id} · {lead.category} · {lead.neighborhood || lead.city}
                    {lead.website_raw && !lead.instagram ? " · só link de agendamento/rede" : ""}
                  </p>
                  <p className="text-lg font-bold">{lead.name}</p>
                  <p className="text-sm text-[color:var(--ink-soft)]">
                    {lead.rating != null ? `★ ${lead.rating.toFixed(1)} (${lead.reviews_count ?? 0})` : "sem nota"} ·
                    score {lead.score}
                    {lead.whatsapp ? " · WhatsApp" : lead.phone ? ` · ${lead.phone}` : " · sem telefone"}
                    {lead.instagram ? " · Instagram" : ""}
                  </p>
                </button>
                <div className="flex flex-wrap items-center gap-2">
                  {lead.demo_url ? (
                    <a
                      href={lead.demo_url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white"
                    >
                      Ver demo ↗
                    </a>
                  ) : null}
                  {lead.whatsapp ? (
                    <button
                      type="button"
                      onClick={() => openWhatsApp(lead)}
                      disabled={!lead.demo_url}
                      title={lead.demo_url ? "Abrir WhatsApp com a mensagem" : "Publique a demo antes"}
                      className="rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
                    >
                      WhatsApp
                    </button>
                  ) : null}
                  <select
                    value={lead.status}
                    onChange={(e) => void patch(lead.id, { status: e.target.value })}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold ${STATUS_COLOR[lead.status]}`}
                  >
                    {LEAD_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {LEAD_STATUS_LABEL[s]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {staleDemo ? (
                <p className="mt-2 rounded-lg bg-rose-50 px-3 py-1.5 text-xs text-rose-900">
                  Recusou há {daysSince(lead.updated_at)} dias e a demo ainda está no ar. Rode{" "}
                  <code>/remove-demo {lead.id}</code>.
                </p>
              ) : null}

              {open ? (
                <LeadDetail
                  lead={lead}
                  events={events}
                  onSave={(body) => void patch(lead.id, body)}
                  onDelete={() => void remove(lead.id)}
                  onCopy={(t, l) => void copy(t, l)}
                  script={fillScript(currentScript(), lead)}
                />
              ) : null}
            </div>
          );
        })}
      </div>
    </main>
  );
}

function LeadDetail({
  lead,
  events,
  onSave,
  onDelete,
  onCopy,
  script,
}: {
  lead: Lead;
  events: LeadEvent[];
  onSave: (body: Record<string, unknown>) => void;
  onDelete: () => void;
  onCopy: (text: string, label: string) => void;
  script: string;
}) {
  const [notes, setNotes] = useState(lead.notes || "");
  const [price, setPrice] = useState(lead.price_quoted != null ? String(lead.price_quoted) : "");
  const [demoUrl, setDemoUrl] = useState(lead.demo_url || "");
  const [instagram, setInstagram] = useState(lead.instagram || "");

  return (
    <div className="mt-4 grid gap-4 border-t border-[color:var(--line)] pt-4 md:grid-cols-2">
      <div className="flex flex-col gap-2 text-sm">
        <p>{lead.address}</p>
        {lead.phone ? (
          <p>
            Telefone: <a href={`tel:${lead.phone}`} className="underline">{lead.phone}</a>
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {lead.maps_url ? (
            <a href={lead.maps_url} target="_blank" rel="noreferrer" className="underline">
              Google Maps ↗
            </a>
          ) : null}
          {lead.instagram ? (
            <a href={lead.instagram} target="_blank" rel="noreferrer" className="underline">
              Instagram ↗
            </a>
          ) : null}
          {lead.website_raw && lead.website_raw !== lead.instagram ? (
            <a href={lead.website_raw} target="_blank" rel="noreferrer" className="underline">
              Link atual ↗
            </a>
          ) : null}
        </div>
        {lead.opening_hours?.length ? (
          <ul className="text-xs text-[color:var(--ink-soft)]">
            {lead.opening_hours.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
        ) : null}
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" onClick={() => onCopy(`/landing-demo ${lead.id}`, "Comando")} className={pill}>
            Copiar /landing-demo {lead.id}
          </button>
          <button type="button" onClick={() => onCopy(script, "Mensagem")} className={pill}>
            Copiar mensagem
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2 text-sm">
        <label className="flex flex-col gap-1 text-xs font-semibold">
          Link da demo
          <input value={demoUrl} onChange={(e) => setDemoUrl(e.target.value)} className={input} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold">
          Instagram
          <input value={instagram} onChange={(e) => setInstagram(e.target.value)} className={input} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold">
          Valor proposto (R$)
          <input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" className={input} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold">
          Notas
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className={input} />
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onSave({ notes, price_quoted: price, demo_url: demoUrl, instagram })}
            className="rounded-full bg-[color:var(--ink)] px-4 py-2 text-sm font-semibold text-white hover:bg-[color:var(--coral)]"
          >
            Salvar
          </button>
          <button type="button" onClick={onDelete} className="text-xs font-semibold text-rose-700 underline">
            Apagar lead
          </button>
        </div>
      </div>

      <div className="md:col-span-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-[color:var(--ink-soft)]">Histórico</p>
        <ul className="mt-1 text-xs text-[color:var(--ink-soft)]">
          {events.map((ev) => (
            <li key={ev.id}>
              {new Date(ev.created_at).toLocaleString("pt-BR")} ·{" "}
              {ev.from_status ? `${LEAD_STATUS_LABEL[ev.from_status as LeadStatus] ?? ev.from_status} → ` : ""}
              {LEAD_STATUS_LABEL[ev.to_status as LeadStatus] ?? ev.to_status}
              {ev.note ? ` · ${ev.note}` : ""}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
