export type SeoPage = {
  path: string;
  eyebrow: string;
  title: string;
  h1: string;
  description: string;
  lead: string;
  bullets: string[];
  waText: string;
  priority: number;
};

export const SEO_PAGES: SeoPage[] = [
  {
    path: "/criacao-de-sites",
    eyebrow: "Serviço",
    title: "Criação de Sites Profissionais",
    h1: "Criação de sites que convertem.",
    description:
      "Criação de sites para empresas com design autoral, SEO técnico e foco em conversão. Sites rápidos, responsivos e prontos para gerar leads.",
    lead: "A Web Prumo desenvolve sites profissionais para empresas que precisam de presença digital séria: credibilidade, busca orgânica e caminho claro até o WhatsApp ou formulário.",
    bullets: [
      "Brief objetivo com escopo, prazo e valor fechados",
      "Design autoral + código limpo (sem template genérico)",
      "SEO técnico, performance e mobile-first",
      "Entrega com domínio, HTTPS e documentação",
    ],
    waText: "Olá! Quero orçamento de criação de site com a Web Prumo.",
    priority: 0.9,
  },
  {
    path: "/landing-pages",
    eyebrow: "Serviço",
    title: "Criação de Landing Pages que Convertem",
    h1: "Landing pages feitas para gerar lead.",
    description:
      "Landing pages e páginas de captura focadas em lead, venda ou agendamento. No ar em 7 a 15 dias, com duas rodadas de revisão.",
    lead: "Criamos páginas de captura para campanhas, lançamentos e anúncios. Escopo fechado, visual autoral e foco em uma ação: clicar, preencher ou chamar no WhatsApp.",
    bullets: [
      "Uma oferta, uma mensagem, um CTA — sem distração",
      "Estrutura pensada em conversão (hero, prova, objeções, formulário/WhatsApp)",
      "Prazo típico: 7 a 15 dias com 2 rodadas de revisão",
      "Integração com WhatsApp, CRM ou planilha quando precisar",
    ],
    waText: "Olá! Quero orçamento de landing page com a Web Prumo.",
    priority: 0.9,
  },
  {
    path: "/sites-institucionais",
    eyebrow: "Serviço",
    title: "Sites Institucionais para Empresas",
    h1: "Sites institucionais com presença de verdade.",
    description:
      "Sites institucionais com credibilidade, SEO técnico e estrutura clara para apresentar sua marca e serviços.",
    lead: "Um site institucional bem feito apresenta sua empresa com clareza: quem vocês são, o que entregam e por que confiar — sem páginas genéricas ou conteúdo vazio.",
    bullets: [
      "Narrativa da marca + serviços + prova + contato",
      "Arquitetura pensada para buscas e navegação fácil",
      "Visual alinhado à identidade, sem cara de template",
      "Base técnica pronta para evoluir (blog, área do cliente, etc.)",
    ],
    waText: "Olá! Quero orçamento de site institucional com a Web Prumo.",
    priority: 0.85,
  },
  {
    path: "/sistemas-web",
    eyebrow: "Produto",
    title: "Sistemas Web e Painéis Sob Medida",
    h1: "Sistemas web que organizam sua operação.",
    description:
      "Desenvolvimento de sistemas web, área do cliente, dashboards e ferramentas internas sob medida para o seu processo.",
    lead: "Além do site, construímos sistemas web: painéis, filas, cadastros e fluxos que sua equipe usa todo dia — com login, permissões e integração com o que você já usa.",
    bullets: [
      "Área do cliente, admin e ferramentas internas",
      "Fluxos claros: do lead ao pedido, do pedido ao status",
      "Integração com WhatsApp, planilhas, CRM e APIs",
      "Código próprio, seguro e fácil de evoluir",
    ],
    waText: "Olá! Quero orçamento de sistema web com a Web Prumo.",
    priority: 0.9,
  },
  {
    path: "/integracoes",
    eyebrow: "Operação",
    title: "Integrações e Automação (WhatsApp, CRM, APIs)",
    h1: "Integrações que fazem tudo conversar.",
    description:
      "Integração WhatsApp, CRM, planilhas, pagamentos e APIs. Automação para reduzir trabalho manual e não perder lead.",
    lead: "Conectamos ferramentas para o operacional fluir: lead no site vai pro WhatsApp, status atualiza no painel, pagamento confirma no CRM — sem planilha solta nem cópia manual.",
    bullets: [
      "WhatsApp Business, webhooks e bots sob medida",
      "CRM, planilhas, ERP e gateways de pagamento",
      "Automações que cortam retrabalho e erro humano",
      "Documentação do que foi ligado e como manter",
    ],
    waText: "Olá! Quero orçamento de integração/automação com a Web Prumo.",
    priority: 0.9,
  },
  {
    path: "/desenvolvimento-web",
    eyebrow: "Tecnologia",
    title: "Desenvolvimento Web Profissional",
    h1: "Desenvolvimento web com foco em resultado.",
    description:
      "Desenvolvimento web sob medida: sites, landing pages, sistemas e integrações com performance, SEO e conversão.",
    lead: "Desenvolvimento web de ponta a ponta — da ideia ao deploy. Usamos stack moderna, código limpo e decisões técnicas a serviço do negócio, não do hype.",
    bullets: [
      "Sites, landings, sistemas e APIs no mesmo time",
      "Performance (Core Web Vitals) e SEO técnico desde o dia 1",
      "Hospedagem, domínio, HTTPS e monitoramento",
      "Escopo fechado: prazo e valor antes de começar",
    ],
    waText: "Olá! Quero orçamento de desenvolvimento web com a Web Prumo.",
    priority: 0.88,
  },
  {
    path: "/site-para-empresa",
    eyebrow: "Empresas",
    title: "Site para Empresa — Presença Digital que Vende",
    h1: "Site para empresa pronto para gerar demanda.",
    description:
      "Site para empresa com cara profissional, SEO local/nacional e caminho claro até o contato. Ideal para PMEs e times comerciais.",
    lead: "Sua empresa precisa ser encontrada e parecer confiável em segundos. Montamos o site com oferta clara, prova social e CTA — feito para quem pesquisa no Google e quer falar com você.",
    bullets: [
      "Posicionamento claro: o que você faz e para quem",
      "Páginas de serviço pensadas para busca orgânica",
      "WhatsApp e formulário no lugar certo",
      "Entrega rápida com escopo e valor fechados",
    ],
    waText: "Olá! Quero um site para minha empresa com a Web Prumo.",
    priority: 0.88,
  },
  {
    path: "/seo-para-sites",
    eyebrow: "SEO",
    title: "SEO Técnico para Sites e Landing Pages",
    h1: "SEO técnico para você ser encontrado.",
    description:
      "SEO para sites e landing pages: estrutura, performance, sitemap, dados estruturados e páginas que ranqueiam termos do seu negócio.",
    lead: "SEO de verdade começa no código e na estrutura. Configuramos Search Console, sitemap, metadados, Core Web Vitals e páginas de serviço para as buscas que trazem cliente.",
    bullets: [
      "Sitemap, robots, canonical e Open Graph corretos",
      "Dados estruturados (Organization, FAQ, serviços)",
      "Páginas de keyword (sites, landing, sistemas, integrações)",
      "Base pronta para conteúdo e linkagem interna",
    ],
    waText: "Olá! Quero SEO técnico no meu site com a Web Prumo.",
    priority: 0.85,
  },
];
