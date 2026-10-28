import { connection } from "next/server";
import { inspectToken, resolvePageToken } from "@/lib/ig/auth";
import { bank } from "@/lib/ig/content";
import { authorized } from "@/lib/ig/http";
import { account } from "@/lib/ig/publish";
import { getAuth, listLogs, listPublications, publicAuth } from "@/lib/ig/store";

export async function GET(req: Request) {
  await connection();
  if (!authorized(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let ig: Record<string, unknown> | null = null;
  let token: Record<string, unknown> | null = null;
  let error: string | null = null;
  try {
    const pageToken = await resolvePageToken();
    token = await inspectToken(pageToken);
    ig = await account();
  } catch (err) {
    error = err instanceof Error ? err.message : "falhou";
  }

  const auth = await getAuth().catch(() => null);
  const published = await listPublications(50).catch(() => []);
  const logs = await listLogs(30).catch(() => []);

  return Response.json({
    ok: !error,
    error,
    instagram: ig,
    token,
    auth: publicAuth(auth),
    bank: bank.length,
    published: published.length,
    last: published.at(-1) ?? null,
    publications: published.slice(-10).reverse(),
    logs,
    crons: ["07:00 token", "08:00 post", "12:00 post", "18:00 post"],
    timezone: "America/Sao_Paulo",
  });
}
