/** Helpers de sessão seguros para Edge (middleware). Sem node:crypto. */

export const ADMIN_COOKIE = "prumo_admin";

function sessionSecret() {
  return (
    process.env.ADMIN_SESSION_SECRET ||
    process.env.ADMIN_PASSWORD ||
    process.env.CRON_SECRET ||
    ""
  );
}

function b64urlFromBytes(bytes: ArrayBuffer) {
  const bin = String.fromCharCode(...new Uint8Array(bytes));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeB64urlJson(payload: string): { exp?: number } {
  const pad = payload.length % 4 === 0 ? "" : "=".repeat(4 - (payload.length % 4));
  const raw = atob(payload.replace(/-/g, "+").replace(/_/g, "/") + pad);
  return JSON.parse(raw) as { exp?: number };
}

export async function verifySessionTokenEdge(token: string | undefined | null): Promise<boolean> {
  if (!token || !token.includes(".")) return false;
  const secret = sessionSecret();
  if (!secret) return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
    const expected = b64urlFromBytes(mac);
    if (expected.length !== sig.length) return false;
    let ok = true;
    for (let i = 0; i < expected.length; i++) ok = ok && expected[i] === sig[i];
    if (!ok) return false;
    const parsed = decodeB64urlJson(payload);
    if (!parsed.exp || parsed.exp * 1000 < Date.now()) return false;
    return true;
  } catch {
    return false;
  }
}
