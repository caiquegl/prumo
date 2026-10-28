import { Suspense } from "react";

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<main className="p-10 text-center">Carregando…</main>}>{children}</Suspense>;
}
