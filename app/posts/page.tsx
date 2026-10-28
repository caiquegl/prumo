"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type QueuePost = {
  id: number;
  image_url: string;
  caption: string | null;
  tags: string[] | null;
  media_type: "image" | "video";
  status: string;
  sort_order: number;
  permalink: string | null;
  created_at: string;
  error: string | null;
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Na fila",
  publishing: "Publicando",
  published: "Publicado",
  failed: "Falhou",
};

export default function PostsPage() {
  const router = useRouter();
  const [posts, setPosts] = useState<QueuePost[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [caption, setCaption] = useState("");
  const [tags, setTags] = useState("prumoweb, singlepage, landingpage");
  const [error, setError] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const load = useCallback(async () => {
    setError("");
    const res = await fetch("/api/posts");
    if (res.status === 401) {
      router.replace("/login?next=/posts");
      return;
    }
    const json = (await res.json()) as { posts?: QueuePost[]; error?: string };
    if (!res.ok) {
      setError(json.error || "Falha ao listar");
      return;
    }
    setPosts(json.posts || []);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onUpload(e: FormEvent) {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const form = new FormData();
      form.set("file", file);
      if (caption.trim()) form.set("caption", caption.trim());
      if (tags.trim()) form.set("tags", tags.trim());
      const res = await fetch("/api/posts", { method: "POST", body: form });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(json.error || "Upload falhou");
        return;
      }
      setFile(null);
      setCaption("");
      const input = document.getElementById("post-file") as HTMLInputElement | null;
      if (input) input.value = "";
      await load();
    } catch {
      setError("Erro de rede no upload");
    } finally {
      setUploading(false);
    }
  }

  async function onDelete(id: number) {
    if (!confirm(`Apagar post #${id} da fila?`)) return;
    setError("");
    const res = await fetch(`/api/posts/${id}`, { method: "DELETE" });
    const json = (await res.json()) as { error?: string };
    if (!res.ok) {
      setError(json.error || "Falha ao apagar");
      return;
    }
    await load();
  }

  async function onLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-5 py-10 md:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold tracking-[0.2em] text-[color:var(--ink-soft)]">FILA IG</p>
          <h1 className="display mt-2 text-4xl md:text-5xl">Posts</h1>
          <p className="mt-2 max-w-xl text-[color:var(--ink-soft)]">
            Foto ou vídeo + legenda e tags. O worker publica os <strong>pending</strong> em ordem.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void onLogout()}
          className="rounded-full border border-[color:var(--line)] px-4 py-2 text-sm font-semibold text-[color:var(--ink-soft)] hover:text-[color:var(--ink)]"
        >
          Sair
        </button>
      </div>

      <form
        onSubmit={(e) => void onUpload(e)}
        className="mt-10 rounded-2xl border border-[color:var(--line)] bg-white/70 p-5 md:p-6"
      >
        <h2 className="text-lg font-semibold">Novo post</h2>
        <div className="mt-4 grid gap-4">
          <label className="flex flex-col gap-2 text-sm font-medium">
            Arquivo (imagem ou vídeo mp4)
            <input
              id="post-file"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/quicktime,video/webm"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="rounded-xl border border-[color:var(--line)] bg-white px-3 py-2.5 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-[color:var(--bg-deep)] file:px-3 file:py-1.5 file:text-sm file:font-semibold"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium">
            Legenda
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={4}
              placeholder="Texto do Instagram (sem as hashtags, se preferir separá-las abaixo)…"
              className="rounded-xl border border-[color:var(--line)] bg-white px-3 py-2.5 text-sm outline-none ring-[color:var(--coral)] focus:ring-2"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium">
            Tags (separadas por vírgula)
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="prumoweb, singlepage, landingpage"
              className="rounded-xl border border-[color:var(--line)] bg-white px-3 py-2.5 text-sm outline-none ring-[color:var(--coral)] focus:ring-2"
            />
          </label>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button type="submit" disabled={!file || uploading} className="wa-btn disabled:opacity-50">
            {uploading ? "Enviando…" : "Adicionar à fila"}
          </button>
          {file ? (
            <span className="text-sm text-[color:var(--ink-soft)]">
              {file.type.startsWith("video/") ? "🎬" : "🖼"} {file.name} · {(file.size / 1024).toFixed(0)} KB
            </span>
          ) : null}
        </div>
        {error ? <p className="mt-3 text-sm text-[color:var(--coral-deep)]">{error}</p> : null}
      </form>

      <section className="mt-12">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-semibold">Na fila ({posts.length})</h2>
          <button
            type="button"
            onClick={() => void load()}
            className="text-sm font-semibold text-[color:var(--ink-soft)] hover:text-[color:var(--ink)]"
          >
            Atualizar
          </button>
        </div>

        {loading ? <p className="mt-6 text-[color:var(--ink-soft)]">Carregando…</p> : null}

        {!loading && posts.length === 0 ? (
          <p className="mt-6 rounded-2xl border border-dashed border-[color:var(--line)] px-5 py-10 text-center text-[color:var(--ink-soft)]">
            Nenhum post ainda. Envie a primeira arte acima.
          </p>
        ) : null}

        <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((p) => (
            <li
              key={p.id}
              className="overflow-hidden rounded-2xl border border-[color:var(--line)] bg-white/80 shadow-[0_1px_0_rgba(26,25,23,0.04)]"
            >
              <div className="relative aspect-[4/5] bg-[color:var(--bg-deep)]">
                {p.media_type === "video" ? (
                  <video src={p.image_url} className="h-full w-full object-cover" controls muted playsInline />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.image_url} alt="" className="h-full w-full object-cover" />
                )}
                <span className="absolute left-3 top-3 rounded-full bg-black/65 px-2.5 py-1 text-xs font-semibold text-white">
                  #{p.sort_order} · {p.media_type === "video" ? "vídeo" : "foto"} · {STATUS_LABEL[p.status] || p.status}
                </span>
              </div>
              <div className="flex flex-col gap-3 p-4">
                <p className="line-clamp-4 whitespace-pre-wrap text-sm text-[color:var(--ink-soft)]">
                  {p.caption || <em>Sem legenda</em>}
                </p>
                {p.tags?.length ? (
                  <p className="text-xs text-[color:var(--ink-soft)]">
                    {p.tags.map((t) => `#${t}`).join(" ")}
                  </p>
                ) : null}
                {p.error ? <p className="text-xs text-[color:var(--coral-deep)]">{p.error}</p> : null}
                {p.permalink ? (
                  <a
                    href={p.permalink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-semibold text-[color:var(--coral-deep)]"
                  >
                    Ver no Instagram
                  </a>
                ) : null}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-[color:var(--ink-soft)]">
                    {new Date(p.created_at).toLocaleString("pt-BR")}
                  </span>
                  <button
                    type="button"
                    onClick={() => void onDelete(p.id)}
                    className="rounded-lg px-3 py-1.5 text-sm font-semibold text-[color:var(--coral-deep)] hover:bg-[color:var(--bg-deep)]"
                  >
                    Apagar
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
