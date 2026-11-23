"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { InboxItem, OutreachItem } from "@/lib/outreach/store";

/**
 * Disparos de WhatsApp: o Caique gera rascunhos de primeiro contato, edita e APROVA o lote; o GitHub Actions
 * envia até 8 aprovados por hora no horário comercial. Respostas dos leads chegam pelo webhook com um rascunho
 * de resposta, que só sai quando ele clica em "Enviar".
 */

type Data = {
  drafts: OutreachItem[];
  approved: OutreachItem[];
  done: OutreachItem[];
  inbox: InboxItem[];
  counts: Record<string, number>;
  eta: Record<number, string>;
  templates: Record<TplKey, string> & { followups_enabled: boolean };
  defaults: Record<TplKey, string>;
  fields: Record<string, string>;
};

type TplKey = "tpl_cold" | "tpl_followup1" | "tpl_followup2";
const TPL_LABEL: Record<TplKey, string> = {
  tpl_cold: "1º contato",
  tpl_followup1: "Lembrete (3 dias sem resposta)",
  tpl_followup2: "Encerramento (7 dias sem resposta)",
};
const KIND_LABEL: Record<string, string> = { cold: "1º contato", followup1: "lembrete 3º dia", followup2: "encerramento 7º dia", reply: "resposta" };

const fmtEta = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })
    : "—";

const pill =
  "rounded-full border border-[color:var(--line)] px-4 py-2 text-sm font-semibold text-[color:var(--ink-soft)] hover:text-[color:var(--ink)] disabled:opacity-40";
const solid = "rounded-full bg-[color:var(--ink)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40";
const card = "rounded-2xl border border-[color:var(--line)] bg-white/60 p-4";

async function api(body: unknown) {
  const r = await fetch("/api/leads/outreach", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `erro ${r.status}`);
  return j;
}

