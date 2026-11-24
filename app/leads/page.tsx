"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { NICHE_BY_ID, NICHES } from "@/lib/leads/niches";
import { LEAD_STATUSES, LEAD_STATUS_LABEL, type Lead, type LeadEvent, type LeadInterest, type LeadStatus } from "@/lib/leads/types";
import { shortName } from "@/lib/outreach/messages";
import type { LeadMessage } from "@/lib/outreach/store";
import {
  ApproachModal,
  CollectModal,
  DetailsModal,
  OutcomeModal,
  RepliesModal,
  TemplateModal,
  type History,
  type Patch,
} from "./_components/modals";
import { ago, btnDark, btnGhost, daysSince, input, InterestBadge, isToday, StatusBadge } from "./_components/ui";

/** Atalhos do mini dashboard: cada cartão é um filtro pronto. */
type View = "todos" | "abordar" | "aguardando" | "interesse" | "sem_interesse" | "fechados" | "hoje";

const BEFORE_CONTACT: LeadStatus[] = ["sem_site", "criando", "publicado"];
const WAIT_DAYS = 3;

const VIEWS: Array<{ id: View; label: string; hint: string; test: (l: Lead) => boolean; tone: string }> = [
  { id: "todos", label: "Todos", hint: "leads na base", test: () => true, tone: "" },
  {
    id: "abordar",
    label: "Para abordar",
    hint: "ainda sem contato, com WhatsApp",
    test: (l) => BEFORE_CONTACT.includes(l.status) && !!l.whatsapp,
    tone: "text-indigo-700",
  },
  {
    id: "aguardando",
    label: `Sem resposta há ${WAIT_DAYS}+ dias`,
    hint: "hora de um lembrete",
    test: (l) => l.status === "abordado" && (daysSince(l.last_contact_at) ?? 0) >= WAIT_DAYS,
    tone: "text-amber-700",
  },
  {
    id: "interesse",
    label: "Com interesse",
    hint: "tem interesse ou talvez",
    test: (l) => l.interest === "sim" || l.interest === "talvez" || (l.status === "respondeu" && l.interest !== "nao"),
    tone: "text-emerald-700",
  },
  {
    id: "sem_interesse",
    label: "Sem interesse",
    hint: "recusaram",
    test: (l) => l.interest === "nao" || l.status === "recusou",
    tone: "text-rose-700",
  },
  { id: "fechados", label: "Fechados", hint: "aceitaram", test: (l) => l.status === "aceitou", tone: "text-emerald-800" },
  { id: "hoje", label: "Contatos hoje", hint: "falei hoje", test: (l) => isToday(l.last_contact_at), tone: "text-sky-700" },
];

type Sort = "prioridade" | "ultimo_contato" | "nota" | "recentes";
type ModalState =
  | { kind: "abordar" | "resultado" | "detalhes" | "respostas"; id: number }
  | { kind: "respostas-geral" }
  | { kind: "mensagem" }
  | { kind: "coletar" }
  | null;

const PAGE = 50;

