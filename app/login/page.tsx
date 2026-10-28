"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/posts";
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(json.error || "Falha no login");
        return;
      }
      router.replace(next.startsWith("/") ? next : "/posts");
      router.refresh();
    } catch {
      setError("Erro de rede");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-16">
      <p className="text-sm font-semibold tracking-[0.2em] text-[color:var(--ink-soft)]">PRUMO · ADMIN</p>
      <h1 className="display mt-3 text-4xl text-[color:var(--ink)]">Entrar</h1>
      <p className="mt-3 text-[color:var(--ink-soft)]">Acesse a fila de posts do Instagram.</p>

      <form onSubmit={onSubmit} className="mt-10 flex flex-col gap-4">
        <label className="flex flex-col gap-2 text-sm font-medium">
          Senha
          <input
            type="password"
            autoFocus
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-xl border border-[color:var(--line)] bg-white px-4 py-3 text-base outline-none ring-[color:var(--coral)] focus:ring-2"
          />
        </label>
        {error ? <p className="text-sm text-[color:var(--coral-deep)]">{error}</p> : null}
        <button
          type="submit"
          disabled={loading || !password}
          className="wa-btn mt-2 disabled:opacity-50"
        >
          {loading ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </main>
  );
}