export default function DisparosPage() {
  const [data, setData] = useState<Data | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [texts, setTexts] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [count, setCount] = useState(8);
  const [tpl, setTpl] = useState<Partial<Record<TplKey, string>>>({});
  const tplOf = (k: TplKey) => tpl[k] ?? data?.templates[k] ?? "";

  const load = useCallback(async () => {
    const r = await fetch("/api/leads/outreach", { cache: "no-store" });
    if (r.ok) setData((await r.json()) as Data);
  }, []);

  useEffect(() => {
    let alive = true;
    Promise.resolve().then(() => {
      if (alive) void load();
    });
    const t = setInterval(() => void load(), 30_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [load]);

  const run = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(label);
    setMsg("");
    try {
      await fn();
      await load();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy("");
    }
  };

  const coldDrafts = useMemo(() => data?.drafts.filter((d) => d.kind === "cold") ?? [], [data]);
  const replyDrafts = useMemo(() => {
    const m = new Map<number, OutreachItem>();
    for (const d of data?.drafts ?? []) if (d.kind === "reply") m.set(d.lead_id, d);
    return m;
  }, [data]);
  const threads = useMemo(() => {
    const m = new Map<number, InboxItem[]>();
    for (const i of data?.inbox ?? []) if (i.lead_id) m.set(i.lead_id, [...(m.get(i.lead_id) ?? []), i]);
    return [...m.entries()];
  }, [data]);

  const toggle = (id: number) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const allSelected = coldDrafts.length > 0 && coldDrafts.every((d) => selected.has(d.id));
  const textOf = (d: OutreachItem) => texts[d.id] ?? d.text;

  const saveEdits = async (ids: number[]) => {
    for (const id of ids) {
      const d = coldDrafts.find((x) => x.id === id);
      if (d && texts[id] !== undefined && texts[id] !== d.text) await api({ action: "edit", id, text: texts[id] });
    }
  };

  const c = data?.counts ?? {};
  return (
    <main className="mx-auto min-h-screen max-w-5xl px-5 py-10 md:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold tracking-[0.2em] text-[color:var(--ink-soft)]">PROSPECÇÃO</p>
          <h1 className="display mt-2 text-4xl md:text-5xl">Disparos</h1>
          <p className="mt-2 max-w-xl text-[color:var(--ink-soft)]">
            Nada sai sem a sua aprovação. Aprovados saem até 8 por hora no horário comercial, 1 min entre cada lead e 30 s entre os balões.
          </p>
        </div>
        <a href="/leads" className={pill}>
          ← Leads
        </a>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          ["Rascunhos", c.draft ?? 0],
          ["Na fila", c.approved ?? 0],
          ["Enviados hoje", c.sent_today ?? 0],
          ["Enviados", c.sent ?? 0],
          ["Falharam", c.failed ?? 0],
        ].map(([label, n]) => (
          <div key={label} className={card}>
            <p className="text-xs font-semibold uppercase tracking-wider text-[color:var(--ink-soft)]">{label}</p>
            <p className="display mt-1 text-3xl">{n}</p>
          </div>
        ))}
      </div>
      {msg && <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-900">{msg}</p>}

      {/* Respostas */}
      <section className="mt-10">
        <h2 className="display text-2xl">Respostas dos leads</h2>
        {!threads.length && <p className="mt-2 text-sm text-[color:var(--ink-soft)]">Ninguém respondeu ainda.</p>}
        <div className="mt-4 grid gap-4">
          {threads.map(([leadId, msgs]) => {
            const draft = replyDrafts.get(leadId);
            const pending = msgs.some((m) => !m.handled && !m.auto);
            return (
              <div key={leadId} className={`${card} ${pending ? "ring-2 ring-violet-300" : ""}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">{msgs[0].lead_name}</p>
                  <span className="text-xs text-[color:var(--ink-soft)]">{pending ? "aguardando resposta" : "respondido"}</span>
                </div>
                <ul className="mt-3 grid gap-1 text-sm">
                  {[...msgs].reverse().map((m) => (
                    <li key={m.id} className="rounded-xl bg-violet-50 px-3 py-2">
                      {m.auto && <span className="mr-1 rounded bg-stone-200 px-1 text-xs font-semibold text-stone-700">automática</span>}“{m.text}”{" "}
                      <span className="text-xs text-[color:var(--ink-soft)]">{new Date(m.received_at).toLocaleString("pt-BR")}</span>
                    </li>
                  ))}
                </ul>
                {draft ? (
                  <div className="mt-3">
                    <textarea
                      className="w-full rounded-xl border border-[color:var(--line)] bg-white p-3 text-sm"
                      rows={3}
                      value={textOf(draft)}
                      onChange={(e) => setTexts((t) => ({ ...t, [draft.id]: e.target.value }))}
                    />
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        className={solid}
                        disabled={!!busy}
                        onClick={() => void run("send", () => api({ action: "send", id: draft.id, text: textOf(draft) }))}
                      >
                        {busy === "send" ? "Enviando…" : "Enviar resposta"}
                      </button>
                      <button className={pill} disabled={!!busy} onClick={() => void run("redraft", () => api({ action: "redraft", leadId }))}>
                        Outro rascunho
                      </button>
                      <button className={pill} disabled={!!busy} onClick={() => void run("cancel", () => api({ action: "cancel", ids: [draft.id] }))}>
                        Vou responder pelo celular
                      </button>
                    </div>
                  </div>
                ) : (
                  pending && (
                    <button className={`${pill} mt-3`} disabled={!!busy} onClick={() => void run("redraft", () => api({ action: "redraft", leadId }))}>
                      Gerar rascunho de resposta
                    </button>
                  )
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Mensagens padrão */}
      <section className="mt-12">
        <h2 className="display text-2xl">Mensagens padrão</h2>
        <p className="mt-1 text-sm text-[color:var(--ink-soft)]">
          Usadas nos rascunhos e nos follow-ups. Balões separados por uma linha “---”. Campos preenchidos sozinhos:{" "}
          {Object.entries(data?.fields ?? {}).map(([k, v]) => (
            <span key={k} className="mr-2 inline-block">
              <code className="rounded bg-white/80 px-1">{k}</code> {v}
            </span>
          ))}
        </p>
        <div className="mt-4 grid gap-4">
          {(Object.keys(TPL_LABEL) as TplKey[]).map((k) => (
            <div key={k} className={card}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold">{TPL_LABEL[k]}</p>
                <button className="text-xs font-semibold text-[color:var(--ink-soft)]" onClick={() => setTpl((t) => ({ ...t, [k]: data?.defaults[k] ?? "" }))}>
                  restaurar padrão
                </button>
              </div>
              <textarea
                className="mt-2 w-full rounded-xl border border-[color:var(--line)] bg-white p-3 text-sm"
                rows={k === "tpl_cold" ? 5 : 3}
                value={tplOf(k)}
                onChange={(e) => setTpl((t) => ({ ...t, [k]: e.target.value }))}
              />
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            className={solid}
            disabled={!!busy || !Object.keys(tpl).length}
            onClick={() =>
              void run("tpl", async () => {
                await api({ action: "saveTemplates", templates: tpl });
                setTpl({});
              })
            }
          >
            Salvar mensagens
          </button>
          <button className={pill} disabled={!!busy} onClick={() => void run("apply", () => api({ action: "applyTemplate" }))}>
            Aplicar 1º contato aos rascunhos
          </button>
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={!!data?.templates.followups_enabled}
              disabled={!!busy}
              onChange={(e) => {
                const on = e.target.checked;
                if (on && !confirm("Ligar o follow-up automático? Quem não responder recebe o lembrete no 3º dia e o encerramento no 7º, com os textos acima.")) return;
                void run("fu", () => api({ action: "saveTemplates", templates: tpl, followups_enabled: on }));
              }}
            />
            Follow-up automático {data?.templates.followups_enabled ? "ligado" : "desligado"}
          </label>
        </div>
      </section>

      {/* Rascunhos de primeiro contato */}
      <section className="mt-12">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="display text-2xl">Primeiro contato: aprovar</h2>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="number"
              min={1}
              max={40}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="w-20 rounded-xl border border-[color:var(--line)] bg-white/70 px-3 py-2 text-sm"
              aria-label="Quantos rascunhos gerar"
            />
            <button className={pill} disabled={!!busy} onClick={() => void run("gen", () => api({ action: "generate", count }))}>
              {busy === "gen" ? "Gerando…" : "Gerar rascunhos"}
            </button>
          </div>
        </div>
        <p className="mt-1 text-sm text-[color:var(--ink-soft)]">
          Próximos leads sem site, por prioridade de nicho. Pergunta de permissão, sem link. Edite o texto se quiser; balões separados por uma linha “---”.
        </p>
        {coldDrafts.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button className={pill} onClick={() => setSelected(allSelected ? new Set() : new Set(coldDrafts.map((d) => d.id)))}>
              {allSelected ? "Desmarcar todos" : "Marcar todos"}
            </button>
            <button
              className={solid}
              disabled={!selected.size || !!busy}
              onClick={() =>
                void run("approve", async () => {
                  const ids = [...selected];
                  await saveEdits(ids);
                  await api({ action: "approve", ids });
                  setSelected(new Set());
                })
              }
            >
              Aprovar {selected.size || ""} para envio
            </button>
            <button
              className={pill}
              disabled={!selected.size || !!busy}
              onClick={() =>
                void run("cancel", async () => {
                  await api({ action: "cancel", ids: [...selected] });
                  setSelected(new Set());
                })
              }
            >
              Descartar selecionados
            </button>
          </div>
        )}
        <div className="mt-4 grid gap-3">
          {coldDrafts.map((d) => (
            <label key={d.id} className={`${card} flex gap-3`}>
              <input type="checkbox" className="mt-1 h-4 w-4" checked={selected.has(d.id)} onChange={() => toggle(d.id)} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">
                  {d.lead_name} <span className="font-normal text-[color:var(--ink-soft)]">· {d.lead_neighborhood ?? "—"} · +{d.lead_whatsapp}</span>
                </p>
                <textarea
                  className="mt-2 w-full rounded-xl border border-[color:var(--line)] bg-white p-3 text-sm"
                  rows={4}
                  value={textOf(d)}
                  onChange={(e) => setTexts((t) => ({ ...t, [d.id]: e.target.value }))}
                />
              </div>
            </label>
          ))}
        </div>
      </section>

      {/* Fila e histórico */}
      <section className="mt-12 grid gap-6 md:grid-cols-2">
        <div>
          <h2 className="display text-2xl">Na fila ({data?.approved.length ?? 0})</h2>
          <ul className="mt-3 grid gap-2 text-sm">
            {data?.approved.map((d) => (
              <li key={d.id} className={`${card} flex flex-wrap items-center justify-between gap-2`}>
                <span className="min-w-0">
                  {d.lead_name}
                  <span className="block text-xs text-[color:var(--ink-soft)]">
                    {KIND_LABEL[d.kind] ?? d.kind} · previsto: {fmtEta(data?.eta[d.id])}
                  </span>
                </span>
                <span className="flex items-center gap-3">
                  <button
                    className="text-xs font-semibold text-emerald-800 disabled:opacity-40"
                    disabled={!!busy}
                    onClick={() => {
                      if (confirm(`Enviar agora para ${d.lead_name}?`)) void run(`now-${d.id}`, () => api({ action: "sendNow", id: d.id }));
                    }}
                  >
                    {busy === `now-${d.id}` ? "enviando…" : "enviar agora"}
                  </button>
                  <button className="text-xs font-semibold text-rose-700 disabled:opacity-40" disabled={!!busy} onClick={() => void run("cancel", () => api({ action: "cancel", ids: [d.id] }))}>
                    tirar da fila
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="display text-2xl">Últimos envios</h2>
          <ul className="mt-3 grid gap-2 text-sm">
            {data?.done.map((d) => (
              <li key={d.id} className={card}>
                <span className={d.status === "sent" ? "text-emerald-800" : "text-rose-800"}>{d.status === "sent" ? "✓" : "✗"}</span> {d.lead_name}
                <span className="text-[color:var(--ink-soft)]">
                  {" "}
                  · {d.sent_at ? new Date(d.sent_at).toLocaleString("pt-BR") : d.error}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}
