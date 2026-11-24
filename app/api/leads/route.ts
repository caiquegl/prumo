import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/guard";
import { leadCounts, listLeads, nicheCounts } from "@/lib/leads/store";
import { isLeadStatus } from "@/lib/leads/types";
import { DEFAULT_TEMPLATES } from "@/lib/outreach/messages";
import { queuedLeadIds } from "@/lib/outreach/store";
import { loadTemplates } from "@/lib/outreach/templates";

export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rawStatus = req.nextUrl.searchParams.get("status") || "all";
  const status = isLeadStatus(rawStatus) ? rawStatus : "all";
  const q = req.nextUrl.searchParams.get("q") || undefined;
  const niche = req.nextUrl.searchParams.get("niche");
  const [leads, counts, niches, queued, templates] = await Promise.all([
    listLeads({ status, q, niche }),
    leadCounts(),
    nicheCounts(),
    queuedLeadIds(),
    loadTemplates(),
  ]);
  return NextResponse.json({
    leads,
    counts,
    niches,
    queued,
    template: templates.tpl_manual,
    defaultTemplate: DEFAULT_TEMPLATES.tpl_manual,
  });
}
