"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { FIT_EXPLAINER, leadFit, type Fit } from "@/lib/leads/fit";
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
import { ago, btnDark, btnGhost, daysSince, input, InterestBadge, isToday, StatusBadge, waLink } from "./_components/ui";

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

type Sort = "chance" | "prioridade" | "ultimo_contato" | "nota" | "recentes";
type ModalState =
  | { kind: "abordar" | "resultado" | "detalhes" | "respostas"; id: number }
  | { kind: "respostas-geral" }
  | { kind: "mensagem" }
  | { kind: "coletar" }
  | null;

const thDiv = "relative before:absolute before:left-0 before:top-1/2 before:h-5 before:-translate-y-1/2 before:w-px before:bg-[color:var(--line)]";
const bulkBtn = "rounded-full border border-white/30 px-3 py-1.5 text-xs font-semibold hover:bg-white hover:text-[color:var(--ink)] disabled:opacity-50";
const pageBtn = (active: boolean) =>
  `grid h-8 min-w-8 place-items-center rounded-lg px-2 text-sm font-semibold disabled:opacity-30 ${
    active ? "border border-[color:var(--ink)] bg-white" : "hover:bg-white"
  }`;

/** 1 … 4 5 [6] 7 8 … 20  (0 = reticências). */
function pageList(current: number, total: number): number[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const set = new Set([1, total, current - 1, current, current + 1].filter((p) => p >= 1 && p <= total));
  const sorted = [...set].sort((x, y) => x - y);
  const out: number[] = [];
  sorted.forEach((p, i) => {
    if (i && p - sorted[i - 1]! > 1) out.push(0);
    out.push(p);
  });
  return out;
}

/** "5511971820189" → "+55 (11) 97182-0189"; cai para o telefone do Google. */
function displayNumber(lead: Lead): string | null {
  const d = (lead.whatsapp || "").replace(/\D/g, "");
  if (d.length === 13 && d.startsWith("55")) return `+55 (${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}`;
  if (d.length === 12 && d.startsWith("55")) return `+55 (${d.slice(2, 4)}) ${d.slice(4, 8)}-${d.slice(8)}`;
  return lead.phone || (d ? `+${d}` : null);
}

const TIER_STYLE: Record<Fit["tier"], { cls: string; bar: string; label: string }> = {
  alta: { cls: "text-emerald-800", bar: "bg-emerald-500", label: "alta" },
  media: { cls: "text-amber-800", bar: "bg-amber-400", label: "média" },
  baixa: { cls: "text-stone-600", bar: "bg-stone-400", label: "baixa" },
  fora: { cls: "text-stone-400", bar: "bg-stone-300", label: "fora" },
};

function FitBadge({ fit }: { fit: Fit }) {
  const st = TIER_STYLE[fit.tier];
  const title =
    fit.tier === "fora"
      ? `Fora da lista: ${fit.note}`
      : `Chance de fechar: ${fit.score}/100\n` + fit.parts.map((p) => `${p.label}: ${p.points}/${p.max} · ${p.why}`).join("\n");
  if (fit.tier === "fora") {
    return (
      <span title={title} className="text-[11px] text-[color:var(--ink-soft)]">
        {fit.note}
      </span>
    );
  }
  return (
    <span title={title} className="block w-[76px] cursor-help">
      <span className={`flex items-baseline gap-1 ${st.cls}`}>
        <b className="text-base">{fit.score}</b>
        <span className="text-[10px] font-semibold uppercase">{st.label}</span>
      </span>
      <span className="mt-1 block h-1.5 w-full overflow-hidden rounded-full bg-stone-200">
        <span className={`block h-full rounded-full ${st.bar}`} style={{ width: `${fit.score}%` }} />
      </span>
    </span>
  );
}

type MenuItem = { label: string; hint?: string; tone?: "green" | "amber"; onClick?: () => unknown; href?: string } | null;

