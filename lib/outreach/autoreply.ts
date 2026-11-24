/**
 * Detecta respostas automáticas (saudação/ausência do WhatsApp Business, chatbots e agentes de IA de agências)
 * para não virarem "lead respondeu" nem aviso no WhatsApp pessoal. Calibrado com o que chegou em 2026-11-23/24.
 */
export const AUTO_PATTERNS: RegExp[] = [
  /mensagem autom[aá]tica|resposta autom[aá]tica/i,
  /(agradecemos|obrigad[oa]) (pelo|por entrar em|pelo seu|por) (seu )?contato/i,
  /agradece (o |a )?(seu |sua )?(contato|mensagem)/i,
  /em breve (retornaremos|responderemos|entraremos|daremos retorno|te respond)/i,
  /(retornaremos|responderemos|respondo|retorno|vou conversar|te atendo)[^.!?\n]{0,40}(o mais breve|em breve|assim que)/i,
  /assim que (poss[ií]vel|estiver dispon[ií]vel|puder)/i,
  /(nosso |o )?hor[aá]rio de atendimento/i,
  /no momento (n[aã]o (estamos|podemos|consigo)|estamos (fora|ausentes|em atendimento))/i,
  /n[aã]o estamos dispon[ií]veis/i,
  /(nesse|neste) momento (estou|estamos) (com|em|atendendo)/i,
  /fora do (nosso )?hor[aá]rio/i,
  /bem[- ]?vind[oa]s?(\([oa]\))?(\s*\([oa]\))? (a|à|ao|na|no)\b/i,
  /seja (muito )?bem[- ]?vind/i,
  /como (podemos|posso) (te |lhe )?ajud/i,
  /em que (podemos|posso) (te |lhe )?ajud/i,
  /escolha (uma|a) op[cç][aã]o|digite (o n[uú]mero|\d)|^\s*1\s*[-–).]/im,
  /prazer (em )?receb[eê]-?l/i,
  /data de nascimento/i,
  /como (gostaria|prefere) de ser chamad/i,
  /(dizer|informar|deixe|me diga) (o |\*?seu )?\*?nome/i,
  /(dar continuidade|para (iniciarmos|prosseguirmos|darmos continuidade|agilizar))/i,
  /assistente (virtual|digital)|sou (a|o) assistente/i,
  /te conectei com (a )?nossa equipe/i,
  /qual (de nossas unidades|procedimento|seu principal objetivo|servi[cç]o)/i,
  /que bom que (nos )?(achou|encontrou)/i,
];

/** Tipos de mensagem que não são conversa (reação, edição, enquete…): não avisam nem mudam status. */
export const IGNORED_TYPES = new Set([
  "reactionMessage",
  "protocolMessage",
  "editedMessage",
  "pollUpdateMessage",
  "senderKeyDistributionMessage",
  "messageContextInfo",
  "keepInChatMessage",
]);

export function looksAutomatic(
  text: string,
  receivedAt: Date,
  lastOut: Date | null,
  prevInbound: { at: Date; auto: boolean } | null,
): boolean {
  if (AUTO_PATTERNS.some((r) => r.test(text))) return true;
  // bots respondem segundos depois da nossa mensagem (pela automação ou pelo celular)
  if (lastOut && receivedAt.getTime() - lastOut.getTime() < 90_000 && receivedAt >= lastOut && text.length > 60) return true;
  // rajada: robô manda a 2ª/3ª mensagem em 0–6 s; gente que responde depois do robô levou 40 s ou mais
  if (prevInbound?.auto && receivedAt.getTime() - prevInbound.at.getTime() < 12_000) return true;
  return false;
}
