import { NextRequest } from "next/server";
import { isAdminRequest, verifyPassword } from "./auth";

/**
 * Aceita sessão cookie (UI) OU Bearer com ADMIN_PASSWORD / QUEUE_API_SECRET (agente/API).
 */
export async function requireAdmin(req?: NextRequest): Promise<boolean> {
  if (await isAdminRequest()) return true;
  if (!req) return false;

  const header = req.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return false;

  const queueSecret = process.env.QUEUE_API_SECRET?.trim();
  if (queueSecret && token === queueSecret) return true;

  // permite Bearer = ADMIN_PASSWORD para o agente subir posts
  if (verifyPassword(token)) return true;

  return false;
}
