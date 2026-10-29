"use client";

import { FormEvent, PointerEvent, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type QueuePost = {
  id: number;
  image_url: string;
  caption: string | null;
  tags: string[] | null;
  media_type: "image" | "video" | "carousel";
  children: string[] | null;
  status: string;
  sort_order: number;
  permalink: string | null;
  created_at: string;
  error: string | null;
};

function mediaKindLabel(type: QueuePost["media_type"], count = 1) {
  if (type === "video") return "vídeo";
  if (type === "carousel") return `carrossel · ${count} fotos`;
  return "foto";
}

function slideUrls(post: QueuePost) {
  let kids: string[] = [];
  if (Array.isArray(post.children)) kids = post.children.map(String).filter(Boolean);
  else if (typeof post.children === "string") {
    try {
      const parsed = JSON.parse(post.children) as unknown;
      if (Array.isArray(parsed)) kids = parsed.map(String).filter(Boolean);
    } catch {
      kids = [];
    }
  }
  if (post.media_type === "carousel" && kids.length >= 2) return kids;
  return post.image_url ? [post.image_url] : [];
}

function QueueMedia({ post }: { post: QueuePost }) {
  const urls = slideUrls(post);
  const [index, setIndex] = useState(0);
  const startX = useRef<number | null>(null);

  useEffect(() => {
    setIndex(0);
  }, [post.id]);

  const go = (next: number) => {
    if (!urls.length) return;
    setIndex((next + urls.length) % urls.length);
  };

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    startX.current = e.clientX;
  }
  function onPointerUp(e: PointerEvent<HTMLDivElement>) {
    if (startX.current == null) return;
    const delta = e.clientX - startX.current;
    startX.current = null;
    if (delta > 40) go(index - 1);
    if (delta < -40) go(index + 1);
  }

  if (post.media_type === "video") {
    return <video src={post.image_url} className="h-full w-full object-cover" controls muted playsInline />;
  }

  const src = urls[index] || post.image_url;
  const carousel = urls.length > 1;

  return (
    <div
      className="relative h-full w-full select-none"
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className="h-full w-full object-cover" draggable={false} />
      {carousel ? (
        <>
          <button
            type="button"
            aria-label="Slide anterior"
            onClick={() => go(index - 1)}
            className="absolute left-2 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white"
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Próximo slide"
            onClick={() => go(index + 1)}
            className="absolute right-2 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white"
          >
            ›
          </button>
          <div className="absolute bottom-3 left-0 right-0 z-10 flex justify-center gap-1.5">
            {urls.map((url, i) => (
              <button
                key={url}
                type="button"
                aria-label={`Slide ${i + 1}`}
                onClick={() => setIndex(i)}
                className={`h-1.5 rounded-full ${i === index ? "w-5 bg-white" : "w-1.5 bg-white/50"}`}
              />
            ))}
          </div>
          <span className="absolute right-3 top-12 rounded-full bg-black/65 px-2 py-0.5 text-[11px] font-semibold text-white">
            {index + 1}/{urls.length}
          </span>
        </>
      ) : null}
    </div>
  );
}

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
  const [files, setFiles] = useState<File[]>([]);
  const [deletingId, setDeletingId] = useState<number | null>(null);

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
    } catch {
      setError("Erro de rede ao apagar");
    } finally {
      setDeletingId(null);
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
            Foto, vídeo ou carrossel + legenda e tags. O worker publica os <strong>pending</strong> em ordem.
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
              className="overflow-hidden rounded-2xl border border-[color:var(--line)] bg-white/80 shadow-[0_1px_0_rgba(26,25,23,0.04)]"
            >
              <div className="relative aspect-[4/5] bg-[color:var(--bg-deep)]">
                <QueueMedia post={p} />
                <span className="absolute left-3 top-3 z-20 rounded-full bg-black/65 px-2.5 py-1 text-xs font-semibold text-white">
                  #{p.sort_order} · {mediaKindLabel(p.media_type, slideUrls(p).length)} · {STATUS_LABEL[p.status] || p.status}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    void onDelete(p.id);
                  }}
                  disabled={deletingId === p.id}
                  className="absolute right-3 top-3 z-30 rounded-full bg-[#c45a48] px-3.5 py-1.5 text-xs font-bold text-white shadow-md hover:bg-[#a84838] disabled:opacity-60"
                >
                  {deletingId === p.id ? "Apagando…" : "Apagar"}
                </button>
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
                    disabled={deletingId === p.id}
                    className="rounded-full bg-[color:var(--coral-deep)] px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
                  >
                    {deletingId === p.id ? "Apagando…" : "Apagar"}
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
