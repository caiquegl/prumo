"use client";

import { FormEvent, useState } from "react";
import { leadFit } from "@/lib/leads/fit";
import { DEFAULT_AREAS, NICHE_BY_ID, NICHES } from "@/lib/leads/niches";
import {
  LEAD_STATUSES,
  LEAD_STATUS_LABEL,
  type Lead,
  type LeadEvent,
  type LeadInterest,
  type LeadStatus,
} from "@/lib/leads/types";
import { renderTemplate, shortName, TEMPLATE_FIELDS } from "@/lib/outreach/messages";
import type { LeadMessage } from "@/lib/outreach/store";
import { REPLY_GROUP_LABEL, REPLY_SITUATIONS, suggestedSituations, type ReplySituation } from "@/lib/leads/replies";
import {
  ago,
  btnDark,
  btnGhost,
  btnGreen,
  Bubble,
  daysSince,
  input,
  InterestBadge,
  Modal,
  StatusBadge,
  waLink,
} from "./ui";

export type Patch = Record<string, unknown>;
export type History = { events: LeadEvent[]; messages: LeadMessage[] } | null;

const BEFORE_CONTACT: LeadStatus[] = ["sem_site", "criando", "publicado"];
const CLOSED: LeadStatus[] = ["recusou", "descartado", "aceitou"];

function nicheLabel(lead: Lead) {
  const n = lead.niche ? NICHE_BY_ID[lead.niche] : null;
  return n ? n.label : lead.category || "fora da prioridade";
}

function LeadSubtitle({ lead }: { lead: Lead }) {
  return (
    <span>
      #{lead.id} · {nicheLabel(lead)} · {lead.neighborhood || lead.city}
      {lead.rating != null ? ` · ★ ${lead.rating.toFixed(1)} (${lead.reviews_count ?? 0})` : ""}
    </span>
  );
}

