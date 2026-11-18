/**
 * Coleta leads (empresas sem site próprio) direto no Neon, sem passar pela Vercel.
 *
 *   # pares nicho|local
 *   npx tsx --env-file=.env.local scripts/collect-leads.mts "barbearia|Mooca, São Paulo" [--max 20]
 *   # todos os nichos prioritários (lib/leads/niches.ts) × regiões
 *   npx tsx --env-file=.env.local scripts/collect-leads.mts --priority --areas "Tatuapé, São Paulo;Santo André, SP" [--only odonto,solar] [--max 20]
 *   # reclassifica nichos dos leads já salvos
 *   npx tsx --env-file=.env.local scripts/collect-leads.mts --reclassify
 *
 * Só coleta: nunca cria demos (isso é manual, lead a lead, com aprovação do layout).
 */
import { collectLeadsApify } from "@/lib/leads/apify";
import { DEFAULT_AREAS, NICHES } from "@/lib/leads/niches";
import { collectLeads } from "@/lib/leads/places";
import { reclassifyNiches } from "@/lib/leads/store";

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const max = Number(flag("max") ?? 20);

if (args.includes("--reclassify")) {
  console.log(`reclassificados: ${await reclassifyNiches()}`);
  process.exit(0);
}

let pairs: Array<[string, string]>;
if (args.includes("--priority")) {
  const areas = (flag("areas") ?? DEFAULT_AREAS.slice(0, 2).join(";")).split(";").map((a) => a.trim()).filter(Boolean);
  const only = flag("only")?.split(",").map((s) => s.trim());
  pairs = NICHES.filter((n) => !only || only.includes(n.id)).flatMap((n) =>
    areas.map((a) => [n.queries[0]!, a] as [string, string]),
  );
} else {
  const values = new Set(["max", "areas", "only"].map(flag).filter(Boolean));
  pairs = args
    .filter((a) => a.includes("|") && !values.has(a))
    .map((a) => a.split("|").map((s) => s.trim()) as [string, string]);
}
if (!pairs.length) {
  console.error('uso: scripts/collect-leads.mts "nicho|bairro, cidade" ... | --priority [--areas "a;b"] | --reclassify');
  process.exit(1);
}

const useApify = Boolean(process.env.APIFY_TOKEN);
let inserted = 0;
for (const [query, city] of pairs) {
  const t = Date.now();
  try {
    const r = useApify ? await collectLeadsApify({ query, city, max }) : await collectLeads({ query, city, max });
    inserted += r.inserted;
    console.log(
      `${r.query}: ${r.found} encontrados · ${r.inserted} novos · ${r.updated} já existiam · ${r.skippedWithSite} com site · ${r.skippedClosed} fechados (${Math.round((Date.now() - t) / 1000)}s)`,
    );
  } catch (err) {
    console.error(`${query} em ${city}: ERRO ${err instanceof Error ? err.message : err}`);
  }
}
console.log(`total de novos leads: ${inserted}`);
