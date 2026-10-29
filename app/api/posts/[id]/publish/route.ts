import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/guard";
import { refreshStoredTokens } from "@/lib/ig/auth";
import { publishQueuePostNow } from "@/lib/ig/dispatch";
import { logEvent } from "@/lib/ig/store";

export const maxDuration = 300;

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const id = Number((await ctx.params).id);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: "id inválido" }, { status: 400 });
  }

  try {
    const refresh = await refreshStoredTokens();
    await logEvent("info", "token_refresh", refresh.refreshed ? "token renovado" : "token válido", refresh);
  } catch (err) {
    const message = err instanceof Error ? err.message : "falhou ao renovar token";
    await logEvent("error", "token_refresh", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const republish = req.nextUrl.searchParams.get("republish") === "1";
  const result = await publishQueuePostNow(id, { republish });
  if (!result.ok) {
    return NextResponse.json({ error: result.error, queueId: "queueId" in result ? result.queueId : id }, { status: result.status });
  }
  return NextResponse.json(result);
}
