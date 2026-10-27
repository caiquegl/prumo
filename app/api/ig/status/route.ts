import { connection } from "next/server";
import { account, debugToken } from "@/lib/ig/publish";
import { bank } from "@/lib/ig/content";
import { readState } from "@/lib/ig/state";

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const header = req.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const query = new URL(req.url).searchParams.get("secret") || "";
  return token === secret || query === secret;
}

export async function GET(req: Request) {
  await connection();
  if (!authorized(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const blob = await readState().catch(() => ({ published: [] }));
  let ig: Record<string, unknown> | null = null;
  let token: Record<string, unknown> | null = null;
  let error: string | null = null;
  try {
    ig = await account();
    token = await debugToken();
  } catch (err) {
    error = err instanceof Error ? err.message : "falhou";
  }
  return Response.json({
    ok: !error,
    error,
    instagram: ig,
    token,
    bank: bank.length,
    published: blob.published.length,
    last: blob.published.at(-1) ?? null,
    crons: ["08:00", "12:00", "18:00"],
    timezone: "America/Sao_Paulo",
  });
}
