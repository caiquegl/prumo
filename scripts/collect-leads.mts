/**
 * Coleta leads (empresas sem site próprio) direto no Neon, sem passar pela Vercel.
 *   npx tsx --env-file=.env.local scripts/collect-leads.mts "barbearia|Mooca, São Paulo" "pet shop|Tatuapé, São Paulo" [--max 20]
 * Só coleta: nunca cria demos (isso é manual, lead a lead, com aprovação do layout).
 */
import { collectLeadsApify } from "@/lib/leads/apify";
import { collectLeads } from "@/lib/leads/places";

const args = process.argv.slice(2);
const maxIdx = args.indexOf("--max");
const max = maxIdx >= 0 ? Number(args[maxIdx + 1]) : 20;
const pairs = args.filter((a, i) => a.includes("|") && i !== maxIdx + 1);
if (!pairs.length) {
  console.error('uso: scripts/collect-leads.mts "nicho|bairro, cidade" ... [--max 20]');
  process.exit(1);
}
const useApify = Boolean(process.env.APIFY_TOKEN);
for (const pair of pairs) {
  const [query, city] = pair.split("|").map((s) => s.trim());
  const t = Date.now();
  try {
    const r = useApify ? await collectLeadsApify({ query, city, max }) : await collectLeads({ query, city, max });
    console.log(
      `${r.query}: ${r.found} encontrados · ${r.inserted} novos · ${r.updated} já existiam · ${r.skippedWithSite} com site · ${r.skippedClosed} fechados (${Math.round((Date.now() - t) / 1000)}s)`,
    );
  } catch (err) {
    console.error(`${query} em ${city}: ERRO ${err instanceof Error ? err.message : err}`);
  }
}
