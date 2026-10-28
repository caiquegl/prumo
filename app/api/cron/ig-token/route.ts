import { refreshStoredTokens } from "@/lib/ig/auth";
import { authorized } from "@/lib/ig/http";
import { logEvent } from "@/lib/ig/store";

export const maxDuration = 30;

async function run(req: Request) {
  if (!authorized(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  await logEvent("info", "token_refresh", "refresh diário iniciado");
  try {
    const result = await refreshStoredTokens();
    await logEvent("info", "token_refresh", result.refreshed ? "token renovado" : "token válido", result);
    return Response.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "falhou";
    await logEvent("error", "token_refresh", message);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}

export const GET = run;
export const POST = run;
