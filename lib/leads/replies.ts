import type { Lead } from "./types";

/**
 * Respostas prontas para a conversa manual no celular (painel /leads → "Respostas").
 * Só fatos reais da oferta (proposta comercial): R$ 400 à vista no Pix ou 4x R$ 100, 2 rodadas de ajuste,
 * 3 alterações pequenas em 30 dias, domínio configurado, hospedagem 12 meses, HTTPS, SEO básico, até 7 dias úteis.
 * Campos: {nome} {link} {bairro} {busca} {acao} (renderTemplate). Nunca prometer resultado garantido.
 */
export type ReplySituation = {
  id: string;
  /** O que aconteceu na conversa. */
  title: string;
  group: "preco" | "objecao" | "duvida" | "silencio" | "fechamento";
  /** Quando mandar (em relação à última mensagem do cliente). */
  when: string;
  /** Dias depois do último contato para mandar; null = responder na hora. */
  waitDays: number | null;
  tip?: string;
  options: string[];
};

export const REPLY_GROUP_LABEL: Record<ReplySituation["group"], string> = {
  silencio: "Cliente parou de responder",
  preco: "Preço e pagamento",
  objecao: "Objeções",
  duvida: "Dúvidas",
  fechamento: "Fechamento",
};

export const REPLY_SITUATIONS: ReplySituation[] = [
  // ---------------- silêncio
  {
    id: "sem-resposta-1",
    group: "silencio",
    title: "Não respondeu a primeira mensagem",
    when: "3 dias depois da 1ª mensagem (de manhã, no início do expediente). Se não responder de novo, espere mais 4 dias e mande o encerramento.",
    waitDays: 3,
    options: [
      "Oi! Passando só pra saber se viu minha mensagem 🙂 Se quiser, monto a página da {nome} e você só dá uma olhada, sem compromisso.",
      "Oi, tudo bem? Sei que a rotina é corrida! Ficou alguma dúvida sobre a página da {nome}? Posso te mostrar como ficaria, sem compromisso.",
    ],
  },
  {
    id: "perguntou-preco-sumiu",
    group: "silencio",
    title: "Perguntou o preço, mostrou interesse e parou de responder",
    when: "2 dias úteis depois da última mensagem dele. Se continuar sem resposta, mais um toque 5 dias depois e então o encerramento.",
    waitDays: 2,
    tip: "Não baixe o preço no lembrete. Lembre o que está incluso e facilite o próximo passo (uma pergunta de sim/não).",
    options: [
      "Oi! Conseguiu ver os valores? Lembrando que nos R$ 400 já vai a hospedagem de 12 meses, domínio configurado e 2 rodadas de ajuste. Se ficou alguma dúvida, me fala que eu explico 🙂",
      "Oi, tudo bem? Fiquei pensando na página da {nome}: se fizer sentido, consigo começar essa semana e entregar em até 7 dias úteis. Quer que eu reserve um horário pra você?",
      "Oi! Só pra não deixar no vácuo: se o momento não for agora, sem problema nenhum. Quer que eu te chame de novo mais pra frente?",
    ],
  },
  {
    id: "viu-demo-sumiu",
    group: "silencio",
    title: "Viu a demo e não falou nada",
    when: "1 a 2 dias depois de mandar o link (a pessoa pode não ter aberto ainda).",
    waitDays: 1,
    options: [
      "Oi! Conseguiu abrir a página que eu montei pra {nome}? Queria muito saber o que achou 🙂",
      "Oi, tudo bem? O que achou da demonstração? Se quiser mudar alguma coisa (cores, fotos, textos), é só falar que eu ajusto.",
    ],
  },
  {
    id: "encerramento",
    group: "silencio",
    title: "Já mandei lembrete e continua sem resposta (encerrar)",
    when: "4 a 5 dias depois do último lembrete. Depois disso, marque como \"Não respondeu\" e não insista.",
    waitDays: 4,
    options: [
      "Vou encerrar por aqui pra não incomodar. Se um dia quiser ver como ficaria a página da {nome}, é só me chamar. Sucesso! 🙂",
      "Oi! Não quero ficar enchendo sua caixa de mensagens 😅 Vou deixar a proposta guardada; se mudar de ideia, é só me chamar por aqui. Abraço!",
    ],
  },
  // ---------------- preço
  {
    id: "quanto-custa",
    group: "preco",
    title: "Perguntou quanto custa",
    when: "Na hora. Responda com o valor e o que está incluso, e termine com uma pergunta.",
    waitDays: null,
    options: [
      "A página sai por R$ 400 à vista no Pix ou 4x de R$ 100 sem juros. Já inclui: hospedagem por 12 meses, configuração do domínio, HTTPS, SEO básico pra aparecer no Google, 2 rodadas de ajuste antes de publicar e 3 alterações pequenas nos 30 dias depois. Quer que eu te mande a proposta completa?",
      "R$ 400 (ou 4x de R$ 100). É pagamento único: a hospedagem do primeiro ano já vai junto. Entrego em até 7 dias úteis depois de receber as informações. Faz sentido pra vocês?",
    ],
  },
  {
    id: "mensalidade",
    group: "preco",
    title: "Perguntou se tem mensalidade",
    when: "Na hora.",
    waitDays: null,
    options: [
      "Não tem mensalidade no primeiro ano: a hospedagem de 12 meses já está inclusa nos R$ 400. Depois disso fica R$ 20 por mês ou R$ 200 por ano, só pra manter o site no ar. O domínio (www) é renovado direto na conta de vocês.",
    ],
  },
  {
    id: "esta-caro",
    group: "preco",
    title: "Achou caro / pediu desconto",
    when: "Na hora, sem pressa e sem baixar o valor de cara.",
    waitDays: null,
    tip: "Mostre o parcelamento e compare com um cliente a mais. Se quiser negociar, prefira tirar algo do escopo em vez de dar desconto.",
    options: [
      "Entendo! Dá pra fazer em 4x de R$ 100 sem juros, se ajudar. E pensa assim: se a página trouxer um cliente novo que te achou no Google, ela já se pagou. Quer que eu comece?",
      "Super entendo. O valor já inclui o primeiro ano de hospedagem e os ajustes, então não tem custo escondido depois. Se ficar mais confortável, a gente divide em 4x de R$ 100.",
    ],
  },
  {
    id: "como-pagar",
    group: "preco",
    title: "Perguntou como paga",
    when: "Na hora.",
    waitDays: null,
    options: [
      "Pode ser R$ 400 no Pix ou 4x de R$ 100 sem juros (a 1ª parcela na aprovação). Assim que confirmar, te peço as informações e fotos e em até 7 dias úteis a página está no ar.",
    ],
  },
  // ---------------- dúvidas
  {
    id: "por-que-fechar",
    group: "duvida",
    title: "Perguntou por que deveria fechar com você",
    when: "Na hora. Seja concreto e pessoal, sem atacar concorrente.",
    waitDays: null,
    options: [
      "Porque eu já montei a página da {nome} antes de você pagar qualquer coisa: você vê exatamente como vai ficar. É feita com a identidade de vocês (logo, cores, avaliações reais), não um modelo genérico. E é pagamento único, com hospedagem do 1º ano e ajustes inclusos, falando direto comigo.",
      "Três motivos: 1) você já viu o resultado antes de decidir; 2) preço fechado, sem mensalidade no primeiro ano; 3) atendimento direto comigo pelo WhatsApp, sem agência no meio. Quer que eu deixe a sua no ar?",
    ],
  },
  {
    id: "vantagens-single-page",
    group: "duvida",
    title: "Perguntou quais as vantagens de ter uma página (single page)",
    when: "Na hora.",
    waitDays: null,
    options: [
      "A página reúne tudo que o cliente quer saber em um lugar só: serviços, fotos, avaliações do Google, endereço e um botão que já abre o WhatsApp de vocês. Ela carrega rápido no celular, ajuda a aparecer quando alguém pesquisa “{busca}” e passa mais confiança do que só o Instagram.",
      "Pensa nela como o cartão de visita de vocês no Google: quem pesquisa encontra tudo de forma organizada e já chama no WhatsApp pra {acao}. Como é uma página só, é rápida, fácil de manter e sai bem mais em conta que um site grande.",
    ],
  },
  {
    id: "ja-tenho-instagram",
    group: "objecao",
    title: "Disse que já tem Instagram / Google e não precisa de site",
    when: "Na hora. Concorde primeiro, depois mostre o complemento.",
    waitDays: null,
    options: [
      "Faz total sentido, o Instagram de vocês é ótimo! A página não substitui: ela complementa. Muita gente pesquisa no Google antes de {acao} e nem todo mundo usa Instagram. A página junta as avaliações, os serviços e o WhatsApp num link só, que você pode até colocar na bio.",
    ],
  },
  {
    id: "ja-tive-site",
    group: "objecao",
    title: "Disse que já teve site e não deu resultado",
    when: "Na hora. Respeite a experiência dele; não insista se ele não quiser.",
    waitDays: null,
    options: [
      "Entendo, e obrigado por contar! Muitos sites antigos eram pesados no celular e não levavam ninguém pro WhatsApp. A ideia aqui é outra: uma página leve, com as avaliações reais e um botão direto pra conversa. Mas se não fizer sentido pra vocês agora, tudo bem 🙂",
    ],
  },
  {
    id: "vou-pensar",
    group: "objecao",
    title: "Disse \"vou pensar\" / \"depois eu vejo\"",
    when: "Responda na hora e combine um retorno. Se ele não marcou data, chame de novo em 3 dias.",
    waitDays: 3,
    options: [
      "Claro, sem pressa! Quer que eu te chame na semana que vem pra ver o que achou?",
      "Tranquilo! Se ajudar a decidir, posso te mandar a proposta em PDF com tudo que está incluso. Te chamo de novo em alguns dias, pode ser?",
    ],
  },
  {
    id: "falar-socio",
    group: "objecao",
    title: "Precisa falar com sócio / esposa / gerente",
    when: "Na hora; retome 2 dias depois se não tiver retorno.",
    waitDays: 2,
    options: [
      "Claro! Se quiser, te mando a proposta resumida e o link da demo pra você mostrar. Qualquer dúvida dele(a), posso responder por aqui também.",
    ],
  },
  {
    id: "quem-e-voce",
    group: "duvida",
    title: "Perguntou quem é você / como conseguiu o número",
    when: "Na hora, com transparência.",
    waitDays: null,
    options: [
      "Sou o Caique, desenvolvedor web aqui de São Paulo (Web Prumo). Encontrei a {nome} no Google procurando empresas do bairro que ainda não têm site, e o número estava na ficha de vocês no Google Maps. Se preferir que eu não mande mais mensagens, é só falar 🙂",
    ],
  },
  {
    id: "quanto-tempo",
    group: "duvida",
    title: "Perguntou quanto tempo demora",
    when: "Na hora.",
    waitDays: null,
    options: [
      "Em até 7 dias úteis depois do pagamento e de receber as informações (fotos, serviços, horários). Antes de publicar você revisa e tem 2 rodadas de ajuste.",
    ],
  },
  {
    id: "outros-servicos",
    group: "duvida",
    title: "Perguntou se faz Instagram, logo ou anúncios",
    when: "Na hora, com honestidade sobre o que você faz.",
    waitDays: null,
    options: [
      "Meu foco é site e página pra aparecer no Google. Junto com a página consigo configurar o Perfil da Empresa no Google (R$ 100), formulário de contato (R$ 80) e e-mail profissional (R$ 80). Gestão de Instagram e anúncios eu não faço, pra fazer bem feito o que é a minha área.",
    ],
  },
  // ---------------- fechamento
  {
    id: "quer-ver",
    group: "fechamento",
    title: "Disse que quer ver a demo",
    when: "Assim que a demo estiver pronta (no mesmo dia, se possível).",
    waitDays: null,
    tip: "Sempre diga que é uma demonstração e não o site oficial.",
    options: [
      "Prontinho! Montei essa demonstração pra {nome}: {link}\n\nÉ só um modelo de apresentação, feito com informações públicas de vocês. Não é o site oficial e não está no Google. Se gostar, ajusto do jeito de vocês e coloco no ar. O que achou? 😊",
    ],
  },
  {
    id: "gostou-como-funciona",
    group: "fechamento",
    title: "Gostou e perguntou como funciona para fechar",
    when: "Na hora.",
    waitDays: null,
    options: [
      "Que bom que gostou! Funciona assim: 1) você confirma e faz o Pix (ou a 1ª parcela); 2) me manda fotos, serviços e horários que quiser mostrar; 3) em até 7 dias úteis te mostro a versão final, com 2 rodadas de ajuste; 4) configuro o domínio e a página vai pro ar. Posso te mandar a chave Pix?",
    ],
  },
  {
    id: "fechou",
    group: "fechamento",
    title: "Fechou: agradecer e pedir os materiais",
    when: "Logo depois da confirmação do pagamento.",
    waitDays: null,
    options: [
      "Pagamento recebido, muito obrigado pela confiança! 🙌 Pra eu começar, me manda: logo (se tiver em boa qualidade), fotos do espaço/trabalhos, a lista de serviços e o horário de atendimento. Se já tiver domínio (www), me diz qual é.",
    ],
  },
  {
    id: "sem-interesse",
    group: "fechamento",
    title: "Disse que não tem interesse",
    when: "Na hora. Agradeça, encerre e marque \"Sem interesse\". Se tiver demo no ar, remova em até 7 dias.",
    waitDays: null,
    options: [
      "Tudo bem, obrigado pela atenção e pelo retorno! Sucesso pra {nome} 🙂",
    ],
  },
];

/** Situações que fazem sentido agora para este lead (destacadas no painel). */
export function suggestedSituations(lead: Lead, daysSinceContact: number | null): string[] {
  const d = daysSinceContact ?? 0;
  const out: string[] = [];
  if (lead.status === "abordado" && d >= 7) out.push("encerramento");
  else if (lead.status === "abordado" && d >= 3) out.push("sem-resposta-1");
  if (lead.status === "respondeu" && lead.interest === "sim" && d >= 2) out.push("perguntou-preco-sumiu");
  if (lead.status === "respondeu" && lead.interest === "talvez" && d >= 3) out.push("vou-pensar");
  if (lead.status === "respondeu" && lead.demo_url && d >= 1) out.push("viu-demo-sumiu");
  if (lead.status === "respondeu" && !lead.interest) out.push("quanto-custa", "vantagens-single-page");
  if (lead.status === "aceitou") out.push("fechou");
  if (lead.interest === "nao" || lead.status === "recusou") out.push("sem-interesse");
  return out;
}
