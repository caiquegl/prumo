const API = "https://graph.facebook.com/v26.0";

type GraphError = { error?: { message?: string; code?: number; type?: string } };

async function call(method: "GET" | "POST", path: string, params: Record<string, string>) {
  const token = process.env.META_PAGE_TOKEN;
  if (!token) throw new Error("META_PAGE_TOKEN não configurado");
  const body = new URLSearchParams({ ...params, access_token: token });
  const res =
    method === "GET"
      ? await fetch(`${API}/${path}?${body}`)
      : await fetch(`${API}/${path}`, { method, body });
  const json = (await res.json()) as GraphError & Record<string, string>;
  if (!res.ok || json.error) {
    throw new Error(`${method} ${path} -> ${res.status}: ${JSON.stringify(json.error ?? json)}`);
  }
  return json;
}

export function igUserId() {
  return process.env.IG_USER_ID || "17841427877735853";
}

export async function account() {
  return call("GET", igUserId(), { fields: "username,media_count" });
}

export async function recentCaptions(limit = 40) {
  const json = await call("GET", `${igUserId()}/media`, {
    fields: "caption,timestamp",
    limit: String(limit),
  });
  const data = (json as { data?: Array<{ caption?: string }> }).data ?? [];
  return data.map((m) => m.caption || "");
}

export async function publishImage(imageUrl: string, caption: string) {
  const igId = igUserId();
  const { id: container } = await call("POST", `${igId}/media`, { image_url: imageUrl, caption });
  for (let i = 0; i < 36; i++) {
    const { status_code, status } = await call("GET", container, { fields: "status_code,status" });
    if (status_code === "FINISHED") break;
    if (status_code === "ERROR" || status_code === "EXPIRED") {
      throw new Error(`container ${container}: ${status}`);
    }
    if (i === 35) throw new Error(`container ${container} não ficou pronto a tempo`);
    await new Promise((r) => setTimeout(r, 2500));
  }
  const { id } = await call("POST", `${igId}/media_publish`, { creation_id: container });
  const { permalink } = await call("GET", id, { fields: "permalink" });
  return { id, permalink };
}

export async function debugToken() {
  const token = process.env.META_PAGE_TOKEN;
  if (!token) throw new Error("META_PAGE_TOKEN não configurado");
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) {
    const json = await call("GET", igUserId(), { fields: "username,media_count" });
    return { ok: true, username: json.username, note: "sem META_APP_ID/SECRET para inspecionar validade" };
  }
  const res = await fetch(
    `${API}/debug_token?input_token=${encodeURIComponent(token)}&access_token=${encodeURIComponent(`${appId}|${appSecret}`)}`,
  );
  const json = (await res.json()) as {
    data?: { is_valid?: boolean; expires_at?: number; type?: string; scopes?: string[] };
    error?: unknown;
  };
  if (json.error) throw new Error(JSON.stringify(json.error));
  const expiresAt = json.data?.expires_at ?? 0;
  return {
    ok: json.data?.is_valid === true,
    type: json.data?.type,
    expires_at: expiresAt ? new Date(expiresAt * 1000).toISOString() : "never",
    scopes: json.data?.scopes,
  };
}