function HistoryList({ history }: { history: History }) {
  if (!history) return <p className="text-xs text-[color:var(--ink-soft)]">Carregando histórico…</p>;
  const { events, messages } = history;
  return (
    <div className="grid gap-4">
      {messages.length ? (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[color:var(--ink-soft)]">
            Mensagens registradas (automação + respostas)
          </p>
          <div className="grid gap-2 rounded-2xl bg-[#efeae2] p-3">
            {messages.map((m) => (
              <Bubble
                key={m.id}
                side={m.dir}
                text={m.text.split(/\n-{3,}\n/).join("\n\n")}
                meta={`${new Date(m.at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}${
                  m.dir === "out" && m.status !== "sent" ? ` · ${m.status === "approved" ? "na fila" : m.status}` : ""
                }${m.status === "auto" ? " · resposta automática" : ""}`}
              />
            ))}
          </div>
        </div>
      ) : null}
      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-[color:var(--ink-soft)]">Histórico</p>
        {events.length ? (
          <ul className="grid gap-1 text-xs text-[color:var(--ink-soft)]">
            {events.map((ev) => (
              <li key={ev.id}>
                <span className="font-semibold text-[color:var(--ink)]">
                  {new Date(ev.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                </span>{" "}
                · {ev.from_status && ev.from_status !== ev.to_status ? `${LEAD_STATUS_LABEL[ev.from_status as LeadStatus] ?? ev.from_status} → ` : ""}
                {LEAD_STATUS_LABEL[ev.to_status as LeadStatus] ?? ev.to_status}
                {ev.note ? ` · ${ev.note}` : ""}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-[color:var(--ink-soft)]">Nada registrado ainda.</p>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Abordar */

export function ApproachModal({
  lead,
  template,
  queued,
  history,
  onPatch,
  onCopy,
  onClose,
  onEditTemplate,
}: {
  lead: Lead;
  template: string;
  queued: boolean;
  history: History;
  onPatch: (body: Patch) => Promise<boolean>;
  onCopy: (text: string, label: string) => void;
  onClose: () => void;
  onEditTemplate: () => void;
}) {
  const standard = renderTemplate(template, lead);
  const [text, setText] = useState(standard);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const contacted = !BEFORE_CONTACT.includes(lead.status);
  const wa = waLink(lead, text);
  const igHandle = lead.instagram?.match(/instagram\.com\/([^/?#]+)/i)?.[1];

  async function markSent() {
    setSaving(true);
    const ok = await onPatch(
      contacted
        ? { touch: true, event_note: "novo contato manual pelo celular" }
        : { status: "abordado", touch: true, event_note: "abordagem manual pelo celular (mensagem padrão)" },
    );
    setSaving(false);
    if (ok) onClose();
  }

  return (
    <Modal title={`Abordar ${shortName(lead.name)}`} subtitle={<LeadSubtitle lead={lead} />} onClose={onClose} wide>
      <div className="grid gap-5">
        {queued ? (
          <p className="rounded-xl bg-amber-100 px-3 py-2 text-sm text-amber-900">
            Este lead tem mensagem <b>aprovada na fila de disparos automáticos</b>. Se for mandar pelo celular, cancele
            em <a href="/leads/disparos" className="font-semibold underline">Disparos</a> para não chegar em dobro.
          </p>
        ) : null}
        {CLOSED.includes(lead.status) ? (
          <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-900">
            Status atual: <b>{LEAD_STATUS_LABEL[lead.status]}</b>. Confira antes de mandar outra mensagem.
          </p>
        ) : null}

        {/* Como abordar */}
        <section>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[color:var(--ink-soft)]">Como abordar</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Channel
              label="WhatsApp"
              value={lead.whatsapp ? `+${lead.whatsapp}` : "sem número de celular"}
              href={waLink(lead) ?? undefined}
              hint="melhor canal: mensagem curta, sem link"
              ok={!!lead.whatsapp}
            />
            <Channel
              label="Instagram"
              value={igHandle ? `@${igHandle}` : lead.instagram ? "perfil" : "não encontrado"}
              href={lead.instagram ?? undefined}
              hint="bom para quem posta muito: mande DM"
              ok={!!lead.instagram}
            />
            <Channel
              label="Telefone"
              value={lead.phone || "—"}
              href={lead.phone ? `tel:${lead.phone}` : undefined}
              hint="ligar no início do expediente"
              ok={!!lead.phone}
            />
            <Channel
              label="Google Maps"
              value={lead.rating != null ? `★ ${lead.rating.toFixed(1)} · ${lead.reviews_count ?? 0} avaliações` : "ver ficha"}
              href={lead.maps_url ?? undefined}
              hint="leia 2–3 avaliações antes de mandar"
              ok={!!lead.maps_url}
            />
          </div>
          {lead.demo_url ? (
            <a href={lead.demo_url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm font-semibold text-sky-700 underline">
              Demo publicada ↗
            </a>
          ) : null}
        </section>

        {/* Mensagem */}
        <section>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-[color:var(--ink-soft)]">Mensagem padrão (1 balão)</p>
            <div className="flex gap-3 text-xs font-semibold">
              <button type="button" className="underline" onClick={() => setEditing((v) => !v)}>
                {editing ? "ver balão" : "ajustar só para este lead"}
              </button>
              <button type="button" className="underline" onClick={onEditTemplate}>
                editar padrão
              </button>
            </div>
          </div>
          {editing ? (
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} className={`${input} w-full`} />
          ) : (
            <div className="rounded-2xl bg-[#efeae2] p-3">
              <Bubble text={text} />
            </div>
          )}
          {text !== standard ? (
            <button type="button" className="mt-1 text-xs font-semibold underline" onClick={() => setText(standard)}>
              voltar ao texto padrão
            </button>
          ) : null}
        </section>

        {/* Ações */}
        <section className="grid gap-2 rounded-2xl border border-[color:var(--line)] bg-white/60 p-3">
          <p className="text-sm">
            <b>1.</b> Copie ou abra no WhatsApp · <b>2.</b> envie pelo celular · <b>3.</b> volte e marque como enviado.
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btnGhost} onClick={() => onCopy(text, "Mensagem")}>
              Copiar mensagem
            </button>
            {wa ? (
              <a href={wa} target="_blank" rel="noreferrer" className={btnGreen}>
                Abrir no WhatsApp ↗
              </a>
            ) : null}
            <button type="button" className={btnDark} disabled={saving} onClick={() => void markSent()}>
              {saving ? "Salvando…" : contacted ? "Registrar novo contato hoje" : "Já enviei: marcar abordado"}
            </button>
          </div>
          <p className="text-xs text-[color:var(--ink-soft)]">
            Último contato: <b>{ago(lead.last_contact_at)}</b> · status <StatusBadge status={lead.status} />
          </p>
        </section>

        <HistoryList history={history} />
      </div>
    </Modal>
  );
}

function Channel({ label, value, href, hint, ok }: { label: string; value: string; href?: string; hint: string; ok: boolean }) {
  const body = (
    <>
      <span className="flex items-center gap-2 text-sm font-semibold">
        <span className={`h-2 w-2 rounded-full ${ok ? "bg-emerald-500" : "bg-stone-300"}`} />
        {label}
        {href ? <span className="ml-auto text-xs text-[color:var(--ink-soft)]">abrir ↗</span> : null}
      </span>
      <span className="block truncate text-sm">{value}</span>
      <span className="block text-xs text-[color:var(--ink-soft)]">{hint}</span>
    </>
  );
  const cls = `block rounded-2xl border border-[color:var(--line)] bg-white/70 px-3 py-2 ${ok ? "" : "opacity-55"}`;
  return href ? (
    <a href={href} target="_blank" rel="noreferrer" className={`${cls} hover:border-[color:var(--ink)]`}>
      {body}
    </a>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/* ------------------------------------------------------------------ Resultado */

type Outcome = { key: string; label: string; hint: string; tone: string; patch: (l: Lead) => Patch };

const OUTCOMES: Outcome[] = [
  {
    key: "abordado",
    label: "Abordei agora",
    hint: "mandei a mensagem",
    tone: "border-indigo-200 bg-indigo-50 text-indigo-950",
    patch: (l) => (BEFORE_CONTACT.includes(l.status) ? { status: "abordado", touch: true } : { touch: true }),
  },
  {
    key: "respondeu",
    label: "Respondeu",
    hint: "está conversando",
    tone: "border-violet-200 bg-violet-50 text-violet-950",
    patch: () => ({ status: "respondeu", touch: true }),
  },
  {
    key: "sim",
    label: "Tem interesse",
    hint: "quer ver / quer valores",
    tone: "border-emerald-200 bg-emerald-50 text-emerald-950",
    patch: (l) => ({ interest: "sim", touch: true, ...(l.status === "aceitou" ? {} : { status: "respondeu" }) }),
  },
  {
    key: "talvez",
    label: "Talvez",
    hint: "vai pensar / pediu para chamar depois",
    tone: "border-amber-200 bg-amber-50 text-amber-950",
    patch: () => ({ interest: "talvez", status: "respondeu", touch: true }),
  },
  {
    key: "nao",
    label: "Sem interesse",
    hint: "recusou",
    tone: "border-rose-200 bg-rose-50 text-rose-950",
    patch: () => ({ interest: "nao", status: "recusou", touch: true }),
  },
  {
    key: "aceitou",
    label: "Fechou negócio",
    hint: "aceitou a proposta 🎉",
    tone: "border-emerald-300 bg-emerald-100 text-emerald-950",
    patch: () => ({ interest: "sim", status: "aceitou", touch: true }),
  },
  {
    key: "sem_resposta",
    label: "Não respondeu",
    hint: "sem retorno depois do lembrete",
    tone: "border-stone-200 bg-stone-50 text-stone-800",
    patch: () => ({ status: "sem_resposta" }),
  },
  {
    key: "descartado",
    label: "Descartar",
    hint: "não vale abordar",
    tone: "border-stone-200 bg-stone-50 text-stone-600",
    patch: () => ({ status: "descartado" }),
  },
];

export function OutcomeModal({
  lead,
  history,
  onPatch,
  onClose,
}: {
  lead: Lead;
  history: History;
  onPatch: (body: Patch) => Promise<boolean>;
  onClose: () => void;
}) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  async function apply(o: Outcome) {
    setBusy(o.key);
    const ok = await onPatch({ ...o.patch(lead), event_note: note.trim() || o.label.toLowerCase() });
    setBusy(null);
    if (ok) onClose();
  }

  return (
    <Modal title={`Atualizar ${shortName(lead.name)}`} subtitle={<LeadSubtitle lead={lead} />} onClose={onClose}>
      <div className="grid gap-4">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <StatusBadge status={lead.status} />
          <InterestBadge interest={lead.interest} />
          <span className="text-[color:var(--ink-soft)]">· último contato {ago(lead.last_contact_at)}</span>
        </div>

        <label className="grid gap-1 text-xs font-semibold">
          Anotação (opcional, vai para o histórico)
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="ex.: pediu para chamar segunda; quer ver valores"
            className={input}
          />
        </label>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[color:var(--ink-soft)]">O que aconteceu?</p>
          <div className="grid grid-cols-2 gap-2">
            {OUTCOMES.map((o) => (
              <button
                key={o.key}
                type="button"
                disabled={!!busy}
                onClick={() => void apply(o)}
                className={`rounded-2xl border px-3 py-2.5 text-left transition hover:-translate-y-0.5 hover:shadow-sm disabled:opacity-50 ${o.tone}`}
              >
                <span className="block text-sm font-bold">{busy === o.key ? "Salvando…" : o.label}</span>
                <span className="block text-xs opacity-75">{o.hint}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-[color:var(--line)] pt-3 text-xs">
          <span className="font-semibold">Ajuste fino:</span>
          <select
            value={lead.status}
            onChange={(e) => void onPatch({ status: e.target.value, event_note: note.trim() || null })}
            className={`${input} py-1.5 text-xs`}
          >
            {LEAD_STATUSES.map((s) => (
              <option key={s} value={s}>
                {LEAD_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          <select
            value={lead.interest ?? ""}
            onChange={(e) =>
              void onPatch({ interest: (e.target.value || null) as LeadInterest | null, event_note: note.trim() || "interesse ajustado" })
            }
            className={`${input} py-1.5 text-xs`}
          >
            <option value="">Interesse: não informado</option>
            <option value="sim">Tem interesse</option>
            <option value="talvez">Talvez</option>
            <option value="nao">Sem interesse</option>
          </select>
        </div>

        <HistoryList history={history} />
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ Detalhes */

export function DetailsModal({
  lead,
  history,
  onPatch,
  onDelete,
  onCopy,
  onClose,
}: {
  lead: Lead;
  history: History;
  onPatch: (body: Patch) => Promise<boolean>;
  onDelete: () => void;
  onCopy: (text: string, label: string) => void;
  onClose: () => void;
}) {
  const [notes, setNotes] = useState(lead.notes || "");
  const [price, setPrice] = useState(lead.price_quoted != null ? String(lead.price_quoted) : "");
  const [demoUrl, setDemoUrl] = useState(lead.demo_url || "");
  const [instagram, setInstagram] = useState(lead.instagram || "");
  const [whatsapp, setWhatsapp] = useState(lead.whatsapp || "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await onPatch({ notes, price_quoted: price, demo_url: demoUrl, instagram, whatsapp: whatsapp.replace(/\D/g, "") });
    setSaving(false);
  }

  return (
    <Modal title={lead.name} subtitle={<LeadSubtitle lead={lead} />} onClose={onClose} wide>
      <div className="grid gap-5 md:grid-cols-2">
        <div className="grid content-start gap-2 text-sm">
          {lead.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element -- logo externo, miniatura
            <img src={lead.logo_url} alt={`Logo ${lead.name}`} className="h-14 w-14 rounded-xl border border-[color:var(--line)] bg-white object-contain p-1" />
          ) : null}
          {lead.brand_colors?.length ? (
            <span className="flex gap-1" aria-label="Cores da marca">
              {lead.brand_colors.map((c) => (
                <span key={c} title={c} className="h-3 w-6 rounded-sm border border-black/10" style={{ background: c }} />
              ))}
            </span>
          ) : null}
          <p>{lead.address}</p>
          {lead.phone ? (
            <p>
              Telefone: <a href={`tel:${lead.phone}`} className="underline">{lead.phone}</a>
            </p>
          ) : null}
          <div className="flex flex-wrap gap-3">
            {lead.maps_url ? <a href={lead.maps_url} target="_blank" rel="noreferrer" className="underline">Google Maps ↗</a> : null}
            {lead.instagram ? <a href={lead.instagram} target="_blank" rel="noreferrer" className="underline">Instagram ↗</a> : null}
            {lead.website_raw && lead.website_raw !== lead.instagram ? (
              <a href={lead.website_raw} target="_blank" rel="noreferrer" className="underline">Link atual ↗</a>
            ) : null}
            {lead.demo_url ? <a href={lead.demo_url} target="_blank" rel="noreferrer" className="underline">Demo ↗</a> : null}
          </div>
          {lead.opening_hours?.length ? (
            <ul className="text-xs text-[color:var(--ink-soft)]">
              {lead.opening_hours.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
          ) : null}
          <p className="text-xs text-[color:var(--ink-soft)]">
            Score {lead.score} · coletado em {new Date(lead.created_at).toLocaleDateString("pt-BR")}
            {lead.contacted_at ? ` · 1º contato ${new Date(lead.contacted_at).toLocaleDateString("pt-BR")}` : ""}
          </p>
          <button type="button" onClick={() => onCopy(`/landing-demo ${lead.id}`, "Comando")} className={`${btnGhost} mt-1 w-fit`}>
            Copiar /landing-demo {lead.id}
          </button>
        </div>

        <div className="grid content-start gap-2">
          <label className="grid gap-1 text-xs font-semibold">
            WhatsApp (só números, com 55)
            <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} inputMode="tel" className={input} />
          </label>
          <label className="grid gap-1 text-xs font-semibold">
            Instagram
            <input value={instagram} onChange={(e) => setInstagram(e.target.value)} className={input} />
          </label>
          <label className="grid gap-1 text-xs font-semibold">
            Link da demo
            <input value={demoUrl} onChange={(e) => setDemoUrl(e.target.value)} className={input} />
          </label>
          <label className="grid gap-1 text-xs font-semibold">
            Valor proposto (R$)
            <input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" className={input} />
          </label>
          <label className="grid gap-1 text-xs font-semibold">
            Notas
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className={input} />
          </label>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => void save()} disabled={saving} className={btnDark}>
              {saving ? "Salvando…" : "Salvar"}
            </button>
            <button type="button" onClick={onDelete} className="text-xs font-semibold text-rose-700 underline">
              Apagar lead
            </button>
          </div>
        </div>

        <div className="md:col-span-2">
          <FitBreakdown lead={lead} />
        </div>

        <div className="md:col-span-2">
          <HistoryList history={history} />
        </div>
      </div>
    </Modal>
  );
}

function FitBreakdown({ lead }: { lead: Lead }) {
  const fit = leadFit(lead);
  return (
    <div className="rounded-2xl border border-[color:var(--line)] bg-white/60 p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-[color:var(--ink-soft)]">
        Chance de fechar: {fit.tier === "fora" ? fit.note : `${fit.score}/100`}
      </p>
      {fit.parts.length ? (
        <ul className="mt-2 grid gap-1.5 text-xs">
          {fit.parts.map((p) => (
            <li key={p.label} className="grid grid-cols-[86px_44px_1fr] items-center gap-2">
              <span className="font-semibold">{p.label}</span>
              <span className="tabular-nums">
                {p.points}/{p.max}
              </span>
              <span className="text-[color:var(--ink-soft)]">{p.why}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ Mensagem padrão */

export function TemplateModal({
  template,
  defaultTemplate,
  sample,
  onSave,
  onClose,
}: {
  template: string;
  defaultTemplate: string;
  sample: Lead | null;
  onSave: (tpl: string) => Promise<boolean>;
  onClose: () => void;
}) {
  const [tpl, setTpl] = useState(template);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const ok = await onSave(tpl);
    setSaving(false);
    if (ok) onClose();
  }

  return (
    <Modal
      title="Mensagem padrão de abordagem"
      subtitle="Um balão só, igual para todos os leads. Os campos entre chaves são trocados pelos dados de cada empresa."
      onClose={onClose}
      wide
    >
      <div className="grid gap-4">
        <textarea value={tpl} onChange={(e) => setTpl(e.target.value)} rows={6} className={`${input} w-full`} />
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(TEMPLATE_FIELDS).map(([k, desc]) => (
            <button
              key={k}
              type="button"
              title={desc}
              onClick={() => setTpl((t) => `${t}${t.endsWith(" ") || !t ? "" : " "}${k}`)}
              className="rounded-full border border-[color:var(--line)] bg-white px-2.5 py-1 font-mono text-xs hover:border-[color:var(--ink)]"
            >
              {k}
            </button>
          ))}
        </div>
        <ul className="grid gap-0.5 text-xs text-[color:var(--ink-soft)]">
          {Object.entries(TEMPLATE_FIELDS).map(([k, desc]) => (
            <li key={k}>
              <code>{k}</code> {desc}
            </li>
          ))}
        </ul>
        {sample ? (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[color:var(--ink-soft)]">
              Prévia com {shortName(sample.name)}
            </p>
            <div className="rounded-2xl bg-[#efeae2] p-3">
              <Bubble text={renderTemplate(tpl, sample)} />
            </div>
          </div>
        ) : null}
        <p className="text-xs text-[color:var(--ink-soft)]">
          Lembrete: se mandar o link de uma demo, diga que é só uma demonstração e não o site oficial.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => void save()} disabled={saving || !tpl.trim()} className={btnDark}>
            {saving ? "Salvando…" : "Salvar para todos"}
          </button>
          <button type="button" onClick={() => setTpl(defaultTemplate)} className="text-xs font-semibold underline">
            Restaurar padrão
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ Coletar */

export function CollectModal({ onDone, onClose }: { onDone: (msg: string) => void; onClose: () => void }) {
  const [niche, setNiche] = useState(NICHES[0]!.queries[0]!);
  const [city, setCity] = useState(DEFAULT_AREAS[0]!);
  const [max, setMax] = useState(20);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
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
      onDone(`${json.found} encontrados · ${json.inserted} novos sem site · ${json.updated} já existiam · ${json.skippedWithSite} já têm site`);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Coletar leads no Google Maps" subtitle="Busca empresas sem site próprio e adiciona na tabela." onClose={onClose}>
      <form onSubmit={(e) => void submit(e)} className="grid gap-3">
        <label className="grid gap-1 text-xs font-semibold">
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
            <option value="">Outro (digite abaixo)</option>
          </select>
        </label>
        <label className="grid gap-1 text-xs font-semibold">
          Termo de busca
          <input value={niche} onChange={(e) => setNiche(e.target.value)} list="niche-queries" className={input} required />
          <datalist id="niche-queries">
            {NICHES.flatMap((n) => n.queries).map((qq) => (
              <option key={qq} value={qq} />
            ))}
          </datalist>
        </label>
        <label className="grid gap-1 text-xs font-semibold">
          Bairro / cidade
          <input value={city} onChange={(e) => setCity(e.target.value)} list="areas" className={input} required />
          <datalist id="areas">
            {DEFAULT_AREAS.map((a) => (
              <option key={a} value={a} />
            ))}
          </datalist>
        </label>
        <label className="grid gap-1 text-xs font-semibold">
          Máximo de resultados
          <input type="number" min={1} max={60} value={max} onChange={(e) => setMax(Number(e.target.value))} className={`${input} w-28`} />
        </label>
        {error ? <p className="rounded-xl bg-rose-100 px-3 py-2 text-sm text-rose-900">{error}</p> : null}
        <button type="submit" disabled={busy} className={`${btnDark} w-fit`}>
          {busy ? "Buscando no Google Maps (até 2 min)…" : "Coletar"}
        </button>
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------------ Respostas prontas */

function fillReply(text: string, lead: Lead | null) {
  if (lead) return renderTemplate(text, lead);
  return text
    .replaceAll("{nome}", "vocês")
    .replaceAll("{link}", "(link da demo)")
    .replaceAll("{busca}", "o serviço de vocês no bairro")
    .replaceAll("{acao}", "entrar em contato")
    .replaceAll("{bairro}", "o bairro");
}

function timing(s: ReplySituation, lead: Lead | null) {
  if (s.waitDays == null) return { text: "Responder na hora", tone: "bg-sky-100 text-sky-900" };
  if (!lead?.last_contact_at) return { text: `Esperar ${s.waitDays} dia${s.waitDays > 1 ? "s" : ""}`, tone: "bg-stone-100 text-stone-700" };
  const due = new Date(new Date(lead.last_contact_at).getTime() + s.waitDays * 86_400_000);
  if (due.getTime() <= Date.now()) return { text: "Já pode mandar", tone: "bg-emerald-100 text-emerald-900" };
  return {
    text: `Mandar a partir de ${due.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" })}`,
    tone: "bg-amber-100 text-amber-900",
  };
}

export function RepliesModal({
  lead,
  onPatch,
  onCopy,
  onClose,
}: {
  lead: Lead | null;
  onPatch?: (body: Patch) => Promise<boolean>;
  onCopy: (text: string, label: string) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  const suggested = lead ? suggestedSituations(lead, daysSince(lead.last_contact_at)) : [];
  const term = q.trim().toLowerCase();
  const match = (s: ReplySituation) =>
    !term || [s.title, s.when, s.tip ?? "", ...s.options].some((t) => t.toLowerCase().includes(term));
  const groups = (Object.keys(REPLY_GROUP_LABEL) as ReplySituation["group"][])
    .map((g) => ({ g, items: REPLY_SITUATIONS.filter((s) => s.group === g && match(s)) }))
    .filter((x) => x.items.length);
  const top = REPLY_SITUATIONS.filter((s) => suggested.includes(s.id) && match(s));

  async function markSent(s: ReplySituation) {
    if (!lead || !onPatch) return;
    const ok = await onPatch({ touch: true, event_note: `resposta enviada: ${s.title.toLowerCase()}` });
    if (ok) setSent(s.id);
  }

  const item = (s: ReplySituation, open: boolean) => {
    const t = timing(s, lead);
    return (
      <details key={s.id} open={open} className="group rounded-2xl border border-[color:var(--line)] bg-white/70 open:bg-white">
        <summary className="flex cursor-pointer list-none items-start gap-2 px-3.5 py-3 [&::-webkit-details-marker]:hidden">
          <span className="mt-0.5 text-xs text-[color:var(--ink-soft)] transition group-open:rotate-90">▶</span>
          <span className="min-w-0 flex-1 text-sm font-semibold">{s.title}</span>
          {suggested.includes(s.id) ? (
            <span className="shrink-0 rounded-full bg-[color:var(--coral)] px-2 py-0.5 text-[10px] font-bold text-white">sugerido</span>
          ) : null}
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${t.tone}`}>{t.text}</span>
        </summary>
        <div className="grid gap-3 border-t border-[color:var(--line)] px-3.5 py-3">
          <p className="text-xs">
            <b>Quando mandar:</b> {s.when}
          </p>
          {s.tip ? <p className="rounded-xl bg-amber-50 px-3 py-1.5 text-xs text-amber-900">💡 {s.tip}</p> : null}
          {s.options.map((o, i) => {
            const text = fillReply(o, lead);
            const wa = lead ? waLink(lead, text) : null;
            return (
              <div key={i} className="grid gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--ink-soft)]">Opção {i + 1}</p>
                <div className="rounded-2xl bg-[#efeae2] p-3">
                  <Bubble text={text} />
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={`${btnGhost} px-3 py-1.5 text-xs`} onClick={() => onCopy(text, "Resposta")}>
                    Copiar
                  </button>
                  {wa ? (
                    <a href={wa} target="_blank" rel="noreferrer" className={`${btnGreen} px-3 py-1.5 text-xs`}>
                      Abrir no WhatsApp ↗
                    </a>
                  ) : null}
                </div>
              </div>
            );
          })}
          {lead && onPatch ? (
            <button type="button" onClick={() => void markSent(s)} className={`${btnDark} w-fit px-3 py-1.5 text-xs`}>
              {sent === s.id ? "Registrado ✓" : "Enviei: registrar contato de hoje"}
            </button>
          ) : null}
        </div>
      </details>
    );
  };

  return (
    <Modal
      title={lead ? `Respostas para ${shortName(lead.name)}` : "Respostas prontas"}
      subtitle={
        lead ? (
          <span>
            <LeadSubtitle lead={lead} /> · último contato {ago(lead.last_contact_at)}
          </span>
        ) : (
          "Abra a situação para ver as mensagens e quando mandar. Dentro de um lead, o nome da empresa já vem preenchido."
        )
      }
      onClose={onClose}
      wide
    >
      <div className="grid gap-4">
        <input
          placeholder="Buscar situação (ex.: preço, Instagram, pensar)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className={`${input} w-full`}
        />
        {top.length ? (
          <section className="grid gap-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-[color:var(--coral)]">Sugerido agora para este lead</p>
            {top.map((s, i) => item(s, i === 0))}
          </section>
        ) : null}
        {groups.map(({ g, items }) => (
          <section key={g} className="grid gap-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-[color:var(--ink-soft)]">{REPLY_GROUP_LABEL[g]}</p>
            {items.filter((s) => !top.includes(s)).map((s) => item(s, false))}
          </section>
        ))}
        {!groups.length ? <p className="text-sm text-[color:var(--ink-soft)]">Nenhuma situação encontrada.</p> : null}
      </div>
    </Modal>
  );
}
