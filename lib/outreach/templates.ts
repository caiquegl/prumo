import { DEFAULT_TEMPLATES, type TemplateKey } from "./messages";
import { getSettings } from "./store";

/** Modelos efetivos: os salvos no painel ou, se vazios, os padrões. */
export async function loadTemplates(): Promise<Record<TemplateKey, string> & { followups_enabled: boolean }> {
  const s = await getSettings();
  const pick = (k: TemplateKey) => (s[k]?.trim() ? s[k] : DEFAULT_TEMPLATES[k]);
  return {
    tpl_cold: pick("tpl_cold"),
    tpl_followup1: pick("tpl_followup1"),
    tpl_followup2: pick("tpl_followup2"),
    tpl_manual: pick("tpl_manual"),
    followups_enabled: s.followups_enabled === "true",
  };
}
