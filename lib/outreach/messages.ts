import type { Lead } from "@/lib/leads/types";

/**
 * Textos da automação de WhatsApp.
 * - Primeiro contato ("cold"): pergunta de permissão curta, SEM link e SEM demo pronta (a demo só é montada
 *   para quem disser sim). Formato escolhido pelo Caique após 52 leads com 3 respostas (2026-11-23).
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

function nota(lead: Pick<Lead, "rating" | "reviews_count">): string {
  if (!lead.rating || !lead.reviews_count || lead.rating < 4.5) return "";
  const r = lead.rating.toFixed(1).replace(".", ",");
  return lead.reviews_count >= 10 ? ` (nota ${r} com ${lead.reviews_count} avaliações, parabéns!)` : ` (nota ${r}, parabéns!)`;
}

/** Pergunta de permissão: sem link, sem afirmar que a demo já existe. */
export function coldMessage(lead: Pick<Lead, "name" | "rating" | "reviews_count">): string {
  const name = shortName(lead.name);
  return [
    `Oi, tudo bem? Encontrei vocês no Google, ${name}${nota(lead)}, e vi que ainda não têm um site.`,
    `Sou o Caique, da Web Prumo, e faço páginas para negócios da região aparecerem melhor para quem procura no Google. Posso montar uma ideia de como ficaria a de vocês, sem compromisso. Querem ver?`,
  ].join("\n---\n");
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
