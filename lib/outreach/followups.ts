import { getLead } from "@/lib/leads/store";
import { renderTemplate } from "./messages";
import { addApproved, dueFollowups } from "./store";
import { loadTemplates } from "./templates";

/**
 * Coloca na fila (já aprovados) os follow-ups vencidos, se a automação estiver ligada no painel.
 * Ligar a chave com o texto do modelo visível conta como a aprovação do Caique para esse texto.
 */
export async function enqueueDueFollowups(): Promise<{ followup1: number; followup2: number; enabled: boolean }> {
  const t = await loadTemplates();
  if (!t.followups_enabled) return { followup1: 0, followup2: 0, enabled: false };
  const out = { followup1: 0, followup2: 0, enabled: true };
  for (const kind of ["followup2", "followup1"] as const) {
    for (const { lead_id } of await dueFollowups(kind)) {
      const lead = await getLead(lead_id);
      if (!lead) continue;
      await addApproved(lead_id, kind, renderTemplate(kind === "followup1" ? t.tpl_followup1 : t.tpl_followup2, lead));
      out[kind]++;
    }
  }
  return out;
}
