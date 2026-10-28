import { exchangeUserToken } from "@/lib/ig/auth";
import { authorized } from "@/lib/ig/http";
import { logEvent } from "@/lib/ig/store";

export async function POST(req: Request) {
  if (!authorized(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { user_token?: string };
  const short = body.user_token?.trim();
  if (!short) return Response.json({ error: "Envie { user_token } no body" }, { status: 400 });

  try {
    const result = await exchangeUserToken(short);
    await logEvent("info", "token_bootstrap", "user_token trocado e gravado no Neon", {
      page: result.page,
      page_id: result.page_id,
    });
    return Response.json({
      ok: true,
      stored: "neon",
      ...result,
      hint: "Token da Página e o de usuário (60 dias) ficaram no banco. O cron renova o de usuário sozinho.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "falhou";
    await logEvent("error", "token_bootstrap", message);
    return Response.json({ error: message }, { status: 400 });
  }
}

export async function GET() {
  return Response.json({
    ok: true,
    endpoint: "POST /api/ig/token",
    steps: [
      "App Meta da Prumo em https://developers.facebook.com/apps (não o Graph API Explorer genérico)",
      "META_APP_ID e META_APP_SECRET já na Vercel",
      "Graph Explorer: User Token com pages_show_list, pages_read_engagement, instagram_basic, instagram_content_publish, business_management",
      "POST { user_token } neste endpoint (Authorization: Bearer CRON_SECRET)",
      "O token da Página e o de usuário vão para o Neon — não precisa colar META_PAGE_TOKEN na Vercel",
    ],
  });
}
