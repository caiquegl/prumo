"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { IgModal } from "./IgModal";
import {
  mediaKindLabel,
  QueueMedia,
  slideUrls,
  STATUS_LABEL,
  type QueuePost,
} from "./media";

export default function PostsPage() {
  const router = useRouter();
  const [posts, setPosts] = useState<QueuePost[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [caption, setCaption] = useState("");
  const [tags, setTags] = useState("prumoweb, singlepage, landingpage");
  const [error, setError] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [publishingId, setPublishingId] = useState<number | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);

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

  const openPost = posts.find((p) => p.id === openId) || null;
  const busy = publishingId != null || deletingId != null;

  async function onUpload(e: FormEvent) {
    e.preventDefault();
    if (!files.length) return;
    setUploading(true);
    setError("");
    try {
      const form = new FormData();
      for (const item of files) form.append("file", item);
      if (caption.trim()) form.set("caption", caption.trim());
      if (tags.trim()) form.set("tags", tags.trim());
      const res = await fetch("/api/posts", { method: "POST", body: form });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(json.error || "Upload falhou");
        return;
      }
      setFiles([]);
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

  async function onPublish(id: number, republish = false) {
    const msg = republish
      ? `Republicar o post #${id} no Instagram agora? Isso cria um post novo.`
      : `Publicar o post #${id} no Instagram agora?`;
    if (!confirm(msg)) return;
    setError("");
    setPublishingId(id);
    setPosts((curr) => curr.map((item) => (item.id === id ? { ...item, status: "publishing" } : item)));
    try {
      const qs = republish ? "?republish=1" : "";
      const res = await fetch(`/api/posts/${id}/publish${qs}`, { method: "POST" });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(json.error || "Falha ao publicar");
        await load();
        return;
      }
      await load();
    } catch {
      setError("Erro de rede ao publicar");
      await load();
    } finally {
      setPublishingId(null);
    }
  }

  async function onDelete(id: number) {
    if (!confirm(`Apagar post #${id} da fila?`)) return;
    setError("");
    setDeletingId(id);
    try {
      const res = await fetch(`/api/posts/${id}`, { method: "DELETE" });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(json.error || "Falha ao apagar");
        return;
      }
      setPosts((curr) => curr.filter((item) => item.id !== id));
      if (openId === id) setOpenId(null);
    } catch {
      setError("Erro de rede ao apagar");
    } finally {
      setDeletingId(null);
    }
  }

  async function onSave(id: number, nextCaption: string, nextTags: string[]) {
    const res = await fetch(`/api/posts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ caption: nextCaption, tags: nextTags }),
    });
    const json = (await res.json()) as { error?: string; post?: QueuePost };
    if (!res.ok) throw new Error(json.error || "Falha ao salvar");
    if (json.post) {
      setPosts((curr) => curr.map((item) => (item.id === id ? { ...item, ...json.post } : item)));
    }
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
            Clique no card para ver como fica no Instagram, editar legenda e hashtags, publicar ou republicar.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {posts.some((item) => item.status === "pending" || item.status === "failed") ? (
            <button
              type="button"
              onClick={() => {
                const next = posts.find((item) => item.status === "pending" || item.status === "failed");
                if (next) void onPublish(next.id);
              }}
              disabled={busy}
              className="rounded-full bg-[color:var(--ink)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[color:var(--coral)] disabled:opacity-60"
            >
              {publishingId != null ? "Publicando…" : "Publicar"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void onLogout()}
            className="rounded-full border border-[color:var(--line)] px-4 py-2 text-sm font-semibold text-[color:var(--ink-soft)] hover:text-[color:var(--ink)]"
          >
            Sair
          </button>
        </div>
      </div>

      <form
        onSubmit={(e) => void onUpload(e)}
        className="mt-10 rounded-2xl border border-[color:var(--line)] bg-white/70 p-5 md:p-6"
      >
        <h2 className="text-lg font-semibold">Novo post</h2>
        <div className="mt-4 grid gap-4">
          <label className="flex flex-col gap-2 text-sm font-medium">
            Arquivo (uma foto/vídeo, ou várias fotos para carrossel)
            <input
              id="post-file"
              type="file"
              multiple
              accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/quicktime,video/webm"
              onChange={(e) => setFiles(Array.from(e.target.files || []))}
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
          <button type="submit" disabled={!files.length || uploading} className="wa-btn disabled:opacity-50">
            {uploading ? "Enviando…" : "Adicionar à fila"}
          </button>
          {files.length ? (
            <span className="text-sm text-[color:var(--ink-soft)]">
              {files.length > 1 ? `🎠 ${files.length} fotos (carrossel)` : files[0]!.type.startsWith("video/") ? "🎬" : "🖼"}{" "}
              {files.length === 1 ? `${files[0]!.name} · ${(files[0]!.size / 1024).toFixed(0)} KB` : null}
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
              className="cursor-pointer overflow-hidden rounded-2xl border border-[color:var(--line)] bg-white/80 shadow-[0_1px_0_rgba(26,25,23,0.04)]"
              onClick={() => setOpenId(p.id)}
            >
              <div className="relative aspect-[4/5] bg-[color:var(--bg-deep)]">
                <QueueMedia post={p} />
                <span className="absolute left-3 top-3 z-20 rounded-full bg-black/65 px-2.5 py-1 text-xs font-semibold text-white">
                  #{p.sort_order} · {mediaKindLabel(p.media_type, slideUrls(p).length)} · {STATUS_LABEL[p.status] || p.status}
                </span>
                <div className="absolute right-3 top-3 z-30 flex flex-col items-end gap-1.5">
                  {p.status === "pending" || p.status === "failed" || p.status === "publishing" ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void onPublish(p.id);
                      }}
                      disabled={publishingId === p.id || deletingId === p.id || p.status === "publishing"}
                      className="rounded-full bg-[#141210] px-3.5 py-1.5 text-xs font-bold text-white shadow-md hover:bg-[#c45a48] disabled:opacity-60"
                    >
                      {publishingId === p.id || p.status === "publishing" ? "Publicando…" : "Publicar"}
                    </button>
                  ) : null}
                  {p.status === "published" ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void onPublish(p.id, true);
                      }}
                      disabled={publishingId === p.id || deletingId === p.id}
                      className="rounded-full bg-[#141210] px-3.5 py-1.5 text-xs font-bold text-white shadow-md hover:bg-[#c45a48] disabled:opacity-60"
                    >
                      {publishingId === p.id ? "Publicando…" : "Republicar"}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void onDelete(p.id);
                    }}
                    disabled={deletingId === p.id || publishingId === p.id}
                    className="rounded-full bg-[#c45a48] px-3.5 py-1.5 text-xs font-bold text-white shadow-md hover:bg-[#a84838] disabled:opacity-60"
                  >
                    {deletingId === p.id ? "Apagando…" : "Apagar"}
                  </button>
                </div>
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
                    onClick={(e) => e.stopPropagation()}
                    className="text-xs font-semibold text-[color:var(--coral-deep)]"
                  >
                    Ver no Instagram
                  </a>
                ) : null}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs text-[color:var(--ink-soft)]">
                    {new Date(p.created_at).toLocaleString("pt-BR")}
                  </span>
                  <div className="flex gap-2">
                    {p.status === "pending" || p.status === "failed" || p.status === "publishing" ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void onPublish(p.id);
                        }}
                        disabled={publishingId === p.id || deletingId === p.id || p.status === "publishing"}
                        className="rounded-full bg-[color:var(--ink)] px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
                      >
                        {publishingId === p.id || p.status === "publishing" ? "Publicando…" : "Publicar"}
                      </button>
                    ) : null}
                    {p.status === "published" ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void onPublish(p.id, true);
                        }}
                        disabled={publishingId === p.id || deletingId === p.id}
                        className="rounded-full bg-[color:var(--ink)] px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
                      >
                        {publishingId === p.id ? "Publicando…" : "Republicar"}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void onDelete(p.id);
                      }}
                      disabled={deletingId === p.id || publishingId === p.id}
                      className="rounded-full bg-[color:var(--coral-deep)] px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
                    >
                      {deletingId === p.id ? "Apagando…" : "Apagar"}
                    </button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {openPost ? (
        <IgModal
          post={openPost}
          busy={busy}
          onClose={() => setOpenId(null)}
          onSave={(nextCaption, nextTags) => onSave(openPost.id, nextCaption, nextTags)}
          onPublish={() => void onPublish(openPost.id)}
          onRepublish={() => void onPublish(openPost.id, true)}
          onDelete={() => void onDelete(openPost.id)}
        />
      ) : null}
    </main>
  );
}
