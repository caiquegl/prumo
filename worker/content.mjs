import { readFile } from "node:fs/promises";

const LAYOUTS = ["hero", "quote", "split", "stat", "cards", "compare"];
const BASE_TAGS = ["prumoweb", "tecnologia", "empresas"];

const plain = s => String(s).replace(/<br>/g, " ");

export function validateItem(it) {
  const fail = msg => { throw new Error(`conteúdo "${it?.id ?? "?"}": ${msg}`); };
  if (!it || typeof it !== "object") fail("não é um objeto");
  if (!LAYOUTS.includes(it.layout)) fail(`layout inválido (${it.layout})`);
  for (const k of ["id", "kicker", "title", "headline", "hook"]) if (!it[k]) fail(`campo ${k} vazio`);
  if (plain(it.title).length > 56) fail("título longo demais");
  if (it.layout === "compare") {
    for (const side of [it.left, it.right]) {
      if (!side?.label || !Array.isArray(side.rows) || side.rows.length < 3) fail("compare precisa de 3 linhas por lado");
    }
  }
  if (it.layout === "stat" && !it.stat?.value) fail("stat precisa de valor");
  if (["split", "cards"].includes(it.layout) && (!Array.isArray(it.items) || it.items.length < 3)) fail(`${it.layout} precisa de 3 itens`);
  return it;
}

export async function loadBank(path) {
  const bank = JSON.parse(await readFile(path, "utf8"));
  bank.forEach(validateItem);
  return bank;
}

export function buildCaption(it) {
  const bits = [it.hook, titleOf(it)];
  if (it.layout === "compare" && it.left && it.right) {
    bits.push(`${it.left.label}: ${it.left.rows.join(" · ")}\n${it.right.label}: ${it.right.rows.join(" · ")}`);
  } else if (it.items?.length) {
    bits.push(it.items.map(([t]) => `· ${t}`).join("\n"));
  } else if (it.stat) {
    bits.push(`${it.stat.value} ${it.stat.label}`);
  }
  bits.push(`${plain(it.headline)} WhatsApp (11) 96633-1995 · link na bio.`);
  const tags = [...new Set([...(it.tags || []), ...BASE_TAGS])].slice(0, 6).map(t => `#${t.replace(/[^\p{L}\p{N}_]/gu, "")}`);
  bits.push(tags.join(" "));
  return bits.join("\n\n");
}

const SYSTEM = `Você escreve posts para o Instagram da Prumo Web (@prumo.web), estúdio brasileiro que cria sites, single pages, sistemas sob medida, automações, integrações e soluções de trade marketing para empresas.
Objetivo: atrair clientes empresariais. Tom direto, em português do Brasil. Visual no estilo editorial: pouco texto, uma ideia por post.
Regras obrigatórias:
- Não cite marcas, produtos ou empresas de terceiros.
- Não invente estatísticas, porcentagens ou números de pesquisa.
- Não fale de celulares/smartphones como produto.
- Título curto, no máximo 2 linhas com <br>. Sem parágrafos no post.
Responda apenas com JSON no formato:
{"id": "slug-curto", "layout": "<layout>", "visual": "leaves|wire|chart|cloud|mark", "kicker": "até 18 caracteres", "title": "título com <br>, até 44 caracteres",
 "items": [["rótulo curto"]], "stat": {"value": "7–15", "label": "frase curta"},
 "left": {"label": "...", "rows": ["até 22 caracteres", "...", "..."]}, "right": {"label": "...", "rows": ["...", "...", "..."]},
 "headline": "chamada até 28 caracteres", "hook": "primeira linha da legenda, até 110 caracteres", "tags": ["4 hashtags sem #"]}
Layouts: "hero" = só título + imagem, sem items; "quote" = frase grande, sem items; "stat" = precisa de stat.value; "split" = imagem + 3 rótulos curtos em items; "cards" = 3 rótulos curtos, sem descrição; "compare" = left e right com 3 linhas cada, sem items.`;

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
  const avoid = state.published.slice(-2).map(p => p.layout);
  const lastLayout = avoid.at(-1);
  const used = new Set(state.published.map(p => p.id));
  const unused = bank.filter(it => !used.has(it.id) && !avoid.includes(it.layout));
  if (unused.length) return unused[0];
  const unusedSkipOne = bank.filter(it => !used.has(it.id) && it.layout !== lastLayout);
  if (unusedSkipOne.length) return unusedSkipOne[0];

  const layout = LAYOUTS.find(l => !avoid.includes(l)) || LAYOUTS.find(l => l !== lastLayout) || LAYOUTS[0];
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
  const pool = bank.filter(it => it.layout !== lastLayout);
  return pool.sort((a, b) => state.published.findLastIndex(p => p.id === a.id) - state.published.findLastIndex(p => p.id === b.id))[0];
}

export const titleOf = it => plain(it.title).replace(/\s+/g, " ").trim();
