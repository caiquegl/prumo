import { BUBBLE_GAP_MS, LEAD_GAP_MS } from "./send";

/**
 * Previsão do horário de envio de cada item aprovado, espelhando o runner de hora em hora:
 * rodadas às HH:02 (São Paulo, UTC−3 sem horário de verão) seg–sex 9h–17h e sáb 9h–11h, até `perRun` por rodada,
 * 1 min entre leads e 30 s entre balões, respeitando o teto diário. É estimativa: atrasos do GitHub Actions
 * (alguns minutos) e falhas mudam o horário real.
 */
const SP_OFFSET_MS = -3 * 3600_000;

function spParts(d: Date) {
  const sp = new Date(d.getTime() + SP_OFFSET_MS);
  return { day: sp.getUTCDay(), hour: sp.getUTCHours(), minute: sp.getUTCMinutes(), ymd: sp.toISOString().slice(0, 10) };
}

function isRunHour(day: number, hour: number) {
  if (day >= 1 && day <= 5) return hour >= 9 && hour <= 17;
  if (day === 6) return hour >= 9 && hour <= 11;
  return false;
}

/** Próximas rodadas (Date UTC) a partir de agora. */
function* runSlots(now: Date) {
  // começa na hora cheia atual em SP
  const t = new Date(now);
  t.setUTCMinutes(2, 0, 0);
  if (t.getTime() + 5 * 60_000 < now.getTime()) t.setUTCHours(t.getUTCHours() + 1);
  for (let i = 0; i < 24 * 30; i++) {
    const { day, hour } = spParts(t);
    if (isRunHour(day, hour)) yield new Date(t);
    t.setUTCHours(t.getUTCHours() + 1);
  }
}

export function estimateEta(
  items: Array<{ id: number; text: string }>,
  opts: { now?: Date; perRun?: number; dailyCap?: number; sentToday?: number } = {},
): Record<number, string> {
  const now = opts.now ?? new Date();
  const perRun = opts.perRun ?? 1;
  const cap = opts.dailyCap ?? 9;
  const out: Record<number, string> = {};
  const perDay = new Map<string, number>([[spParts(now).ymd, opts.sentToday ?? 0]]);
  let idx = 0;
  for (const slot of runSlots(now)) {
    if (idx >= items.length) break;
    const ymd = spParts(slot).ymd;
    let inRun = 0;
    let t = Math.max(slot.getTime(), now.getTime());
    while (idx < items.length && inRun < perRun && (perDay.get(ymd) ?? 0) < cap) {
      const it = items[idx];
      out[it.id] = new Date(t).toISOString();
      const bubbles = it.text.split(/^\s*---\s*$/m).filter((p) => p.trim()).length;
      t += LEAD_GAP_MS + Math.max(0, bubbles - 1) * BUBBLE_GAP_MS + 5_000;
      perDay.set(ymd, (perDay.get(ymd) ?? 0) + 1);
      inRun++;
      idx++;
    }
  }
  return out;
}
