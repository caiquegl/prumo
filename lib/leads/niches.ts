/**
 * Nichos prioritários da prospecção (ordem = prioridade, definida pelo Caique).
 * Ticket mais alto e cliente que decide pela confiança/visual → landing page vende bem.
 * `match` testa a categoria do Google (ou o termo de busca); a ORDEM do array importa
 * para desempate (ex.: "estética automotiva" antes de "estética").
 */
export type Niche = {
  id: string;
  label: string;
  rank: number;
  /** Termos de busca no Google Maps (o primeiro é o padrão do formulário) */
  queries: string[];
  match: RegExp;
};

const LIST: Array<Omit<Niche, "rank">> = [
  {
    id: "odonto",
    label: "Clínicas odontológicas",
    queries: ["clínica odontológica", "dentista", "implante dentário"],
    match: /odont|dentist|dentári|ortodont|endodont|periodont/i,
  },
  {
    id: "estetica",
    label: "Clínicas de estética e dermatologia",
    queries: ["clínica de estética", "dermatologista", "harmonização facial"],
    match: /dermat|harmoniza|biomedic|est[eé]tic|depila[cç][aã]o a laser|\bspa\b/i,
  },
  {
    id: "solar",
    label: "Empresas de energia solar",
    queries: ["energia solar", "instalação de painel solar"],
    match: /solar|fotovolt/i,
  },
  {
    id: "auto",
    label: "Estética automotiva",
    queries: ["estética automotiva", "vitrificação automotiva"],
    match: /est[eé]tica automotiva|detalhamento|vitrifica|polimento|detailing|envelopamento|lava.?(r[aá]pido|car|jato)|car wash|insulfilm|martelinho/i,
  },
  {
    id: "eventos",
    label: "Espaços de eventos e buffets",
    queries: ["buffet infantil", "espaço para eventos", "buffet para casamento"],
    match: /buffet|evento|festa|recep[cç][oõ]|casamento/i,
  },
  {
    id: "piscinas",
    label: "Construção de piscinas e reformas",
    queries: ["construção de piscinas", "empresa de reformas"],
    match: /piscina|reforma|empreiteir|constru[cç]|constru(tora|tor)|pedreir|acabamento/i,
  },
  {
    id: "fisio",
    label: "Clínicas de fisioterapia e reabilitação",
    queries: ["clínica de fisioterapia", "reabilitação", "pilates clínico"],
    match: /fisio|reabilita|osteopat|quiropra|pilates|acupunt/i,
  },
  {
    id: "escolas",
    label: "Escolas particulares e cursos",
    queries: ["escola particular", "curso de idiomas", "curso profissionalizante"],
    match: /escola|col[eé]gio|curso|idioma|ingl[eê]s|ensino|educa|creche|ber[cç][aá]rio|refor[cç]o escolar|treinamento/i,
  },
  {
    id: "arquitetura",
    label: "Arquitetos e escritórios de arquitetura",
    queries: ["escritório de arquitetura", "arquiteto", "design de interiores"],
    match: /arquitet|design(er)? de interiores|interiores|paisagis/i,
  },
  // Urgência e obras (2026-11-23): cliente pesquisa no Google na hora da necessidade e compara orçamento.
  {
    id: "desentupidora",
    label: "Desentupidoras",
    queries: ["desentupidora"],
    match: /desentup|hidrojat|limpa.?fossa|esgoto|encanador/i,
  },
  {
    id: "vidracaria",
    label: "Vidraçarias",
    queries: ["vidraçaria"],
    match: /vidra[cç]|vidro|box para banheiro|espelho/i,
  },
  {
    id: "marmoraria",
    label: "Marmorarias",
    queries: ["marmoraria"],
    match: /marmor|m[aá]rmore|granito|quartzo/i,
  },
];

export const NICHES: Niche[] = LIST.map((n, i) => ({ ...n, rank: i + 1 }));

export const NICHE_BY_ID: Record<string, Niche> = Object.fromEntries(NICHES.map((n) => [n.id, n]));

/** Ordem de teste: automotiva antes de estética (as duas casam "estética"). */
const MATCH_ORDER = ["auto", "odonto", "fisio", "estetica", "solar", "eventos", "desentupidora", "vidracaria", "marmoraria", "piscinas", "escolas", "arquitetura"];

/** Classifica pela categoria do Google; se não casar, pelo termo usado na busca. */
export function classifyNiche(category?: string | null, searchQuery?: string | null): Niche | null {
  for (const text of [category, searchQuery]) {
    if (!text) continue;
    for (const id of MATCH_ORDER) {
      const n = NICHE_BY_ID[id]!;
      if (n.match.test(text)) return n;
    }
  }
  return null;
}

/** Regiões padrão da Grande SP para coleta em lote. */
export const DEFAULT_AREAS = [
  "Tatuapé, São Paulo",
  "Santana, São Paulo",
  "Santo André, SP",
  "Osasco, SP",
  "Vila Mariana, São Paulo",
  "Guarulhos, SP",
];
