import { NextRequest, NextResponse } from "next/server";
import {
  adminPasswordConfigured,
  createSessionToken,
  sessionCookieOptions,
  verifyPassword,
} from "@/lib/admin/auth";

export async function POST(req: NextRequest) {
  if (!adminPasswordConfigured()) {
    return NextResponse.json(
      { error: "Defina ADMIN_PASSWORD na Vercel para ativar o login." },
      { status: 503 },
    );
  }

  let password = "";
  const ctype = req.headers.get("content-type") || "";
  if (ctype.includes("application/json")) {
    const body = (await req.json()) as { password?: string };
    password = String(body.password || "");
  } else {
    const form = await req.formData();
    password = String(form.get("password") || "");
  }

  if (!verifyPassword(password)) {
    return NextResponse.json({ error: "Senha incorreta" }, { status: 401 });
  }

  const token = createSessionToken();
  const res = NextResponse.json({ ok: true });
  const opts = sessionCookieOptions(token);
  res.cookies.set(opts);
  return res;
}
