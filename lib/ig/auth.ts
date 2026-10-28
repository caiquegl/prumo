import { getAuth, saveAuth } from "./store";

const API = "https://graph.facebook.com/v26.0";

type Graph = Record<string, unknown> & { error?: { message?: string; code?: number } };

let cachedPageToken: string | null = null;

export function cachePageToken(token: string | null) {
  cachedPageToken = token;
}

async function graph(path: string, params: Record<string, string>) {
  const qs = new URLSearchParams(params);
  const res = await fetch(`${API}/${path}?${qs}`);
  const json = (await res.json()) as Graph;
  if (!res.ok || json.error) throw new Error(json.error?.message || JSON.stringify(json));
  return json;
}

export async function inspectToken(token: string) {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) {
    return { ok: false as const, note: "sem META_APP_ID/SECRET para inspecionar validade" };
  }
  const json = (await graph("debug_token", {
    input_token: token,
    access_token: `${appId}|${appSecret}`,
  })) as {
    data?: { is_valid?: boolean; expires_at?: number; type?: string; scopes?: string[]; data_access_expires_at?: number };
  };
  const expiresAt = json.data?.expires_at ?? 0;
  return {
    ok: json.data?.is_valid === true,
    type: json.data?.type,
    expires_at: expiresAt ? new Date(expiresAt * 1000).toISOString() : "never",
    expiresAtDate: expiresAt ? new Date(expiresAt * 1000) : null,
    scopes: json.data?.scopes,
  };
}

export async function exchangeUserToken(userToken: string) {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) {
    throw new Error("Defina META_APP_ID e META_APP_SECRET na Vercel para renovar o token.");
  }

  const longLived = await graph("oauth/access_token", {
    grant_type: "fb_exchange_token",
    client_id: appId,
    client_secret: appSecret,
    fb_exchange_token: userToken,
  });
  const longUserToken = String(longLived.access_token || "");
  const expiresIn = Number(longLived.expires_in || 0);
  if (!longUserToken) throw new Error("Meta não devolveu access_token no exchange.");

  const accounts = (await graph("me/accounts", {
    fields: "id,name,access_token,instagram_business_account",
    access_token: longUserToken,
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
    throw new Error("Nenhuma Página com Instagram profissional encontrada nesta conta.");
  }

  const pageInfo = await inspectToken(page.access_token).catch(() => null);
  const userExpiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000) : new Date(Date.now() + 60 * 24 * 3600 * 1000);

  await saveAuth({
    pageToken: page.access_token,
    userToken: longUserToken,
    pageId: page.id,
    igUserId: page.instagram_business_account?.id,
    pageName: page.name,
    userExpiresAt,
    pageExpiresAt: pageInfo?.expiresAtDate ?? null,
  });
  cachePageToken(page.access_token);

  return {
    page: page.name,
    page_id: page.id,
    ig_user_id: page.instagram_business_account?.id,
    user_expires_at: userExpiresAt.toISOString(),
    page_expires_at: pageInfo?.expires_at ?? "never",
  };
}

export async function resolvePageToken() {
  if (cachedPageToken) return cachedPageToken;
  const auth = await getAuth();
  const token = auth?.page_token || process.env.META_PAGE_TOKEN || "";
  if (!token) throw new Error("Nenhum token da Página. POST /api/ig/token com um user_token do Graph Explorer.");
  cachedPageToken = token;
  return token;
}

export async function refreshStoredTokens() {
  const auth = await getAuth();
  const userToken = auth?.user_token;
  if (userToken) {
    const result = await exchangeUserToken(userToken);
    return { refreshed: true as const, source: "user_token" as const, ...result };
  }

  const pageToken = auth?.page_token || process.env.META_PAGE_TOKEN;
  if (!pageToken) {
    throw new Error("Sem user_token no banco e sem META_PAGE_TOKEN. Faça o bootstrap em POST /api/ig/token.");
  }

  const info = await inspectToken(pageToken);
  if (!info.ok) {
    throw new Error(
      "Token da Página inválido/expirado e não há user_token para renovar. Gere um User token no Graph Explorer e envie em POST /api/ig/token.",
    );
  }

  if (!auth?.page_token && process.env.META_PAGE_TOKEN) {
    await saveAuth({
      pageToken: process.env.META_PAGE_TOKEN,
      pageExpiresAt: info.expiresAtDate ?? null,
    });
  }

  cachePageToken(pageToken);
  return {
    refreshed: false as const,
    source: "page_token" as const,
    page_expires_at: info.expires_at,
    valid: true,
  };
}
