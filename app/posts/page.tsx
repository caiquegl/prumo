"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { IgModal } from "./IgModal";
import {
  mediaKindLabel,
  QueueMedia,
  slideUrls,
  STATUS_LABEL,
  type QueuePost,
} from "./media";

type MainTab = "reels" | "stories" | "posts";
type PubFilter = "all" | "unpublished" | "published";

const MAIN_TABS: Array<{ id: MainTab; label: string; types: Array<QueuePost["media_type"]> }> = [
  { id: "reels", label: "Reels", types: ["video"] },
  { id: "stories", label: "Stories", types: ["story"] },
  { id: "posts", label: "Posts", types: ["image", "carousel"] },
];

function typeAccent(type: QueuePost["media_type"]) {
  if (type === "story") return "bg-[#7c3aed]";
  if (type === "video") return "bg-[#c45a48]";
  if (type === "carousel") return "bg-[#1d4ed8]";
  return "bg-[#141210]";
}

function isPublished(p: QueuePost) {
  return p.status === "published";
}

export default function PostsPage() {
  const router = useRouter();
  const [posts, setPosts] = useState<QueuePost[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [caption, setCaption] = useState("");
  const [tags, setTags] = useState(
    "webprumo, siteparaempresa, criacaodesites, landingpagebrasil, pequenosnegocios",
  );
  const [error, setError] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [publishingId, setPublishingId] = useState<number | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const [tab, setTab] = useState<MainTab>("reels");
  const [pubFilter, setPubFilter] = useState<PubFilter>("unpublished");

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

  const counts = useMemo(() => {
    const out: Record<MainTab, { all: number; unpublished: number; published: number }> = {
      reels: { all: 0, unpublished: 0, published: 0 },
      stories: { all: 0, unpublished: 0, published: 0 },
      posts: { all: 0, unpublished: 0, published: 0 },
    };
    for (const p of posts) {
      const main =
        p.media_type === "video" ? "reels" : p.media_type === "story" ? "stories" : "posts";
      out[main].all += 1;
      if (isPublished(p)) out[main].published += 1;
      else out[main].unpublished += 1;
    }
    return out;
  }, [posts]);

  const activeTypes = MAIN_TABS.find((t) => t.id === tab)!.types;

  const filtered = useMemo(() => {
    return posts.filter((p) => {
      if (!activeTypes.includes(p.media_type)) return false;
      if (pubFilter === "published" && !isPublished(p)) return false;
      if (pubFilter === "unpublished" && isPublished(p)) return false;
      return true;
    });
  }, [posts, activeTypes, pubFilter]);

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
      if (tab === "stories") form.set("asStory", "1");
      const res = await fetch("/api/posts", { method: "POST", body: form });
      const json = (await res.json()) as { error?: string; post?: QueuePost };
      if (!res.ok) {
        setError(json.error || "Upload falhou");
        return;
      }
      setFiles([]);
      setCaption("");
      const input = document.getElementById("post-file") as HTMLInputElement | null;
      if (input) input.value = "";
      if (json.post?.media_type === "video") setTab("reels");
      else if (json.post?.media_type === "story") setTab("stories");
      else setTab("posts");
      setPubFilter("unpublished");
      await load();
    } catch {
      setError("Erro de rede no upload");
    } finally {
      setUploading(false);
    }
  }

  async function onPublish(id: number, republish = false) {
    const msg = republish
      ? `Republicar #${id} no Instagram agora? Isso cria um post novo.`
      : `Publicar #${id} no Instagram agora?`;
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
    if (!confirm(`Apagar #${id} da fila?`)) return;
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

  const nextUnpublished = filtered.find(
    (item) => item.status === "pending" || item.status === "failed",
  );

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-5 py-10 md:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold tracking-[0.2em] text-[color:var(--ink-soft)]">FILA IG</p>
          <h1 className="display mt-2 text-4xl md:text-5xl">Conteúdo</h1>
          <p className="mt-2 max-w-xl text-[color:var(--ink-soft)]">
            Tabs por formato. Cron atual: 1 Reel/dia às 07:00 BRT.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/ig"
            className="rounded-full border border-[color:var(--line)] px-4 py-2 text-sm font-semibold text-[color:var(--ink-soft)] hover:text-[color:var(--ink)]"
          >
            Monitor
          </a>
          {nextUnpublished ? (
            <button
              type="button"
              onClick={() => void onPublish(nextUnpublished.id)}
              disabled={busy}
              className="rounded-full bg-[color:var(--ink)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[color:var(--coral)] disabled:opacity-60"
            >
              {publishingId != null ? "Publicando…" : "Publicar próximo"}
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

      {/* Main tabs */}
      <div className="mt-8 flex flex-wrap gap-2 border-b border-[color:var(--line)] pb-3">
        {MAIN_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-full px-5 py-2.5 text-sm font-bold transition ${
              tab === t.id
                ? "bg-[color:var(--ink)] text-white"
                : "text-[color:var(--ink-soft)] hover:bg-black/5 hover:text-[color:var(--ink)]"
            }`}
          >
            {t.label}
            <span className="ml-2 opacity-70">({counts[t.id].all})</span>
          </button>
        ))}
      </div>

      {/* Publish filters */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {(
          [
            ["unpublished", "Não publicados", counts[tab].unpublished],
            ["published", "Publicados", counts[tab].published],
            ["all", "Todos", counts[tab].all],
          ] as const
        ).map(([id, label, n]) => (
          <button
            key={id}
            type="button"
            onClick={() => setPubFilter(id)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold ${
              pubFilter === id
                ? "bg-[color:var(--coral)] text-white"
                : "border border-[color:var(--line)] text-[color:var(--ink-soft)]"
            }`}
          >
            {label} ({n})
          </button>
        ))}
        <button
          type="button"
          onClick={() => void load()}
          className="ml-auto text-sm font-semibold text-[color:var(--ink-soft)] hover:text-[color:var(--ink)]"
        >
          Atualizar
        </button>
      </div>

      <form
        onSubmit={(e) => void onUpload(e)}
        className="mt-8 rounded-2xl border border-[color:var(--line)] bg-white/70 p-5 md:p-6"
      >
        <h2 className="text-lg font-semibold">
          Novo {tab === "reels" ? "Reel" : tab === "stories" ? "Story" : "Post"}
        </h2>
        <div className="mt-4 grid gap-4">
          <label className="flex flex-col gap-2 text-sm font-medium">
            {tab === "reels"
              ? "Vídeo MP4 (9:16)"
              : tab === "stories"
                ? "Foto ou vídeo de story"
                : "Foto(s) — várias = carrossel"}
            <input
              id="post-file"
              type="file"
              multiple={tab === "posts"}
              accept={
                tab === "reels"
                  ? "video/mp4,video/quicktime,video/webm"
                  : tab === "stories"
                    ? "image/png,image/jpeg,image/webp,video/mp4,video/quicktime,video/webm"
                    : "image/png,image/jpeg,image/webp,image/gif"
              }
              onChange={(e) => setFiles(Array.from(e.target.files || []))}
              className="rounded-xl border border-[color:var(--line)] bg-white px-3 py-2.5 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-[color:var(--bg-deep)] file:px-3 file:py-1.5 file:text-sm file:font-semibold"
            />
          </label>
          {tab !== "stories" ? (
            <>
              <label className="flex flex-col gap-2 text-sm font-medium">
                Legenda
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  rows={4}
                  placeholder="Hook nos primeiros 125 caracteres…"
                  className="rounded-xl border border-[color:var(--line)] bg-white px-3 py-2.5 text-sm outline-none ring-[color:var(--coral)] focus:ring-2"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium">
                Hashtags (3–5)
                <input
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="webprumo, siteparaempresa, criacaodesites"
                  className="rounded-xl border border-[color:var(--line)] bg-white px-3 py-2.5 text-sm outline-none ring-[color:var(--coral)] focus:ring-2"
                />
              </label>
            </>
          ) : (
            <p className="text-sm text-[color:var(--ink-soft)]">
              Story não usa legenda no Instagram. Cron de story está pausado — publique manual se precisar.
            </p>
          )}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="submit" disabled={!files.length || uploading} className="wa-btn disabled:opacity-50">
            {uploading ? "Enviando…" : "Adicionar à fila"}
          </button>
          {files.length ? (
            <span className="text-sm text-[color:var(--ink-soft)]">
              {files.length} arquivo(s) · {files[0]?.name}
            </span>
          ) : null}
        </div>
        {error ? <p className="mt-3 text-sm text-[color:var(--coral-deep)]">{error}</p> : null}
      </form>

      {loading ? <p className="mt-8 text-[color:var(--ink-soft)]">Carregando…</p> : null}

      {!loading && filtered.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-[color:var(--line)] px-5 py-10 text-center text-[color:var(--ink-soft)]">
          Nenhum item em {MAIN_TABS.find((t) => t.id === tab)?.label.toLowerCase()} ·{" "}
          {pubFilter === "unpublished"
            ? "não publicados"
            : pubFilter === "published"
              ? "publicados"
              : "todos"}
          .
        </p>
      ) : null}

      <ul
        className={`mt-8 grid gap-5 ${
          tab === "stories" ? "sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4" : "sm:grid-cols-2 lg:grid-cols-3"
        }`}
      >
        {filtered.map((p) => (
          <li
            key={p.id}
            className="cursor-pointer overflow-hidden rounded-2xl border border-[color:var(--line)] bg-white/80"
            onClick={() => setOpenId(p.id)}
          >
            <div
              className={`relative bg-[color:var(--bg-deep)] ${
                tab === "stories" || p.media_type === "video" ? "aspect-[9/16]" : "aspect-[4/5]"
              }`}
            >
              <QueueMedia post={p} />
              <div className="absolute left-3 top-3 z-20 flex flex-wrap gap-1.5">
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white ${typeAccent(p.media_type)}`}
                >
                  {mediaKindLabel(p.media_type, slideUrls(p).length)}
                </span>
                <span className="rounded-full bg-black/65 px-2.5 py-1 text-[11px] font-semibold text-white">
                  #{p.sort_order}
                </span>
              </div>
              <span
                className={`absolute bottom-3 left-3 z-20 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold ${
                  p.status === "published"
                    ? "text-emerald-700"
                    : p.status === "failed"
                      ? "text-[color:var(--coral-deep)]"
                      : "text-[color:var(--ink-soft)]"
                }`}
              >
                {STATUS_LABEL[p.status] || p.status}
              </span>
            </div>
            <div className="flex flex-col gap-3 p-4">
              <p className="line-clamp-3 whitespace-pre-wrap text-sm text-[color:var(--ink-soft)]">
                {p.media_type === "story"
                  ? "Story — sem legenda"
                  : p.caption || <em>Sem legenda</em>}
              </p>
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
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[color:var(--line)] pt-3">
                <span className="text-xs text-[color:var(--ink-soft)]">
                  {new Date(p.created_at).toLocaleString("pt-BR")}
                </span>
                <div className="flex gap-2">
                  {!isPublished(p) || p.status === "publishing" ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void onPublish(p.id);
                      }}
                      disabled={publishingId === p.id || deletingId === p.id || p.status === "publishing"}
                      className="rounded-full bg-[color:var(--ink)] px-3.5 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                    >
                      {publishingId === p.id || p.status === "publishing" ? "…" : "Publicar"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void onPublish(p.id, true);
                      }}
                      disabled={publishingId === p.id || deletingId === p.id}
                      className="rounded-full bg-[color:var(--ink)] px-3.5 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                    >
                      {publishingId === p.id ? "…" : "Republicar"}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void onDelete(p.id);
                    }}
                    disabled={deletingId === p.id || publishingId === p.id}
                    className="rounded-full bg-[color:var(--coral-deep)] px-3.5 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                  >
                    {deletingId === p.id ? "…" : "Apagar"}
                  </button>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>

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
