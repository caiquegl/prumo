import { connection } from "next/server";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/guard";
import { COMPETITOR_NOTES, GROWTH_RULES, SAMPLE_WEEK, WEEKLY_FEED_MIX } from "@/lib/ig/playbook";
import { account } from "@/lib/ig/publish";
import { listQueuePosts, queueStats } from "@/lib/ig/queue";
import { listLogs, listPublications } from "@/lib/ig/store";

export async function GET(req: NextRequest) {
  await connection();
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let ig: Record<string, unknown> | null = null;
  let igError: string | null = null;
  try {
    ig = await account();
  } catch (err) {
    igError = err instanceof Error ? err.message : "falhou ao ler conta IG";
  }

  const [stats, publications, logs, pending] = await Promise.all([
    queueStats(),
    listPublications(20),
    listLogs(25),
    listQueuePosts({ status: "pending" }),
  ]);

  return NextResponse.json({
    ok: !igError,
    igError,
    instagram: ig,
    queue: stats,
    pendingPreview: pending.slice(0, 8).map((p) => ({
      id: p.id,
      media_type: p.media_type,
      sort_order: p.sort_order,
      caption: (p.caption || "").slice(0, 120),
    })),
    publications: publications.slice(-12).reverse(),
    logs,
    playbook: {
      weeklyMix: WEEKLY_FEED_MIX,
      sampleWeek: SAMPLE_WEEK,
      growthRules: GROWTH_RULES,
      competitors: COMPETITOR_NOTES,
    },
    crons: {
      token: "06:00 BRT",
      feed: ["07:00 BRT — 1 Reel/dia"],
      stories: ["pausado"],
    },
    timezone: "America/Sao_Paulo",
  });
}
