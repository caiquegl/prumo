import type { Lead } from "@/lib/leads/types";

/**
 * Textos da automação de WhatsApp.
 * - Primeiro contato ("cold"): a busca que o cliente do negócio faria no Google + pergunta de permissão, SEM link e
 *   SEM demo pronta (a demo só é montada para quem disser sim). Escolhido pelo Caique em 2026-11-23.
 * - Resposta ("reply"): rascunho gerado pelo Gemini a partir do lead e da conversa; o Caique aprova/edita no
 *   painel antes de sair. Nunca inventa preço, prazo ou promessa que não esteja nas regras abaixo.
 */

/** "Bazílio e Gaeta | Sorriso Integral | Aparelho" → "Bazílio e Gaeta"; "Haruo Studio Detail - Estética" → "Haruo Studio Detail". */
export function shortName(name: string): string {
  let n = name.split(/\s[|•·]\s|\s[-–—]\s/)[0].trim();
  if (n === n.toUpperCase() && /[A-ZÀ-Ú]{3}/.test(n)) {
    n = n
      .split(/\s+/)
      .map((w) => (w.length <= 3 ? w : w[0] + w.slice(1).toLowerCase()))
      .join(" ");
  }
  return n.length > 42 ? n.slice(0, 42).replace(/\s\S*$/, "") : n;
}

/** O que o cliente do negócio digitaria no Google, por nicho (lib/leads/niches.ts). */
const SEARCH_TERM: Record<string, string> = {
  odonto: "dentista",
  estetica: "clínica de estética",
  solar: "energia solar",
  auto: "estética automotiva",
  eventos: "buffet infantil",
  piscinas: "reforma de piscina",
  fisio: "fisioterapia",
  escolas: "escola particular",
  arquitetura: "arquiteto",
  desentupidora: "desentupidora",
  vidracaria: "vidraçaria",
  marmoraria: "marmoraria",
};

/** O que o cliente quer fazer depois de conhecer o negócio. */
const NEXT_STEP: Record<string, string> = {
  odonto: "agendar",
  estetica: "agendar",
  fisio: "agendar",
  solar: "pedir um orçamento",
  piscinas: "pedir um orçamento",
  arquitetura: "pedir um orçamento",
  auto: "levar o carro",
  eventos: "fechar a festa",
  escolas: "visitar a escola",
  desentupidora: "chamar",
  vidracaria: "pedir um orçamento",
  marmoraria: "pedir um orçamento",
};

const ACCENTS: Record<string, string> = { Japao: "Japão", Tatuape: "Tatuapé", Assuncao: "Assunção", Sao: "São", Joao: "João", Conceicao: "Conceição" };

function fixAccents(place: string) {
  return place.replace(/\p{L}+/gu, (w) => ACCENTS[w] ?? w);
}

/** "na Penha", "no Tatuapé", "em São Bernardo do Campo". */
export function withPreposition(place: string): string {
  const p = fixAccents(place.trim());
  const first = p.split(/\s+/)[0].toLowerCase();
  const fem = ["vila", "penha", "mooca", "aclimação", "liberdade", "lapa", "freguesia", "casa", "cidade", "chácara", "saúde"];
  const masc = ["jardim", "parque", "tatuapé", "ipiranga", "centro", "brás", "belém", "bairro", "cambuci", "campestre", "recreio", "alto", "butantã", "morumbi", "sacomã", "carrão"];
  if (fem.includes(first)) return `na ${p}`;
  if (masc.includes(first)) return `no ${p}`;
  return `em ${p}`;
}

function searchTerm(lead: Pick<Lead, "niche" | "category">): string {
  if (lead.niche && SEARCH_TERM[lead.niche]) return SEARCH_TERM[lead.niche];
  return (lead.category ?? "").toLowerCase().replace(/^serviço de /, "") || "empresa";
}

/** Campos que o Caique pode usar nos modelos editáveis do painel. */
export const TEMPLATE_FIELDS: Record<string, string> = {
  "{nome}": "nome curto da empresa",
  "{busca}": "o que o cliente pesquisa + bairro (ex.: dentista na Penha)",
  "{nota}": "\" com nota 5,0 👏\" quando a nota é 4,5 ou mais; vazio se não",
  "{acao}": "o que o cliente faz depois (agendar, pedir um orçamento, fechar a festa…)",
  "{bairro}": "bairro ou cidade",
};

/** Modelos padrão (o painel /leads/disparos sobrescreve; balões separados por uma linha "---"). */
export const DEFAULT_TEMPLATES = {
  tpl_cold:
    "Oi, tudo bem? Pesquisei “{busca}” no Google e a {nome} apareceu{nota}, mas sem um site pra quem quer conhecer melhor vocês antes de {acao}.\n---\nSou o Caique, da Web Prumo. Posso montar, sem compromisso, uma ideia de como ficaria a página de vocês e te mostrar por aqui. Topa?",
  tpl_followup1:
    "Oi! Passando só pra saber se viu minha mensagem 🙂 Se quiser, monto a página da {nome} e você só dá uma olhada, sem compromisso.",
  tpl_followup2:
    "Vou encerrar por aqui pra não incomodar. Se um dia quiser ver como ficaria a página da {nome}, é só me chamar. Sucesso! 🙂",
} as const;
export type TemplateKey = keyof typeof DEFAULT_TEMPLATES;

