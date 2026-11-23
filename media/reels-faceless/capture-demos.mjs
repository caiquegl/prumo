/**
 * Captura as demos LK e Violeta ANONIMIZADAS para os Reels faceless (decisão 23/11: nome/logo/telefone/avaliações trocados).
 * A troca é feita só no DOM do navegador de captura — nada muda nas demos publicadas.
 *   node media/reels-faceless/capture-demos.mjs
 */
import { chromium } from "/home/hitss/webPrumo/prumo/worker/node_modules/playwright/index.mjs";
const OUT = "/home/hitss/webPrumo/prumo/media/reels-faceless/assets";
const BASE = process.env.DEMOS_BASE || "http://localhost:3000";

const anon = (rules) => {
  const { words, hideSel, logoSel, monogram } = rules;
  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walk.nextNode()) nodes.push(walk.currentNode);
  for (const n of nodes) {
    let t = n.nodeValue;
    for (const [a, b] of words) t = t.replace(new RegExp(a, "g"), b);
    n.nodeValue = t;
  }
  document.querySelectorAll("a[href]").forEach((a) => a.setAttribute("href", "#"));
  document.querySelectorAll(hideSel).forEach((e) => (e.style.display = "none"));
  document.querySelectorAll(logoSel).forEach((img) => {
    const d = document.createElement("span");
    const r = img.getBoundingClientRect();
    const s = Math.max(r.width, r.height) || 48;
    d.textContent = monogram.text;
    d.style.cssText = `display:inline-grid;place-items:center;width:${s}px;height:${s}px;border-radius:50%;background:${monogram.bg};color:${monogram.fg};font:800 ${Math.round(s * 0.36)}px system-ui;flex:none;box-shadow:0 0 0 2px ${monogram.ring}`;
    img.replaceWith(d);
  });
  document.querySelectorAll('[role="note"]').forEach((e) => (e.style.display = "none")); // banner de demo
  const st = document.createElement("style");
  st.textContent = "nextjs-portal{display:none!important}"; // selo do servidor de desenvolvimento
  document.head.appendChild(st);
  document.querySelectorAll(".lk-float,.vf-float").forEach((e) => (e.style.display = "none"));
};

const jobs = [
  {
    id: "lk",
    url: `${BASE}/lk-estetica-automotiva-vila-formosa`,
    rules: {
      words: [
        ["LK Estética Automotiva", "Studio Brilho"],
        ["Studio LK", "Studio Brilho"],
        ["padrão LK", "padrão Brilho"],
        ["\\bLK\\b", "BRILHO"],
        ["Lukas|Lucas|Lucão", "o dono"],
        ["Rua Nebulosa, 13", "Rua Exemplo, 100"],
        ["R\\. Nebulosa, 13", "Rua Exemplo, 100"],
        ["\\(11\\) 95327-5321", "(11) 90000-0000"],
        ["@lk_detailer", "@studiobrilho"],
        ["Feitz|Ramon Pedro|Sandro Lavoura|Rafael Garcia|Sarah Lima|Guto Benites|EDM Civiqueira|Robson Assis", "Cliente"],
        [" ?❤️🔥", ""], // o Chromium de captura não tem fonte de emoji
      ],
      hideSel: ".lk-studio, .lk-story, .lk-map, .lk-foot",
      logoSel: "img.lk-logo",
      monogram: { text: "SB", bg: "#111", fg: "#f6c803", ring: "#f6c803" },
    },
    picker: { root: ".lk-services", options: ".lk-need", pick: [0, 6] },
  },
  {
    id: "vf",
    url: `${BASE}/violeta-fest-santo-andre`,
    rules: {
      words: [
        ["Violeta Fest", "Doce Festa"],
        ["Violeta", "Doce Festa"],
        ["violeta\\.fest", "docefesta"],
        ["\\(11\\) 96671-0006", "(11) 90000-0000"],
        ["Pamela Pereira|Uara Rayane Oliveira Camelo|Miriam Oliveira|Lourdes Nascimento|Laura Muniz|Jessica Layany", "Cliente"],
      ],
      hideSel: ".vf-goes, .vf-foot, .vf-final .vf-logo-lg",
      logoSel: "img.vf-logo",
      monogram: { text: "DF", bg: "#e8d7e9", fg: "#371456", ring: "#d9b864" },
    },
    picker: { root: ".vf-build", options: ".vf-builder-form fieldset:first-of-type .vf-chip", pick: [2, 3] },
    after: ".vf-ticket",
  },
];

const gl = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
// sem WebGL: a cena 3D cai no fallback e as capturas de rolagem/estados não travam
const b = await chromium.launch({ args: ["--disable-3d-apis"] });
for (const j of jobs) {
  const opts = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: "pt-BR" };
  // hero (primeira tela) com a cena 3D/vídeo rodando, num navegador com WebGL
  const h0 = await gl.newPage(opts);
  await h0.goto(j.url, { waitUntil: "networkidle", timeout: 120000 });
  await h0.waitForTimeout(5000);
  await h0.evaluate(anon, j.rules);
  await h0.screenshot({ path: `${OUT}/${j.id}-hero.png`, timeout: 90000 });
  await h0.close();
  const p = await b.newPage(opts);
  await p.goto(j.url, { waitUntil: "networkidle", timeout: 120000 });
  await p.waitForTimeout(2500);
  await p.evaluate(anon, j.rules);
  // estados do seletor / montador: telas do celular (viewport), não página inteira
  const root = p.locator(j.picker.root).first();
  await root.evaluate((el) => el.scrollIntoView({ block: "start" }));
  await p.waitForTimeout(900);
  await p.screenshot({ path: `${OUT}/${j.id}-pick-0.png` });
  await p.evaluate(() => window.scrollBy(0, 560));
  await p.waitForTimeout(700);
  await p.screenshot({ path: `${OUT}/${j.id}-pick-0b.png` });
  let k = 1;
  for (const i of j.picker.pick) {
    await p.locator(j.picker.options).nth(i).dispatchEvent("click");
    await p.waitForTimeout(1400);
    if (j.after) await p.evaluate((sel) => document.querySelector(sel)?.scrollIntoView({ block: "center" }), j.after);
    await p.waitForTimeout(600);
    await p.screenshot({ path: `${OUT}/${j.id}-pick-${k++}.png` });
  }
  // por último a página inteira (depois dela o Chromium não tira mais screenshots desta aba)
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForTimeout(2500);
  await p.evaluate(anon, j.rules);
  await p.evaluate(() => document.querySelectorAll("canvas").forEach((c) => (c.style.display = "none")));
  // revela tudo e captura a página inteira
  const h = await p.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < h; y += 500) { await p.evaluate((y) => window.scrollTo(0, y), y); await p.waitForTimeout(120); }
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.waitForTimeout(800);
  await p.screenshot({ path: `${OUT}/${j.id}-full.png`, fullPage: true, animations: "disabled", timeout: 120000 });
  console.log(j.id, "ok");
  await p.close();
}
await b.close();
await gl.close();
