const API = "https://graph.facebook.com/v26.0";

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  const header = req.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const query = new URL(req.url).searchParams.get("secret") || "";
  return token === secret || query === secret;
}

type Graph = Record<string, unknown> & { error?: { message?: string } };

async function graph(path: string, params: Record<string, string>) {
  const qs = new URLSearchParams(params);
  const res = await fetch(`${API}/${path}?${qs}`);
  const json = (await res.json()) as Graph;
  if (!res.ok || json.error) throw new Error(json.error?.message || JSON.stringify(json));
  return json;
}

/**
 * Troca um token de usuário de 1–2h por um token de Página que não expira.
 * Body JSON: { "user_token": "EAAB..." }
 */
export async function POST(req: Request) {
  if (!authorized(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) {
    return Response.json(
      { error: "Defina META_APP_ID e META_APP_SECRET no .env da Vercel (App Meta → Configurações → Básico)." },
      { status: 400 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as { user_token?: string };
  const short = body.user_token?.trim();
  if (!short) return Response.json({ error: "Envie { user_token } no body" }, { status: 400 });

  const longLived = await graph("oauth/access_token", {
    grant_type: "fb_exchange_token",
    client_id: appId,
    client_secret: appSecret,
    fb_exchange_token: short,
  });
  const userToken = String(longLived.access_token || "");

  const accounts = (await graph("me/accounts", {
    fields: "id,name,access_token,instagram_business_account",
    access_token: userToken,
  })) as {
    data?: Array<{
      id: string;
      name: string;
      access_token: string;
      instagram_business_account?: { id: string };
    }>;
  };

  const page =
    accounts.data?.find((p) => p.instagram_business_account?.id) ||
    accounts.data?.find((p) => /prumo/i.test(p.name));
  if (!page?.access_token) {
    return Response.json({ error: "Nenhuma Página com Instagram profissional encontrada nesta conta." }, { status: 400 });
  }

  return Response.json({
    ok: true,
    page: page.name,
    page_id: page.id,
    ig_user_id: page.instagram_business_account?.id,
    expires: "token de Página obtido de token de usuário de 60 dias — em geral não expira",
    META_PAGE_TOKEN: page.access_token,
    hint: "Cole META_PAGE_TOKEN e IG_USER_ID no .env da Vercel (Production). Não commite.",
  });
}

export async function GET() {
  return Response.json({
    ok: true,
    endpoint: "POST /api/ig/token",
    steps: [
      "Crie (ou abra) o app em https://developers.facebook.com/apps",
      "Copie App ID e App Secret → META_APP_ID / META_APP_SECRET na Vercel",
      "Em https://developers.facebook.com/tools/explorer gere um User token com: pages_show_list, pages_read_engagement, instagram_basic, instagram_content_publish, business_management",
      "POST { user_token } neste endpoint (Authorization: Bearer CRON_SECRET)",
      "Cole o META_PAGE_TOKEN retornado no .env da Vercel",
    ],
  });
}