/** Botão "Ações ▾" com menu flutuante (position: fixed para não ser cortado pela rolagem da tabela). */
function RowMenu({ items, label }: { items: MenuItem[]; label: string }) {
  const [pos, setPos] = useState<{ top: number; right: number; up: boolean } | null>(null);

  useEffect(() => {
    if (!pos) return;
    const close = () => setPos(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [pos]);

  const list = items.filter((it, i, arr) => it || (i > 0 && arr[i - 1] && i < arr.length - 1));
  const itemCls = (tone?: "green" | "amber") =>
    `block w-full px-3.5 py-2 text-left text-sm hover:bg-[color:var(--bg)] ${
      tone === "green" ? "font-semibold text-emerald-700" : tone === "amber" ? "font-semibold text-amber-800" : ""
    }`;

  return (
    <>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={!!pos}
        aria-label={label}
        onClick={(e) => {
          if (pos) {
            setPos(null);
            return;
          }
          const r = e.currentTarget.getBoundingClientRect();
          const up = r.bottom + 420 > window.innerHeight && r.top > 420;
          setPos({ top: up ? r.top - 6 : r.bottom + 6, right: window.innerWidth - r.right, up });
        }}
        className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold ${
          pos ? "border-[color:var(--ink)] bg-[color:var(--ink)] text-white" : "border-[color:var(--line)] bg-white hover:border-[color:var(--ink)]"
        }`}
      >
        Ações <span aria-hidden className="text-[10px]">▾</span>
      </button>
      {pos
        ? createPortal(
        <>
          <div className="fixed inset-0 z-40" onMouseDown={() => setPos(null)} aria-hidden />
          <div
            role="menu"
            className="fixed z-50 w-64 overflow-hidden rounded-2xl border border-[color:var(--line)] bg-white py-1.5 text-left shadow-xl"
            style={{ right: pos.right, ...(pos.up ? { bottom: window.innerHeight - pos.top } : { top: pos.top }) }}
          >
            {list.map((it, i) =>
              !it ? (
                <div key={`sep${i}`} className="my-1 h-px bg-[color:var(--line)]" />
              ) : it.href ? (
                <a key={it.label} role="menuitem" href={it.href} target="_blank" rel="noreferrer" onClick={() => setPos(null)} className={itemCls(it.tone)}>
                  {it.label} <span className="text-[color:var(--ink-soft)]">↗</span>
                </a>
              ) : (
                <button
                  key={it.label}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setPos(null);
                    it.onClick?.();
                  }}
                  className={itemCls(it.tone)}
                >
                  {it.label}
                  {it.hint ? <span className="block text-[11px] font-normal text-[color:var(--ink-soft)]">{it.hint}</span> : null}
                </button>
              ),
            )}
          </div>
        </>,
            document.body,
          )
        : null}
    </>
  );
}

function Checkbox({
  checked,
  indeterminate,
  onChange,
  label,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <input
      type="checkbox"
      checked={checked}
      ref={(el) => {
        if (el) el.indeterminate = !!indeterminate;
      }}
      onChange={onChange}
      aria-label={label}
      className="h-4 w-4 cursor-pointer rounded accent-[color:var(--ink)]"
    />
  );
}

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
  const [sort, setSort] = useState<Sort>("chance");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

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

  const fits = useMemo(() => new Map(leads.map((l) => [l.id, leadFit(l)])), [leads]);

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase().replace(/^#/, "");
    const termDigits = term.replace(/\D/g, "");
    const test = VIEWS.find((v) => v.id === view)!.test;
    const list = leads.filter((l) => {
      if (!test(l)) return false;
      if (status !== "all" && l.status !== status) return false;
      if (niche === "outros" && l.niche) return false;
      if (niche !== "all" && niche !== "outros" && l.niche !== niche) return false;
      if (interest === "none" && l.interest) return false;
      if (interest !== "all" && interest !== "none" && l.interest !== interest) return false;
      if (!term) return true;
      if ([l.name, l.neighborhood, l.category, l.city, String(l.id)].some((v) => v?.toLowerCase().includes(term))) return true;
      // telefone: compara só os dígitos (aceita "(11) 99835-2989", "11998352989", "+55 11…" ou um trecho com 4+ dígitos)
      return termDigits.length >= 4 && [l.whatsapp, l.phone].some((v) => v?.replace(/\D/g, "").includes(termDigits));
    });
    const time = (iso: string | null) => (iso ? new Date(iso).getTime() : 0);
    if (sort === "chance") {
      list.sort((a, b) => {
        const fa = fits.get(a.id)!, fb = fits.get(b.id)!;
        const out = Number(fa.tier === "fora") - Number(fb.tier === "fora");
        return out || fb.score - fa.score || (b.reviews_count ?? 0) - (a.reviews_count ?? 0);
      });
    } else if (sort === "ultimo_contato") list.sort((a, b) => time(b.last_contact_at) - time(a.last_contact_at));
    else if (sort === "nota") list.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || (b.reviews_count ?? 0) - (a.reviews_count ?? 0));
    else if (sort === "recentes") list.sort((a, b) => time(b.created_at) - time(a.created_at));
    return list;
  }, [leads, view, q, status, niche, interest, sort, fits]);

  const pages = Math.max(1, Math.ceil(visible.length / pageSize));
  const safePage = Math.min(page, pages);
  const pageRows = visible.slice((safePage - 1) * pageSize, safePage * pageSize);
  const pageAllSelected = pageRows.length > 0 && pageRows.every((l) => selected.has(l.id));
  const pageSomeSelected = pageRows.some((l) => selected.has(l.id));
  const selectedQueued = [...selected].filter((id) => queued.has(id)).length;

  function toggleOne(id: number) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function togglePage() {
    setSelected((s) => {
      const next = new Set(s);
      if (pageAllSelected) pageRows.forEach((l) => next.delete(l.id));
      else pageRows.forEach((l) => next.add(l.id));
      return next;
    });
  }

  async function bulk(patchBody: Patch | null, label: string, cancelQueue = false, ids = [...selected]): Promise<number> {
    if (!ids.length) return 0;
    setBulkBusy(true);
    setError("");
    try {
      const res = await fetch("/api/leads/bulk", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ids, patch: patchBody ?? undefined, cancelQueue }),
      });
      const json = (await res.json()) as { leads?: Lead[]; cancelled?: number; error?: string };
      if (!res.ok) {
        setError(json.error || "Ação em massa falhou");
        return 0;
      }
      const byId = new Map((json.leads || []).map((l) => [l.id, l]));
      setLeads((list) => list.map((l) => byId.get(l.id) ?? l));
      if (cancelQueue) {
        setQueued((q) => {
          const next = new Set(q);
          ids.forEach((id) => next.delete(id));
          return next;
        });
      }
      setNotice(`${label}: ${cancelQueue ? `${json.cancelled ?? 0} mensagem(ns) canceladas` : `${byId.size} lead(s)`}`);
      return byId.size;
    } finally {
      setBulkBusy(false);
    }
  }

  async function bulkMarkContacted() {
    const chosen = leads.filter((l) => selected.has(l.id));
    const fresh = chosen.filter((l) => BEFORE_CONTACT.includes(l.status)).map((l) => l.id);
    const skipped = chosen.length - fresh.length;
    if (!fresh.length) {
      setNotice("Todos os selecionados já estavam abordados ou além. Use \"Registrar contato hoje\".");
      return;
    }
    if (!confirm(`Marcar ${fresh.length} lead(s) como abordado${skipped ? ` (${skipped} já abordados ficam como estão)` : ""}?`)) return;
    await bulk({ status: "abordado", touch: true, event_note: "abordagem manual pelo celular (em massa)" }, "Marcados como abordado", false, fresh);
  }

  async function copySelectedNumbers() {
    const lines = leads
      .filter((l) => selected.has(l.id))
      .map((l) => {
        const nmb = displayNumber(l);
        return nmb ? `${shortName(l.name)}: ${nmb}` : null;
      })
      .filter(Boolean);
    await copy(lines.join("\n"), `${lines.length} número(s)`);
  }

  const filtersActive = q || status !== "all" || niche !== "all" || interest !== "all";

  function clearFilters() {
    setQ("");
    setStatus("all");
    setNiche("all");
    setInterest("all");
    setPage(1);
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
    <main className="mx-auto min-h-screen max-w-[1480px] px-4 py-8 md:px-8">
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
              setPage(1);
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
          placeholder="Buscar nome, bairro, telefone ou #id"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
          className={`${input} w-full sm:w-72`}
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
          <option value="chance">Ordenar: chance de fechar</option>
          <option value="prioridade">Ordenar: nicho prioritário</option>
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

      {sort === "chance" ? (
        <details className="mt-2 rounded-2xl border border-[color:var(--line)] bg-white/50 px-4 py-2 text-xs">
          <summary className="cursor-pointer font-semibold">
            Como a &quot;chance de fechar&quot; é calculada (0 a 100) · base: 104 abordados, 4 responderam com interesse
          </summary>
          <ul className="mt-2 grid list-disc gap-1 pl-4 text-[color:var(--ink-soft)]">
            {FIT_EXPLAINER.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          <p className="mt-2 text-[color:var(--ink-soft)]">Alta = 75+ (já responderam), média = 60 a 74, baixa = abaixo de 60. Passe o mouse na nota de cada lead para ver a conta.</p>
        </details>
      ) : null}

      {/* Ações em massa */}
      {selected.size ? (
        <div className="sticky top-20 z-30 mt-3 flex flex-wrap items-center gap-2 rounded-2xl border border-[color:var(--ink)] bg-[color:var(--ink)] px-3 py-2.5 text-white shadow-lg">
          <span className="text-sm font-semibold">
            {selected.size} selecionado{selected.size > 1 ? "s" : ""}
          </span>
          {selected.size < visible.length ? (
            <button type="button" className="text-xs underline opacity-80 hover:opacity-100" onClick={() => setSelected(new Set(visible.map((l) => l.id)))}>
              selecionar todos os {visible.length} do filtro
            </button>
          ) : null}
          <span className="mx-1 hidden h-5 w-px bg-white/25 sm:block" />
          <button type="button" disabled={bulkBusy} className={bulkBtn} onClick={() => void bulkMarkContacted()}>
            Marcar abordado
          </button>
          <button
            type="button"
            disabled={bulkBusy}
            className={bulkBtn}
            onClick={() => void bulk({ touch: true, event_note: "contato manual registrado em massa" }, "Contato de hoje registrado")}
          >
            Registrar contato hoje
          </button>
          <button
            type="button"
            disabled={bulkBusy}
            className={bulkBtn}
            onClick={() =>
              confirm(`Marcar ${selected.size} lead(s) como sem interesse (recusou)?`) &&
              void bulk({ interest: "nao", status: "recusou", touch: true, event_note: "sem interesse (em massa)" }, "Marcados como sem interesse")
            }
          >
            Sem interesse
          </button>
          <select
            disabled={bulkBusy}
            value=""
            onChange={(e) => {
              const s = e.target.value as LeadStatus;
              if (s && confirm(`Mudar ${selected.size} lead(s) para "${LEAD_STATUS_LABEL[s]}"?`)) {
                void bulk({ status: s, event_note: "status alterado em massa" }, `Status: ${LEAD_STATUS_LABEL[s]}`);
              }
            }}
            className="rounded-full border border-white/30 bg-transparent px-3 py-1.5 text-xs font-semibold text-white [&>option]:text-black"
            aria-label="Mudar status dos selecionados"
          >
            <option value="">Mudar status…</option>
            {LEAD_STATUSES.map((s) => (
              <option key={s} value={s}>
                {LEAD_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          {selectedQueued ? (
            <button
              type="button"
              disabled={bulkBusy}
              className={bulkBtn}
              onClick={() =>
                confirm(`Tirar ${selectedQueued} lead(s) da fila de disparos automáticos? As mensagens aprovadas deles não serão enviadas.`) &&
                void bulk(null, "Retirados da fila automática", true)
              }
            >
              Tirar da fila automática ({selectedQueued})
            </button>
          ) : null}
          <button type="button" className={bulkBtn} onClick={() => void copySelectedNumbers()}>
            Copiar números
          </button>
          <button type="button" className="ml-auto text-xs font-semibold underline opacity-80 hover:opacity-100" onClick={() => setSelected(new Set())}>
            limpar seleção
          </button>
        </div>
      ) : null}

      {/* Tabela */}
      <div className="mt-3 overflow-x-auto rounded-2xl border border-[color:var(--line)] bg-white/80">
        <table className="w-full min-w-[1200px] border-collapse text-left text-sm">
          <thead className="bg-[color:var(--bg-deep)] text-xs font-bold text-[color:var(--ink)]">
            <tr className="[&>th]:px-3 [&>th]:py-3">
              <th className="w-10 !pl-4">
                <Checkbox
                  checked={pageAllSelected}
                  indeterminate={!pageAllSelected && pageSomeSelected}
                  onChange={togglePage}
                  label="Selecionar leads desta página"
                />
              </th>
              <th>Empresa</th>
              <th className={thDiv}>Chance</th>
              <th className={thDiv}>Contato</th>
              <th className={thDiv}>Redes sociais</th>
              <th className={thDiv}>Status</th>
              <th className={thDiv}>Última abordagem</th>
              <th className={`${thDiv} md:sticky md:right-0 z-10 bg-[color:var(--bg-deep)] text-right !pr-4 shadow-[-10px_0_12px_-12px_rgba(0,0,0,0.35)]`}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-[color:var(--ink-soft)]">
                  Carregando…
                </td>
              </tr>
            ) : null}
            {!loading && !visible.length ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-[color:var(--ink-soft)]">
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
            {pageRows.map((lead) => {
              const n = lead.niche ? NICHE_BY_ID[lead.niche] : null;
              const waiting = lead.status === "abordado" && (daysSince(lead.last_contact_at) ?? 0) >= WAIT_DAYS;
              const number = displayNumber(lead);
              const ig = lead.instagram?.match(/instagram\.com\/([^/?#]+)/i)?.[1];
              const isSel = selected.has(lead.id);
              return (
                <tr
                  key={lead.id}
                  className={`border-t border-[color:var(--line)] align-middle [&>td]:px-3 [&>td]:py-3 ${isSel ? "bg-amber-50" : "hover:bg-white"}`}
                >
                  <td className="!pl-4">
                    <Checkbox checked={isSel} onChange={() => toggleOne(lead.id)} label={`Selecionar ${lead.name}`} />
                  </td>
                  <td>
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
                        <span className="block max-w-[230px] truncate font-semibold hover:underline">{shortName(lead.name)}</span>
                        <span className="block max-w-[230px] truncate text-xs text-[color:var(--ink-soft)]">
                          #{lead.id} · {n ? n.label : lead.category || "outro"} · {lead.neighborhood || lead.city}
                          {lead.rating != null ? ` · ★ ${lead.rating.toFixed(1)}` : ""}
                        </span>
                      </span>
                    </button>
                  </td>
                  <td>
                    <FitBadge fit={fits.get(lead.id)!} />
                  </td>
                  <td className="whitespace-nowrap">
                    {number ? (
                      <span className="flex items-center gap-1.5">
                        <span className="font-mono text-[13px]">{number}</span>
                        <button
                          type="button"
                          onClick={() => void copy(number, `Número de ${shortName(lead.name)}`)}
                          title="Copiar número"
                          aria-label={`Copiar número de ${lead.name}`}
                          className="rounded-md border border-[color:var(--line)] bg-white px-1.5 py-0.5 text-[11px] font-semibold hover:border-[color:var(--ink)]"
                        >
                          copiar
                        </button>
                      </span>
                    ) : (
                      <span className="text-xs text-[color:var(--ink-soft)]">sem telefone</span>
                    )}
                    <span className="mt-0.5 block text-[11px] text-[color:var(--ink-soft)]">
                      {lead.whatsapp ? (
                        <a href={waLink(lead) ?? undefined} target="_blank" rel="noreferrer" className="font-semibold text-emerald-700 hover:underline">
                          WhatsApp ↗
                        </a>
                      ) : (
                        "fixo / sem WhatsApp"
                      )}
                    </span>
                  </td>
                  <td>
                    <span className="flex flex-wrap gap-1 text-[11px] font-semibold">
                      {lead.instagram ? (
                        <a href={lead.instagram} target="_blank" rel="noreferrer" className="rounded-full bg-pink-100 px-2 py-0.5 text-pink-800 hover:underline">
                          {ig ? `@${ig}` : "Instagram"}
                        </a>
                      ) : null}
                      {lead.maps_url ? (
                        <a href={lead.maps_url} target="_blank" rel="noreferrer" className="rounded-full bg-stone-100 px-2 py-0.5 text-stone-700 hover:underline">
                          Maps
                        </a>
                      ) : null}
                      {lead.website_raw && lead.website_raw !== lead.instagram ? (
                        <a href={lead.website_raw} target="_blank" rel="noreferrer" className="rounded-full bg-stone-100 px-2 py-0.5 text-stone-700 hover:underline">
                          Link
                        </a>
                      ) : null}
                      {lead.demo_url ? (
                        <a href={lead.demo_url} target="_blank" rel="noreferrer" className="rounded-full bg-sky-100 px-2 py-0.5 text-sky-800 hover:underline">
                          Demo
                        </a>
                      ) : null}
                      {!lead.instagram && !lead.maps_url && !lead.demo_url ? <span className="text-[color:var(--ink-soft)]">—</span> : null}
                    </span>
                  </td>
                  <td>
                    <span className="flex flex-col items-start gap-1">
                      <StatusBadge status={lead.status} />
                      {lead.interest ? <InterestBadge interest={lead.interest} /> : null}
                      {queued.has(lead.id) ? (
                        <span className="rounded bg-amber-100 px-1.5 text-[10px] font-semibold text-amber-800" title="Tem mensagem aprovada na fila automática">
                          na fila automática
                        </span>
                      ) : null}
                      {lead.status === "recusou" && lead.demo_url && (daysSince(lead.updated_at) ?? 0) >= 7 ? (
                        <span className="text-[10px] font-semibold text-rose-700" title={`Rode /remove-demo ${lead.id} em demos/`}>
                          remover demo
                        </span>
                      ) : null}
                    </span>
                  </td>
                  <td className="whitespace-nowrap">
                    {lead.last_contact_at ? (
                      <>
                        <span className="block text-[13px] font-semibold">
                          {new Date(lead.last_contact_at).toLocaleDateString("pt-BR")}{" "}
                          <span className="font-normal text-[color:var(--ink-soft)]">
                            {new Date(lead.last_contact_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </span>
                        <span className={`block text-[11px] ${waiting ? "font-semibold text-amber-700" : "text-[color:var(--ink-soft)]"}`}>
                          {ago(lead.last_contact_at).replace(/^hoje, .*/, "hoje")}
                          {waiting ? " · lembrete" : ""}
                        </span>
                      </>
                    ) : (
                      <span className="text-xs text-[color:var(--ink-soft)]">nunca abordado</span>
                    )}
                  </td>
                  <td className={`md:sticky md:right-0 !pr-4 text-right shadow-[-10px_0_12px_-12px_rgba(0,0,0,0.35)] ${isSel ? "bg-amber-50" : "bg-white"}`}>
                    <RowMenu
                      label={`Ações para ${lead.name}`}
                      items={[
                        { label: "Abordar (mensagem padrão)", hint: "abrir canais e mensagem", tone: "green", onClick: () => void openLead("abordar", lead.id) },
                        { label: "Atualizar resultado", hint: "respondeu, interesse, fechou…", onClick: () => void openLead("resultado", lead.id) },
                        { label: "Respostas prontas", hint: "o que mandar em cada situação", onClick: () => void openLead("respostas", lead.id) },
                        null,
                        ...(number ? [{ label: "Copiar número", onClick: () => void copy(number, `Número de ${shortName(lead.name)}`) }] : []),
                        ...(lead.whatsapp ? [{ label: "Abrir conversa no WhatsApp", href: waLink(lead) ?? undefined }] : []),
                        ...(lead.instagram ? [{ label: "Abrir Instagram", href: lead.instagram }] : []),
                        ...(lead.maps_url ? [{ label: "Abrir no Google Maps", href: lead.maps_url }] : []),
                        ...(lead.demo_url ? [{ label: "Ver demo", href: lead.demo_url }] : []),
                        null,
                        { label: "Registrar contato hoje", onClick: () => void patch(lead.id, { touch: true, event_note: "contato manual registrado" }) },
                        ...(queued.has(lead.id)
                          ? [
                              {
                                label: "Tirar da fila automática",
                                tone: "amber" as const,
                                onClick: () =>
                                  confirm(`Tirar ${shortName(lead.name)} da fila de disparos automáticos?`) &&
                                  void bulk(null, "Retirado da fila automática", true, [lead.id]),
                              },
                            ]
                          : []),
                        { label: "Copiar /landing-demo", onClick: () => void copy(`/landing-demo ${lead.id}`, "Comando") },
                        { label: "Detalhes e edição", onClick: () => void openLead("detalhes", lead.id) },
                      ]}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Paginação */}
      {visible.length ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
          <span className="text-xs text-[color:var(--ink-soft)]">
            {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, visible.length)} de {visible.length}
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className={`${input} ml-2 py-1 text-xs`}
              aria-label="Leads por página"
            >
              {[20, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n} por página
                </option>
              ))}
            </select>
          </span>
          <nav className="flex items-center gap-1" aria-label="Páginas">
            <button type="button" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)} className={pageBtn(false)} aria-label="Página anterior">
              ‹
            </button>
            {pageList(safePage, pages).map((p, i) =>
              p === 0 ? (
                <span key={`e${i}`} className="px-1 text-[color:var(--ink-soft)]">
                  …
                </span>
              ) : (
                <button key={p} type="button" onClick={() => setPage(p)} className={pageBtn(p === safePage)} aria-current={p === safePage ? "page" : undefined}>
                  {p}
                </button>
              ),
            )}
            <button type="button" disabled={safePage >= pages} onClick={() => setPage(safePage + 1)} className={pageBtn(false)} aria-label="Próxima página">
              ›
            </button>
          </nav>
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
