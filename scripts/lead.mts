/**
 * Utilitário local para um lead (direto no Neon, sem depender das envs da Vercel).
 *   npx tsx --env-file=.env.local scripts/lead.mts get <id>
 *   npx tsx --env-file=.env.local scripts/lead.mts details <id> [fotos=10]   # Apify (ou Places se não houver token)
 *   npx tsx --env-file=.env.local scripts/lead.mts patch <id> '{"status":"criando","event_note":"..."}'
 */
import { fetchLeadDetailsApify } from "@/lib/leads/apify";
import { fetchLeadDetails } from "@/lib/leads/places";
import { getLead, leadEvents, parseLeadPatch, updateLead } from "@/lib/leads/store";

const [cmd, idRaw, extra] = process.argv.slice(2);
const id = Number(idRaw);
if (!cmd || !Number.isFinite(id)) {
  console.error("uso: lead.mts get|details|patch <id> [json|fotos]");
  process.exit(1);
}

const lead = await getLead(id);
if (!lead) {
  console.error(`lead ${id} não encontrado`);
  process.exit(1);
}

if (cmd === "get") {
  console.log(JSON.stringify({ lead, events: await leadEvents(id) }, null, 2));
} else if (cmd === "details") {
  const photos = Number(extra ?? 10);
  const details = process.env.APIFY_TOKEN
    ? await fetchLeadDetailsApify(lead.place_id, photos)
    : await fetchLeadDetails(lead.place_id, photos);
  console.log(JSON.stringify({ lead, details }, null, 2));
} else if (cmd === "patch") {
  const patch = parseLeadPatch(JSON.parse(extra ?? "{}"));
  if (typeof patch === "string") {
    console.error(patch);
    process.exit(1);
  }
  const updated = await updateLead(id, patch);
  console.log(JSON.stringify({ id, status: updated?.status, demo_url: updated?.demo_url }, null, 2));
} else {
  console.error(`comando desconhecido: ${cmd}`);
  process.exit(1);
}