export default function LeadsPage() {
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [queued, setQueued] = useState<Set<number>>(new Set());
  const [template, setTemplate] = useState("");
  const [defaultTemplate, setDefaultTemplate] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [view, setView] = useState<View>("abordar");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<LeadStatus | "all">("all");
  const [niche, setNiche] = useState("all");
  const [interest, setInterest] = useState<LeadInterest | "none" | "all">("all");
  const [sort, setSort] = useState<Sort>("prioridade");
  const [limit, setLimit] = useState(PAGE);

  const [modal, setModal] = useState<ModalState>(null);
  const [history, setHistory] = useState<History>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/leads");
    if (res.status === 401) {
      router.replace("/login?next=/leads");
      return;
    }
    const json = (await res.json()) as {
      leads?: Lead[];
      queued?: number[];
      template?: string;
      defaultTemplate?: string;
      error?: string;
    };
    if (!res.ok) {
      setError(json.error || "Falha ao listar");
      setLoading(false);
      return;
    }
    setError("");
    setLeads(json.leads || []);
    setQueued(new Set(json.queued || []));
    setTemplate(json.template || "");
    setDefaultTemplate(json.defaultTemplate || "");
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

  const viewCounts = useMemo(
    () => Object.fromEntries(VIEWS.map((v) => [v.id, leads.filter(v.test).length])) as Record<View, number>,
    [leads],
  );

  const contactedTotal = useMemo(() => leads.filter((l) => !BEFORE_CONTACT.includes(l.status)).length, [leads]);
  const repliedTotal = useMemo(
    () => leads.filter((l) => ["respondeu", "aceitou", "recusou"].includes(l.status) || l.interest).length,
    [leads],
  );

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    const test = VIEWS.find((v) => v.id === view)!.test;
    const list = leads.filter((l) => {
      if (!test(l)) return false;
      if (status !== "all" && l.status !== status) return false;
      if (niche === "outros" && l.niche) return false;
      if (niche !== "all" && niche !== "outros" && l.niche !== niche) return false;
      if (interest === "none" && l.interest) return false;
      if (interest !== "all" && interest !== "none" && l.interest !== interest) return false;
      if (!term) return true;
      return [l.name, l.neighborhood, l.category, l.city, String(l.id)].some((v) => v?.toLowerCase().includes(term));
    });
    const time = (iso: string | null) => (iso ? new Date(iso).getTime() : 0);
    if (sort === "ultimo_contato") list.sort((a, b) => time(b.last_contact_at) - time(a.last_contact_at));
    else if (sort === "nota") list.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || (b.reviews_count ?? 0) - (a.reviews_count ?? 0));
    else if (sort === "recentes") list.sort((a, b) => time(b.created_at) - time(a.created_at));
    return list;
  }, [leads, view, q, status, niche, interest, sort]);

  const filtersActive = q || status !== "all" || niche !== "all" || interest !== "all";

  function clearFilters() {
    setQ("");
    setStatus("all");
    setNiche("all");
    setInterest("all");
    setLimit(PAGE);
  }

  async function openLead(kind: "abordar" | "resultado" | "detalhes" | "respostas", id: number) {
    setModal({ kind, id });
    setHistory(null);
    await loadHistory(id);
  }

  async function loadHistory(id: number) {
    const res = await fetch(`/api/leads/${id}`);
    const json = (await res.json()) as { events?: LeadEvent[]; messages?: LeadMessage[] };
    setHistory({ events: json.events || [], messages: json.messages || [] });
  }

  async function patch(id: number, body: Patch): Promise<boolean> {
    setError("");
    const res = await fetch(`/api/leads/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as { lead?: Lead; error?: string };
    if (!res.ok || !json.lead) {
      setError(json.error || "Falha ao salvar");
      return false;
    }
    setLeads((list) => list.map((l) => (l.id === id ? json.lead! : l)));
    setNotice(`${shortName(json.lead.name)}: salvo`);
    void loadHistory(id);
    return true;
  }

  async function remove(id: number) {
    if (!confirm("Apagar este lead? (não remove a demo da Vercel)")) return;
    await fetch(`/api/leads/${id}`, { method: "DELETE" });
    setModal(null);
    void load();
  }

  async function saveTemplate(tpl: string): Promise<boolean> {
    const res = await fetch("/api/leads/outreach", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "saveTemplates", templates: { tpl_manual: tpl } }),
    });
    if (!res.ok) {
      setError("Não consegui salvar a mensagem padrão");
      return false;
    }
    setTemplate(tpl.trim());
    setNotice("Mensagem padrão salva");
    return true;
  }

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      setNotice(`${label} copiado`);
    } catch {
      setError("Não consegui copiar");
    }
  }

  async function onLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  const current = modal && "id" in modal ? leads.find((l) => l.id === modal.id) ?? null : null;
  const sample = current ?? visible[0] ?? leads[0] ?? null;

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-8 md:px-8">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold tracking-[0.2em] text-[color:var(--ink-soft)]">PROSPECÇÃO</p>
          <h1 className="display mt-1 text-4xl md:text-5xl">Leads</h1>
          <p className="mt-1 text-sm text-[color:var(--ink-soft)]">
            Clique em <b>Abordar</b> → mande pelo celular → marque como enviado. Depois use <b>Atualizar</b> para registrar
            a resposta.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setModal({ kind: "mensagem" })} className={btnDark}>
            Mensagem padrão
          </button>
          <button type="button" onClick={() => setModal({ kind: "respostas-geral" })} className={btnGhost}>
            Respostas prontas
          </button>
          <button type="button" onClick={() => setModal({ kind: "coletar" })} className={btnGhost}>
            Coletar leads
          </button>
          <a href="/leads/disparos" className={btnGhost}>
            Disparos
          </a>
          <a href="/posts" className={btnGhost}>
            Fila IG
          </a>
          <button type="button" onClick={() => void onLogout()} className={btnGhost}>
            Sair
          </button>
        </div>
      </div>

      {/* Mini dashboard */}
      <div className="mt-6 grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-2.5 lg:grid-cols-7">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => {
              setView(v.id);
              setLimit(PAGE);
            }}
            aria-pressed={view === v.id}
            className={`rounded-2xl border p-2.5 text-left transition sm:p-3 ${
              view === v.id
                ? "border-[color:var(--ink)] bg-white shadow-sm"
                : "border-[color:var(--line)] bg-white/50 hover:border-[color:var(--ink)]/40"
            }`}
          >
            <p className="text-[10px] font-semibold uppercase leading-tight tracking-wider text-[color:var(--ink-soft)] sm:text-[11px]">{v.label}</p>
            <p className={`display mt-1 text-2xl sm:text-3xl ${v.tone}`}>{loading ? "–" : viewCounts[v.id]}</p>
            <p className="hidden text-[11px] leading-tight text-[color:var(--ink-soft)] sm:block">{v.hint}</p>
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-[color:var(--ink-soft)]">
        {contactedTotal} abordados no total · {repliedTotal} responderam
        {contactedTotal ? ` (${Math.round((repliedTotal / contactedTotal) * 100)}%)` : ""} · {viewCounts.fechados ?? 0} fechados
      </p>

      {/* Filtros */}
      <div className="mt-5 flex flex-wrap items-center gap-2 rounded-2xl border border-[color:var(--line)] bg-white/50 p-3">
        <input
          placeholder="Buscar nome, bairro, #id"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setLimit(PAGE);
          }}
          className={`${input} w-full sm:w-56`}
        />
        <select value={niche} onChange={(e) => setNiche(e.target.value)} className={input} aria-label="Nicho">
          <option value="all">Todos os nichos</option>
          {NICHES.map((n) => (
            <option key={n.id} value={n.id}>
              {n.label}
            </option>
          ))}
          <option value="outros">Fora da prioridade</option>
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value as LeadStatus | "all")} className={input} aria-label="Status">
          <option value="all">Todos os status</option>
          {LEAD_STATUSES.map((s) => (
            <option key={s} value={s}>
              {LEAD_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <select
          value={interest}
          onChange={(e) => setInterest(e.target.value as LeadInterest | "none" | "all")}
          className={input}
          aria-label="Interesse"
        >
          <option value="all">Qualquer interesse</option>
          <option value="sim">Tem interesse</option>
          <option value="talvez">Talvez</option>
          <option value="nao">Sem interesse</option>
          <option value="none">Não informado</option>
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className={input} aria-label="Ordenar">
          <option value="prioridade">Ordenar: prioridade</option>
          <option value="ultimo_contato">Ordenar: último contato</option>
          <option value="nota">Ordenar: nota no Google</option>
          <option value="recentes">Ordenar: coletados recentes</option>
        </select>
        {filtersActive ? (
          <button type="button" onClick={clearFilters} className="text-xs font-semibold underline">
            limpar filtros
          </button>
        ) : null}
        <span className="ml-auto text-xs text-[color:var(--ink-soft)]">{visible.length} na lista</span>
      </div>

      {error ? <p className="mt-3 rounded-xl bg-rose-100 px-4 py-2 text-sm text-rose-900">{error}</p> : null}
      {notice ? (
        <p className="mt-3 flex items-center justify-between rounded-xl bg-emerald-50 px-4 py-2 text-sm text-emerald-900">
          {notice}
          <button type="button" onClick={() => setNotice("")} aria-label="Fechar aviso" className="px-1">
            ×
          </button>
        </p>
      ) : null}

      {/* Lista no celular */}
      <div className="mt-3 grid grid-cols-1 gap-2 md:hidden">
        {loading ? <p className="py-6 text-center text-sm text-[color:var(--ink-soft)]">Carregando…</p> : null}
        {!loading && !visible.length ? (
          <p className="py-6 text-center text-sm text-[color:var(--ink-soft)]">Nenhum lead neste filtro.</p>
        ) : null}
        {visible.slice(0, limit).map((lead) => {
          const n = lead.niche ? NICHE_BY_ID[lead.niche] : null;
          const waiting = lead.status === "abordado" && (daysSince(lead.last_contact_at) ?? 0) >= WAIT_DAYS;
          return (
            <div key={lead.id} className="min-w-0 rounded-2xl border border-[color:var(--line)] bg-white/70 p-3">
              <button type="button" onClick={() => void openLead("detalhes", lead.id)} className="block w-full text-left">
                <span className="block truncate font-semibold">{shortName(lead.name)}</span>
                <span className="block truncate text-xs text-[color:var(--ink-soft)]">
                  #{lead.id} · {n ? n.label : lead.category || "outro"} · {lead.neighborhood || lead.city}
                  {lead.rating != null ? ` · ★ ${lead.rating.toFixed(1)}` : ""}
                </span>
              </button>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <StatusBadge status={lead.status} />
                <InterestBadge interest={lead.interest} />
                {queued.has(lead.id) ? <span className="rounded bg-amber-100 px-1.5 text-[10px] font-semibold text-amber-800">na fila</span> : null}
                <span className={`ml-auto text-xs ${waiting ? "font-semibold text-amber-700" : "text-[color:var(--ink-soft)]"}`}>
                  {ago(lead.last_contact_at)}
                </span>
              </div>
              <div className="mt-2.5 grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => void openLead("abordar", lead.id)}
                  className="rounded-full bg-emerald-600 py-2 text-xs font-semibold text-white"
                >
                  Abordar
                </button>
                <button
                  type="button"
                  onClick={() => void openLead("resultado", lead.id)}
                  className="rounded-full border border-[color:var(--line)] bg-white py-2 text-xs font-semibold"
                >
                  Atualizar
                </button>
                <button
                  type="button"
                  onClick={() => void openLead("respostas", lead.id)}
                  className="rounded-full border border-[color:var(--line)] bg-white py-2 text-xs font-semibold"
                >
                  Respostas
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tabela */}
      <div className="mt-3 hidden overflow-x-auto md:block rounded-2xl border border-[color:var(--line)] bg-white/70">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-[color:var(--line)] text-[11px] uppercase tracking-wider text-[color:var(--ink-soft)]">
            <tr>
              <th className="px-3 py-2.5 font-semibold">Empresa</th>
              <th className="px-3 py-2.5 font-semibold">Nota</th>
              <th className="px-3 py-2.5 font-semibold">Status</th>
              <th className="px-3 py-2.5 font-semibold">Interesse</th>
              <th className="px-3 py-2.5 font-semibold">Último contato</th>
              <th className="px-3 py-2.5 text-right font-semibold">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-[color:var(--ink-soft)]">
                  Carregando…
                </td>
              </tr>
            ) : null}
            {!loading && !visible.length ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-[color:var(--ink-soft)]">
                  Nenhum lead neste filtro.{" "}
                  {filtersActive || view !== "todos" ? (
                    <button
                      type="button"
                      className="font-semibold underline"
                      onClick={() => {
                        clearFilters();
                        setView("todos");
                      }}
                    >
                      Ver todos
                    </button>
                  ) : null}
                </td>
              </tr>
            ) : null}
            {visible.slice(0, limit).map((lead) => {
              const n = lead.niche ? NICHE_BY_ID[lead.niche] : null;
              const waiting = lead.status === "abordado" && (daysSince(lead.last_contact_at) ?? 0) >= WAIT_DAYS;
              return (
                <tr key={lead.id} className="border-b border-[color:var(--line)] last:border-0 hover:bg-white">
                  <td className="px-3 py-2.5">
                    <button type="button" onClick={() => void openLead("detalhes", lead.id)} className="flex items-center gap-2.5 text-left">
                      {lead.logo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element -- logo externo, miniatura
                        <img src={lead.logo_url} alt="" className="h-8 w-8 shrink-0 rounded-lg border border-[color:var(--line)] bg-white object-contain" />
                      ) : (
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[color:var(--bg-deep)] text-xs font-bold text-[color:var(--ink-soft)]">
                          {shortName(lead.name).slice(0, 1)}
                        </span>
                      )}
                      <span className="min-w-0">
                        <span className="block max-w-[260px] truncate font-semibold hover:underline">{shortName(lead.name)}</span>
                        <span className="block max-w-[260px] truncate text-xs text-[color:var(--ink-soft)]">
                          #{lead.id} · {n ? n.label : lead.category || "outro"} · {lead.neighborhood || lead.city}
                        </span>
                      </span>
                    </button>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-xs">
                    {lead.rating != null ? (
                      <>
                        <b className="text-sm">★ {lead.rating.toFixed(1)}</b>{" "}
                        <span className="text-[color:var(--ink-soft)]">({lead.reviews_count ?? 0})</span>
                      </>
                    ) : (
                      <span className="text-[color:var(--ink-soft)]">—</span>
                    )}
                    <span className="mt-0.5 flex gap-1 text-[10px] font-semibold">
                      {lead.whatsapp ? <span className="rounded bg-emerald-100 px-1 text-emerald-800">WA</span> : null}
                      {lead.instagram ? <span className="rounded bg-pink-100 px-1 text-pink-800">IG</span> : null}
                      {lead.demo_url ? <span className="rounded bg-sky-100 px-1 text-sky-800">demo</span> : null}
                      {queued.has(lead.id) ? <span className="rounded bg-amber-100 px-1 text-amber-800">na fila</span> : null}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <StatusBadge status={lead.status} />
                    {lead.status === "recusou" && lead.demo_url && (daysSince(lead.updated_at) ?? 0) >= 7 ? (
                      <span className="mt-0.5 block text-[10px] font-semibold text-rose-700" title={`Rode /remove-demo ${lead.id} em demos/`}>
                        remover demo
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2.5">
                    <InterestBadge interest={lead.interest} />
                  </td>
                  <td className={`whitespace-nowrap px-3 py-2.5 text-xs ${waiting ? "font-semibold text-amber-700" : "text-[color:var(--ink-soft)]"}`}>
                    {ago(lead.last_contact_at)}
                    {waiting ? " · lembrete?" : ""}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => void openLead("abordar", lead.id)}
                        className="rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                      >
                        Abordar
                      </button>
                      <button
                        type="button"
                        onClick={() => void openLead("resultado", lead.id)}
                        className="rounded-full border border-[color:var(--line)] bg-white px-3 py-1.5 text-xs font-semibold hover:border-[color:var(--ink)]"
                      >
                        Atualizar
                      </button>
                      <button
                        type="button"
                        onClick={() => void openLead("respostas", lead.id)}
                        className="rounded-full border border-[color:var(--line)] bg-white px-3 py-1.5 text-xs font-semibold hover:border-[color:var(--ink)]"
                      >
                        Respostas
                      </button>
                      <button
                        type="button"
                        onClick={() => void openLead("detalhes", lead.id)}
                        aria-label={`Detalhes de ${lead.name}`}
                        className="rounded-full border border-[color:var(--line)] bg-white px-2.5 py-1.5 text-xs font-semibold hover:border-[color:var(--ink)]"
                      >
                        ⋯
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {visible.length > limit ? (
        <div className="mt-3 text-center">
          <button type="button" onClick={() => setLimit((n) => n + PAGE)} className={btnGhost}>
            Mostrar mais ({visible.length - limit})
          </button>
        </div>
      ) : null}

      {/* Modais */}
      {modal?.kind === "abordar" && current ? (
        <ApproachModal
          key={`a${current.id}`}
          lead={current}
          template={template || defaultTemplate}
          queued={queued.has(current.id)}
          history={history}
          onPatch={(b) => patch(current.id, b)}
          onCopy={(t, l) => void copy(t, l)}
          onClose={() => setModal(null)}
          onEditTemplate={() => setModal({ kind: "mensagem" })}
        />
      ) : null}
      {modal?.kind === "resultado" && current ? (
        <OutcomeModal
          key={`r${current.id}`}
          lead={current}
          history={history}
          onPatch={(b) => patch(current.id, b)}
          onClose={() => setModal(null)}
        />
      ) : null}
      {modal?.kind === "detalhes" && current ? (
        <DetailsModal
          key={`d${current.id}`}
          lead={current}
          history={history}
          onPatch={(b) => patch(current.id, b)}
          onDelete={() => void remove(current.id)}
          onCopy={(t, l) => void copy(t, l)}
          onClose={() => setModal(null)}
        />
      ) : null}
      {modal?.kind === "respostas" && current ? (
        <RepliesModal
          key={`s${current.id}`}
          lead={current}
          onPatch={(b) => patch(current.id, b)}
          onCopy={(t, l) => void copy(t, l)}
          onClose={() => setModal(null)}
        />
      ) : null}
      {modal?.kind === "respostas-geral" ? (
        <RepliesModal lead={null} onCopy={(t, l) => void copy(t, l)} onClose={() => setModal(null)} />
      ) : null}
      {modal?.kind === "mensagem" ? (
        <TemplateModal
          template={template || defaultTemplate}
          defaultTemplate={defaultTemplate}
          sample={sample}
          onSave={saveTemplate}
          onClose={() => setModal(null)}
        />
      ) : null}
      {modal?.kind === "coletar" ? (
        <CollectModal
          onDone={(msg) => {
            setNotice(msg);
            void load();
          }}
          onClose={() => setModal(null)}
        />
      ) : null}
    </main>
  );
}