type TplLead = Pick<Lead, "name" | "rating" | "niche" | "category" | "neighborhood" | "city">;

function placeOf(lead: TplLead): string {
  const city = (lead.city ?? "").split(",")[0].trim();
  let place = lead.neighborhood || city;
  if (/^centro$/i.test(place) && city) place = `Centro de ${city}`;
  return fixAccents(place);
}

/** Preenche {nome}, {busca}, {nota}, {acao}, {bairro}. */
export function renderTemplate(tpl: string, lead: TplLead): string {
  const place = placeOf(lead);
  const fields: Record<string, string> = {
    "{nome}": shortName(lead.name),
    "{busca}": place ? `${searchTerm(lead)} ${withPreposition(place)}` : searchTerm(lead),
    "{nota}": lead.rating && lead.rating >= 4.5 ? ` com nota ${lead.rating.toFixed(1).replace(".", ",")} 👏` : "",
    "{acao}": (lead.niche && NEXT_STEP[lead.niche]) || "entrar em contato",
    "{bairro}": place,
  };
  return tpl.replace(/\{(nome|busca|nota|acao|bairro)\}/g, (m) => fields[m] ?? m).trim();
}

/** Primeiro contato com o modelo padrão (o runner/painel usam o modelo salvo em outreach_settings). */
export function coldMessage(lead: TplLead, tpl: string = DEFAULT_TEMPLATES.tpl_cold): string {
  return renderTemplate(tpl, lead);
}

const MODELS = [process.env.GEMINI_MODEL, "gemini-flash-latest", "gemini-flash-lite-latest"].filter(Boolean) as string[];

const RULES = `Você escreve, em nome do Caique (Web Prumo, desenvolvedor web em São Paulo), a PRÓXIMA mensagem de WhatsApp para um pequeno negócio local que respondeu a um primeiro contato.
Contexto do serviço: o Caique faz landing pages (site de uma página) com a identidade do negócio, para aparecer melhor no Google e levar o cliente direto para o WhatsApp. Ele monta uma demonstração gratuita antes de qualquer compromisso.
Regras:
- Português do Brasil, tom natural de conversa, curto (1 a 3 frases), no máximo 1 emoji. Nada de textão nem cara de robô.
- Nunca invente preço, prazo, desconto, resultado garantido, nome de cliente ou dado do negócio. Se perguntarem preço, diga que depende do que precisam e que o Caique manda a proposta certinha (sem citar valor).
- Se a pessoa disse sim / quer ver: agradeça e diga que vai montar a demonstração com as informações públicas deles e manda o link em breve (não mande link nenhum agora).
- Se perguntarem quem é / como achou: explique que encontrou o negócio no Google procurando empresas do bairro sem site.
- Se disserem que não têm interesse, já têm site, ou pedirem para não mandar mais: agradeça com educação, deseje sucesso e encerre, sem insistir.
- Se fizerem uma pergunta que você não sabe responder com certeza, diga que o Caique já responde e não invente.
- Não se apresente como IA nem como assistente; escreva como o próprio Caique. Não use markdown.
Responda SOMENTE com o texto da mensagem.`;

export async function draftReply(input: {
  lead: Pick<Lead, "name" | "category" | "neighborhood" | "rating" | "demo_url" | "status">;
  history: Array<{ from: "lead" | "caique"; text: string }>;
}): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY ausente");
  const { lead, history } = input;
  const convo = history.map((m) => `${m.from === "lead" ? "Negócio" : "Caique"}: ${m.text.replace(/\n---\n/g, " ")}`).join("\n");
  const prompt = `${RULES}

Negócio: ${shortName(lead.name)} (${lead.category ?? "negócio local"}${lead.neighborhood ? `, ${lead.neighborhood}` : ""}).
${lead.demo_url ? `Já existe uma demonstração publicada: ${lead.demo_url} (pode citar se fizer sentido).` : "Ainda NÃO existe demonstração pronta."}

Conversa até agora:
${convo}

Próxima mensagem do Caique:`;

  let lastErr = "";
  for (const model of MODELS) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { temperature: 0.6, maxOutputTokens: 300 } }),
        signal: AbortSignal.timeout(25_000),
      },
    ).catch((e: Error) => ({ ok: false, status: 0, json: async () => ({ error: { message: e.message } }) }) as unknown as Response);
    const json = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>; error?: { message?: string } };
    const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim();
    if (res.ok && text) return text.replace(/^["“]|["”]$/g, "").trim();
    lastErr = `${model}: ${json.error?.message ?? res.status}`;
  }
  throw new Error(`Gemini falhou (${lastErr})`);
}
