/**
 * Orshot — render de templates com camadas via API.
 * Free: ~100 credits/mês. Usado como fallback quando ORSHOT_TEMPLATE_ID está setado,
 * ou para smoke-test da key.
 */

export type OrshotRenderInput = {
  templateId: string;
  modifications?: Record<string, { text?: string; image?: string; color?: string } | string>;
  format?: "png" | "jpg" | "webp";
};

export function orshotConfigured() {
  return Boolean(process.env.ORSHOT_API_KEY);
}

export function orshotTemplateId() {
  return process.env.ORSHOT_TEMPLATE_ID?.trim() || "";
}

export async function renderOrshot(input: OrshotRenderInput): Promise<Buffer | null> {
  const key = process.env.ORSHOT_API_KEY;
  if (!key || !input.templateId) return null;

  const body = {
    templateId: Number.isFinite(Number(input.templateId)) ? Number(input.templateId) : input.templateId,
    modifications: flattenMods(input.modifications || {}),
    response: { type: "base64", format: input.format || "png" },
  };

  const res = await fetch("https://api.orshot.com/v1/studio/render", {
    method: "POST",
    headers: {
      Authorization: BearerHdr(key),
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    console.error("[orshot] render failed", res.status, errText.slice(0, 400));
    return null;
  }

  const json = (await res.json()) as {
    data?: { content?: string; base64?: string; url?: string };
    content?: string;
  };
  const content = json.data?.content || json.content || json.data?.base64 || json.data?.url;
  if (!content) {
    console.error("[orshot] json sem content", JSON.stringify(json).slice(0, 300));
    return null;
  }
  if (content.startsWith("data:image")) {
    return Buffer.from(content.replace(/^data:image\/\w+;base64,/, ""), "base64");
  }
  if (/^https?:\/\//i.test(content)) {
    const img = await fetch(content);
    if (!img.ok) return null;
    return Buffer.from(await img.arrayBuffer());
  }
  // raw base64
  return Buffer.from(content, "base64");
}

function flattenMods(mods: OrshotRenderInput["modifications"]) {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(mods || {})) {
    if (typeof v === "string") out[k] = v;
    else if (v && typeof v === "object") {
      if (v.text) out[k] = v.text;
      else if (v.image) out[k] = v.image;
      else if (v.color) out[k] = v.color;
    }
  }
  return out;
}

function BearerHdr(key: string) {
  return key.startsWith("Bearer ") ? key : `Bearer ${key}`;
}

/** Smoke: confirma que a key responde (mesmo sem template válido). */
export async function pingOrshot(): Promise<{ ok: boolean; status: number; body: string }> {
  const key = process.env.ORSHOT_API_KEY;
  if (!key) return { ok: false, status: 0, body: "ORSHOT_API_KEY ausente" };
  const res = await fetch("https://api.orshot.com/v1/studio/render", {
    method: "POST",
    headers: { Authorization: BearerHdr(key), "Content-Type": "application/json" },
    body: JSON.stringify({ format: "png" }),
  });
  const body = (await res.text()).slice(0, 400);
  return { ok: res.status !== 401 && res.status !== 403, status: res.status, body };
}
