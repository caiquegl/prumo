import { readFile } from "node:fs/promises";

const LAYOUTS = ["list", "flow", "compare", "checklist"];
const BASE_TAGS = ["prumoweb", "tecnologia", "empresas"];

const plain = s => String(s).replace(/<br>/g, " ");

export function validateItem(it) {
  const fail = msg => { throw new Error(`conteúdo "${it?.id ?? "?"}": ${msg}`); };
  if (!it || typeof it !== "object") fail("não é um objeto");
  if (!LAYOUTS.includes(it.layout)) fail(`layout inválido (${it.layout})`);
  for (const k of ["id", "kicker", "title", "headline", "hook"]) if (!it[k]) fail(`campo ${k} vazio`);
  if (plain(it.title).length > 48) fail("título longo demais");
  if (it.layout === "compare") {
    for (const side of [it.left, it.right]) {
      if (!side?.label || !Array.isArray(side.rows) || side.rows.length < 3 || side.rows.length > 5) fail("compare precisa de 3–5 linhas por lado");
      if (side.rows.some(r => r.length > 44)) fail("linha de comparação longa demais");
    }
  } else {
    const max = it.layout === "list" ? 6 : 5;
    if (!Array.isArray(it.items) || it.items.length < 3 || it.items.length > max) fail(`${it.layout} precisa de 3–${max} itens`);
    if (it.layout === "list" && it.items.length % 2) fail("list precisa de número par de itens");
    for (const [t, d] of it.items) {
      if (!t || t.length > 40) fail(`item "${t}" vazio ou longo demais`);
      if (d && d.length > 80) fail(`descrição de "${t}" longa demais`);
    }
  }
  return it;
}

export async function loadBank(path) {
  const bank = JSON.parse(await readFile(path, "utf8"));
  bank.forEach(validateItem);
  return bank;
}

export function buildCaption(it) {
  let body;
  if (it.layout === "compare") {
    body = `${it.left.label}:\n${it.left.rows.map(r => `✕ ${r}`).join("\n")}\n\n${it.right.label}:\n${it.right.rows.map(r => `✓ ${r}`).join("\n")}`;
  } else {
    const mark = { list: () => "▸", flow: i => `${i + 1}.`, checklist: () => "✓" }[it.layout];
    body = it.items.map(([t, d], i) => `${mark(i)} ${t}${d ? ` — ${d}` : ""}`).join("\n");
  }
  const tags = [...new Set([...(it.tags || []), ...BASE_TAGS])].slice(0, 8).map(t => `#${t.replace(/[^\p{L}\p{N}_]/gu, "")}`);
  return [
    it.hook,
    [titleOf(it), it.sub].filter(Boolean).join(/[?!.:]$/.test(titleOf(it)) ? " " : ": "),
    body,
    `${plain(it.headline)} Fale com a Prumo Web: orçamento sem compromisso no WhatsApp (11) 96633-1995 ou pelo link na bio.`,
    tags.join(" "),
  ].join("\n\n");
}

const SYSTEM = `Você escreve posts para o Instagram da Prumo Web (@prumo.web), estúdio brasileiro que cria sites, single pages, sistemas sob medida, automações, integrações e soluções de trade marketing para empresas.
Objetivo: atrair clientes empresariais, mostrar diferencial e capacidade técnica, com tom profissional, direto e acessível, em português do Brasil.
Regras obrigatórias:
- Não cite marcas, produtos ou empresas de terceiros.
- Não invente estatísticas, porcentagens ou números de pesquisa.
- Não fale de celulares/smartphones como produto.
- Conteúdo prático e útil para donos de negócio e gestores.
Responda apenas com JSON no formato:
{"id": "slug-curto", "layout": "<layout>", "kicker": "até 24 caracteres", "title": "título com <br> no meio, até 44 caracteres", "sub": "frase de apoio até 90 caracteres",
 "items": [["título até 34 caracteres", "descrição até 70 caracteres"], ...],
 "left": {"label": "...", "rows": ["até 38 caracteres", ...]}, "right": {"label": "...", "rows": [...]},
 "headline": "chamada final até 34 caracteres", "hook": "primeira linha da legenda, até 120 caracteres, pode ter 1 emoji", "tags": ["4 hashtags sem #"]}
Layouts: "list" = 4 ou 6 itens (dicas/causas); "flow" = 4 etapas em sequência; "checklist" = 5 itens verificáveis; "compare" = left (jeito antigo) e right (jeito Prumo) com 4 linhas cada, sem "items".`;

export async function generateItem({ apiKey, model, layout, recent }) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      temperature: 0.9,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: `Crie um post novo com layout "${layout}". Não repita estes temas já publicados:\n${recent.map(t => `- ${t}`).join("\n")}` },
      ],
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${JSON.stringify(json.error ?? json)}`);
  const item = JSON.parse(json.choices[0].message.content);
  item.layout = layout;
  item.id = `ia-${new Date().toISOString().slice(0, 10)}-${String(item.id || "post").replace(/[^a-z0-9-]/gi, "").slice(0, 40)}`;
  return validateItem(item);
}

export async function pickItem({ bank, state, apiKey, model, log }) {
  const used = new Set(state.published.map(p => p.id));
  const fresh = bank.find(it => !used.has(it.id));
  if (fresh) return fresh;

  const counts = Object.fromEntries(LAYOUTS.map(l => [l, 0]));
  state.published.slice(-8).forEach(p => { if (p.layout in counts) counts[p.layout]++; });
  const layout = LAYOUTS.reduce((a, b) => (counts[b] < counts[a] ? b : a));

  if (apiKey) {
    const recent = state.published.slice(-40).map(p => p.title);
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        return await generateItem({ apiKey, model, layout, recent });
      } catch (err) {
        log(`geração com IA falhou (tentativa ${attempt}): ${err.message}`);
      }
    }
  }
  log("banco de conteúdo esgotado e sem IA disponível: republicando o item mais antigo");
  const oldest = bank.map(it => [it, state.published.findLastIndex(p => p.id === it.id)]).sort((a, b) => a[1] - b[1])[0][0];
  return oldest;
}

export const titleOf = it => plain(it.title).replace(/\s+/g, " ").trim();
