/**
 * Abordagem pelo WhatsApp (Evolution API) — SEMPRE 1 lead por vez, com texto aprovado pelo Caique.
 *
 *   npx tsx --env-file=.env.local scripts/whatsapp.mts status            # conexão da instância
 *   npx tsx --env-file=.env.local scripts/whatsapp.mts qr                # cria/conecta instância e salva QR em tmp/whatsapp-qr.png
 *   npx tsx --env-file=.env.local scripts/whatsapp.mts draft <leadId> [--name "Nome curto"]  # rascunho (não envia)
 *   npx tsx --env-file=.env.local scripts/whatsapp.mts send <leadId> --text-file msg.txt --approved
 *
 * `send` só funciona com --approved (o Caique aprovou ESTE texto para ESTE lead), lead com demo publicada,
 * número com WhatsApp e ainda não abordado. Nunca rodar em loop/lote.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { connectQr, connectionState, createInstance, hasWhatsApp, sendText } from "@/lib/whatsapp/evolution";
import { getLead, updateLead } from "@/lib/leads/store";

const [cmd, idRaw] = process.argv.slice(2);
const args = process.argv.slice(2);
const flag = (n: string) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : undefined;
};

/**
 * Tom de conversa, sem cara de anúncio. SEMPRE deixa claro que o link é só uma demonstração
 * (não é o site oficial, não está no Google, feita com informações públicas, sai do ar se pedirem)
 * para não gerar problema com a marca do cliente. Use o nome curto da empresa (`--name`).
 */
function firstMessage(name: string, rating: number | null, demoUrl: string) {
  const nota = rating ? ` (${rating.toFixed(1).replace(".", ",")} estrelas, parabéns pelas avaliações!)` : "";
  return [
    `Oi, tudo bem? Meu nome é Caique, sou desenvolvedor web aqui em São Paulo (Web Prumo). Vi a ${name} no Google${nota} e não encontrei um site de vocês.`,
    `Por isso preparei um modelo de página, como proposta, pra vocês verem como poderia ficar: ${demoUrl}`,
    `É só uma demonstração: não é o site oficial, não aparece no Google e foi feita só com as informações públicas de vocês. Se preferirem, tiro do ar na hora.`,
    `Se fizer sentido, te passo os valores e detalhes, sem compromisso. Obrigado!`,
  ].join("\n\n");
}

if (cmd === "status") {
  console.log("estado:", await connectionState());
} else if (cmd === "qr") {
  let state = "unknown";
  try {
    state = await connectionState();
  } catch {
    await createInstance();
  }
  if (state === "open") {
    console.log("já conectado");
  } else {
    const r = await connectQr();
    const b64 = r.base64?.split(",").pop();
    if (!b64) throw new Error(`sem QR na resposta: ${JSON.stringify(r).slice(0, 200)}`);
    mkdirSync("tmp", { recursive: true });
    writeFileSync("tmp/whatsapp-qr.png", Buffer.from(b64, "base64"));
    console.log("QR salvo em tmp/whatsapp-qr.png", r.pairingCode ? `· código de pareamento: ${r.pairingCode}` : "");
  }
} else if (cmd === "draft" || cmd === "send") {
  const id = Number(idRaw);
  const lead = Number.isFinite(id) ? await getLead(id) : null;
  if (!lead) throw new Error(`lead ${idRaw} não encontrado`);
  if (!lead.demo_url) throw new Error("lead sem demo publicada");
  if (!lead.whatsapp) throw new Error("lead sem número de celular/WhatsApp");

  if (cmd === "draft") {
    console.log(`Para: ${lead.name} · +${lead.whatsapp}\n\n${firstMessage(flag("name") ?? lead.name, lead.rating, lead.demo_url)}`);
  } else {
    if (!args.includes("--approved")) throw new Error("envio exige --approved (texto aprovado pelo Caique)");
    const file = flag("text-file");
    if (!file) throw new Error("informe --text-file com o texto aprovado");
    const text = readFileSync(file, "utf8").trim();
    if (!text) throw new Error("texto vazio");
    if (lead.contacted_at && !args.includes("--again")) throw new Error(`lead já abordado em ${lead.contacted_at}`);
    if (lead.status === "descartado" || lead.status === "recusou") throw new Error(`lead está "${lead.status}"`);
    if ((await connectionState()) !== "open") throw new Error("WhatsApp não está conectado (rode: whatsapp.mts qr)");
    if (!(await hasWhatsApp(lead.whatsapp))) throw new Error(`+${lead.whatsapp} não tem WhatsApp`);

    const r = await sendText(lead.whatsapp, text);
    await updateLead(lead.id, {
      status: "abordado",
      event_note: `WhatsApp enviado (Evolution, id ${r.key?.id ?? "?"}): ${text.slice(0, 180)}${text.length > 180 ? "…" : ""}`,
    });
    console.log(`enviado para ${lead.name} (+${lead.whatsapp}) · lead #${lead.id} → abordado`);
  }
} else {
  console.error("uso: whatsapp.mts status | qr | draft <leadId> | send <leadId> --text-file f --approved");
  process.exit(1);
}
