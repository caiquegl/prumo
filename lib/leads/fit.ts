import type { Lead } from "./types";

/**
 * "Chance de fechar" (0–100): ordena a tabela /leads por quem está mais perto de receber a proposta e fechar.
 * Pesos calibrados com o que aconteceu até 2026-11-24 (104 leads abordados):
 * - os 4 que responderam com interesse tinham nota 5,0 e 15–102 avaliações (negócio pequeno, dono atende);
 * - fisio (1 de 9) e buffets (1 de 12) respondem melhor; estética 1/23, automotiva 1/22;
 *   odonto 0 de 14 com 2 recusas (clínicas maiores, já investem em marketing);
 * - quem já respondeu ou mostrou interesse vale mais que qualquer lead frio.
 * Ajuste os números aqui quando houver mais respostas. Puro, roda no cliente.
 */
export type FitPart = { label: string; points: number; max: number; why: string };
export type Fit = { score: number; tier: "alta" | "media" | "baixa" | "fora"; parts: FitPart[]; note?: string };

const NICHE_POINTS: Record<string, [number, string]> = {
  fisio: [15, "fisioterapia: melhor taxa de resposta (1 de 9)"],
  eventos: [13, "buffets/festas: boa resposta (1 de 12)"],
  estetica: [11, "estética: 1 de 23 respondeu"],
  auto: [10, "estética automotiva: 1 de 22, 3 recusas"],
  desentupidora: [9, "serviço de urgência: cliente busca no Google"],
  vidracaria: [9, "serviço de orçamento: cliente busca no Google"],
  marmoraria: [9, "serviço de orçamento: cliente busca no Google"],
  solar: [8, "ainda sem resposta no nicho"],
  piscinas: [8, "ainda sem resposta no nicho"],
  arquitetura: [8, "ainda sem resposta no nicho (1 recusa)"],
  escolas: [8, "poucos abordados ainda"],
  odonto: [6, "odonto: 0 de 14 com interesse, 2 recusas"],
};

function daysSince(iso: string | null) {
  return iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000) : null;
}

function stagePoints(lead: Lead): [number, string] {
  const d = daysSince(lead.last_contact_at);
  if (lead.interest === "sim") return [35, "disse que tem interesse"];
  if (lead.interest === "talvez") return [25, "está pensando"];
  switch (lead.status) {
    case "respondeu":
      return [28, "respondeu a mensagem"];
    case "publicado":
      return [16, "demo pronta, ainda não abordado"];
    case "sem_site":
    case "criando":
      return [12, "ainda não abordado"];
    case "abordado":
      if (d != null && d <= 3) return [12, `abordado há ${d} dia(s), aguardando`];
      if (d != null && d <= 10) return [8, `abordado há ${d} dias sem resposta`];
      return [3, `abordado há ${d ?? "?"} dias sem resposta`];
    case "sem_resposta":
      return [2, "não respondeu nem ao lembrete"];
    default:
      return [0, ""];
  }
}

function ratingPoints(r: number | null): [number, string] {
  if (r == null) return [0, "sem nota no Google"];
  const t = r.toFixed(1).replace(".", ",");
  if (r >= 4.95) return [15, `nota ${t}: igual a todos que responderam`];
  if (r >= 4.8) return [12, `nota ${t}`];
  if (r >= 4.5) return [8, `nota ${t}`];
  if (r >= 4.0) return [4, `nota ${t}`];
  return [0, `nota ${t}: baixa`];
}

function reviewsPoints(n: number | null): [number, string] {
  const v = n ?? 0;
  if (v >= 15 && v <= 150) return [10, `${v} avaliações: negócio do porte que responde`];
  if ((v >= 8 && v < 15) || (v > 150 && v <= 400)) return [6, `${v} avaliações`];
  if (v > 400) return [3, `${v} avaliações: negócio grande, costuma ter agência`];
  return [1, `${v} avaliações: pouco movimento`];
}

export function leadFit(lead: Lead): Fit {
  if (lead.status === "aceitou") return { score: 0, tier: "fora", parts: [], note: "já fechou" };
  if (lead.status === "recusou" || lead.status === "descartado" || lead.interest === "nao") {
    return { score: 0, tier: "fora", parts: [], note: lead.status === "descartado" ? "descartado" : "sem interesse" };
  }

  const [stage, stageWhy] = stagePoints(lead);
  const [rating, ratingWhy] = ratingPoints(lead.rating);
  const [reviews, reviewsWhy] = reviewsPoints(lead.reviews_count);
  const [niche, nicheWhy] = (lead.niche && NICHE_POINTS[lead.niche]) || [5, "fora dos nichos prioritários"];
  const contact = (lead.whatsapp ? 12 : 0) + (lead.instagram ? 3 : 0);
  const contactWhy = [lead.whatsapp ? "WhatsApp de celular" : "sem WhatsApp", lead.instagram ? "Instagram ativo" : null]
    .filter(Boolean)
    .join(" + ");
  const ready = lead.demo_url ? 5 : 0;

  const parts: FitPart[] = [
    { label: "Momento", points: stage, max: 35, why: stageWhy },
    { label: "Nota", points: rating, max: 15, why: ratingWhy },
    { label: "Avaliações", points: reviews, max: 10, why: reviewsWhy },
    { label: "Nicho", points: niche, max: 15, why: nicheWhy },
    { label: "Contato", points: contact, max: 15, why: contactWhy },
    { label: "Demo", points: ready, max: 5, why: lead.demo_url ? "demo pronta para mostrar" : "sem demo ainda" },
  ];
  const score = Math.min(100, parts.reduce((a, p) => a + p.points, 0));
  return { score, tier: score >= 75 ? "alta" : score >= 60 ? "media" : "baixa", parts };
}

export const FIT_EXPLAINER = [
  "Momento no funil (até 35): tem interesse 35 · respondeu 28 · talvez 25 · demo pronta 16 · não abordado 12 · abordado há ≤3 dias 12, até 10 dias 8, mais que isso 3 · não respondeu ao lembrete 2.",
  "Nota no Google (até 15): 5,0 = 15 (todos os 4 que responderam tinham 5,0) · 4,8+ = 12 · 4,5+ = 8 · 4,0+ = 4.",
  "Avaliações (até 10): 15 a 150 = 10 (porte dos que responderam) · 8–14 ou 151–400 = 6 · mais de 400 = 3 (negócio grande) · menos de 8 = 1.",
  "Nicho (até 15), pela taxa de resposta: fisio 15 · buffets 13 · estética 11 · automotiva 10 · urgência/orçamento 9 · solar, piscinas, arquitetura, escolas 8 · odonto 6 (0 de 14) · outros 5.",
  "Contato (até 15): WhatsApp de celular 12 + Instagram 3.",
  "Demo pronta (até 5).",
  "Recusou, descartado ou sem interesse ficam no fim; quem já fechou também.",
];
