"use client";

import { useEffect, type ReactNode } from "react";
import {
  LEAD_INTEREST_LABEL,
  LEAD_STATUS_LABEL,
  type Lead,
  type LeadInterest,
  type LeadStatus,
} from "@/lib/leads/types";

export const STATUS_COLOR: Record<LeadStatus, string> = {
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

export const INTEREST_COLOR: Record<LeadInterest, string> = {
  sim: "bg-emerald-100 text-emerald-900",
  talvez: "bg-amber-100 text-amber-900",
  nao: "bg-rose-100 text-rose-900",
};

export const btn =
  "inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40";
export const btnDark = `${btn} bg-[color:var(--ink)] text-white hover:bg-[color:var(--coral)]`;
export const btnGreen = `${btn} bg-emerald-600 text-white hover:bg-emerald-700`;
export const btnGhost = `${btn} border border-[color:var(--line)] bg-white/70 text-[color:var(--ink)] hover:border-[color:var(--ink)]`;
export const input =
  "rounded-xl border border-[color:var(--line)] bg-white px-3 py-2 text-sm outline-none focus:border-[color:var(--ink)]";

export function StatusBadge({ status }: { status: LeadStatus }) {
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_COLOR[status]}`}>
      {LEAD_STATUS_LABEL[status]}
    </span>
  );
}

export function InterestBadge({ interest }: { interest: LeadInterest | null }) {
  if (!interest) return <span className="text-xs text-[color:var(--ink-soft)]">—</span>;
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${INTEREST_COLOR[interest]}`}>
      {LEAD_INTEREST_LABEL[interest]}
    </span>
  );
}

/** "hoje", "ontem", "há 5 dias", "nunca". */
export function ago(iso: string | null): string {
  if (!iso) return "nunca";
  const d = new Date(iso);
  const today = new Date();
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOf(today) - startOf(d)) / 86_400_000);
  if (days <= 0) return `hoje, ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
  if (days === 1) return "ontem";
  if (days < 30) return `há ${days} dias`;
  return d.toLocaleDateString("pt-BR");
}

export function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

export function isToday(iso: string | null) {
  if (!iso) return false;
  return new Date(iso).toDateString() === new Date().toDateString();
}

export function waLink(lead: Lead, text?: string) {
  if (!lead.whatsapp) return null;
  return `https://wa.me/${lead.whatsapp}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

export function Modal({
  title,
  subtitle,
  onClose,
  children,
  wide,
}: {
  title: string;
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl bg-[color:var(--bg)] shadow-2xl sm:rounded-3xl ${
          wide ? "sm:max-w-3xl" : "sm:max-w-xl"
        }`}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[color:var(--line)] px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold">{title}</h2>
            {subtitle ? <div className="mt-0.5 text-xs text-[color:var(--ink-soft)]">{subtitle}</div> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="-mr-1 rounded-full px-2.5 py-1 text-xl leading-none text-[color:var(--ink-soft)] hover:bg-black/5 hover:text-[color:var(--ink)]"
          >
            ×
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

/** Balão no estilo WhatsApp (mensagem enviada). */
export function Bubble({ text, side = "out", meta }: { text: string; side?: "out" | "in"; meta?: string }) {
  return (
    <div className={`flex ${side === "out" ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[88%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm leading-relaxed shadow-sm ${
          side === "out" ? "rounded-tr-md bg-[#d9fdd3] text-[#111b21]" : "rounded-tl-md bg-white text-[#111b21]"
        }`}
      >
        {text}
        {meta ? <p className="mt-1 text-right text-[10px] text-black/45">{meta}</p> : null}
      </div>
    </div>
  );
}
