import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const ADMIN_COOKIE = "prumo_admin";
const MAX_AGE_SEC = 60 * 60 * 24 * 14; // 14 dias

function sessionSecret() {
  return (
    process.env.ADMIN_SESSION_SECRET ||
    process.env.ADMIN_PASSWORD ||
    process.env.CRON_SECRET ||
    ""
  );
}

export function adminPasswordConfigured() {
  return Boolean(process.env.ADMIN_PASSWORD?.trim());
}

export function verifyPassword(password: string) {
  const expected = process.env.ADMIN_PASSWORD || "";
  if (!expected) return false;
  const a = Buffer.from(password);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function sign(payload: string) {
  const secret = sessionSecret();
  if (!secret) throw new Error("ADMIN_SESSION_SECRET ou ADMIN_PASSWORD ausente");
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createSessionToken() {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE_SEC;
  const payload = Buffer.from(JSON.stringify({ exp, v: 1 }), "utf8").toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string | undefined | null): boolean {
  if (!token || !token.includes(".")) return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;
  try {
    const expected = sign(payload);
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
    const json = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { exp?: number };
    if (!json.exp || json.exp * 1000 < Date.now()) return false;
    return true;
  } catch {
    return false;
  }
}

export async function isAdminRequest() {
  const jar = await cookies();
  return verifySessionToken(jar.get(ADMIN_COOKIE)?.value);
}

export function sessionCookieOptions(token: string) {
  return {
    name: ADMIN_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: MAX_AGE_SEC,
  };
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

/** Edge-safe check for middleware (Web Crypto). */
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
