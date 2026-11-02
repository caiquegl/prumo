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

type TypeFilter = "all" | "image" | "video" | "carousel" | "story";
type StatusFilter = "all" | "pending" | "publishing" | "published" | "failed";

const TYPE_TABS: Array<{ id: TypeFilter; label: string }> = [
  { id: "all", label: "Todos" },
  { id: "image", label: "Fotos" },
  { id: "video", label: "Reels" },
  { id: "carousel", label: "Carrosséis" },
  { id: "story", label: "Stories" },
];

const STATUS_TABS: Array<{ id: StatusFilter; label: string }> = [
  { id: "all", label: "Qualquer status" },
  { id: "pending", label: "Na fila" },
  { id: "publishing", label: "Publicando" },
  { id: "published", label: "Publicados" },
  { id: "failed", label: "Falhas" },
];

function typeAccent(type: QueuePost["media_type"]) {
  if (type === "story") return "bg-[#7c3aed]";
  if (type === "video") return "bg-[#c45a48]";
  if (type === "carousel") return "bg-[#1d4ed8]";
  return "bg-[#141210]";
}

function statusTone(status: string) {
  if (status === "failed") return "text-[color:var(--coral-deep)]";
  if (status === "published") return "text-emerald-700";
  if (status === "publishing") return "text-amber-700";
  return "text-[color:var(--ink-soft)]";
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
  const [asStory, setAsStory] = useState(false);
  const [error, setError] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [publishingId, setPublishingId] = useState<number | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

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
    const byType: Record<string, number> = { image: 0, video: 0, carousel: 0, story: 0 };
    const byStatus: Record<string, number> = {
      pending: 0,
      publishing: 0,
      published: 0,
      failed: 0,
    };
    for (const p of posts) {
      byType[p.media_type] = (byType[p.media_type] || 0) + 1;
      byStatus[p.status] = (byStatus[p.status] || 0) + 1;
    }
    return { byType, byStatus };
  }, [posts]);

  const filtered = useMemo(() => {
    return posts.filter((p) => {
      if (typeFilter !== "all" && p.media_type !== typeFilter) return false;
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      return true;
    });
  }, [posts, typeFilter, statusFilter]);

  const grouped = useMemo(() => {
    const order: Array<QueuePost["media_type"]> = ["story", "video", "carousel", "image"];
    const map = new Map<QueuePost["media_type"], QueuePost[]>();
    for (const kind of order) map.set(kind, []);
    for (const p of filtered) {
      const list = map.get(p.media_type) || [];
      list.push(p);
      map.set(p.media_type, list);
    }
    return order
      .map((kind) => ({ kind, items: map.get(kind) || [] }))
      .filter((g) => g.items.length > 0);
  }, [filtered]);

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
      if (asStory) form.set("asStory", "1");
      const res = await fetch("/api/posts", { method: "POST", body: form });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(json.error || "Upload falhou");
        return;
      }
      setFiles([]);
      setCaption("");
      setAsStory(false);
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
    <main className="mx-auto min-h-screen max-w-6xl px-5 py-10 md:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold tracking-[0.2em] text-[color:var(--ink-soft)]">FILA IG</p>
          <h1 className="display mt-2 text-4xl md:text-5xl">Posts</h1>
          <p className="mt-2 max-w-xl text-[color:var(--ink-soft)]">
            Separe por tipo (foto, reel, carrossel, story). Clique no card para editar e publicar.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/ig"
            className="rounded-full border border-[color:var(--line)] px-4 py-2 text-sm font-semibold text-[color:var(--ink-soft)] hover:text-[color:var(--ink)]"
          >
            Monitor
          </a>
          {posts.some((item) => item.status === "pending" || item.status === "failed") ? (
            <button
              type="button"
              onClick={() => {
                const next = filtered.find((item) => item.status === "pending" || item.status === "failed")
                  || posts.find((item) => item.status === "pending" || item.status === "failed");
                if (next) void onPublish(next.id);
              }}
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

      <form
        onSubmit={(e) => void onUpload(e)}
        className="mt-10 rounded-2xl border border-[color:var(--line)] bg-white/70 p-5 md:p-6"
      >
        <h2 className="text-lg font-semibold">Novo item</h2>
        <div className="mt-4 grid gap-4">
          <label className="flex flex-col gap-2 text-sm font-medium">
            Arquivo (1 foto/vídeo, ou várias fotos = carrossel)
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
              placeholder="Hook nos primeiros 125 caracteres…"
              className="rounded-xl border border-[color:var(--line)] bg-white px-3 py-2.5 text-sm outline-none ring-[color:var(--coral)] focus:ring-2"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium">
            Hashtags (3–5 sized)
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              disabled={asStory}
              placeholder="webprumo, siteparaempresa, criacaodesites"
              className="rounded-xl border border-[color:var(--line)] bg-white px-3 py-2.5 text-sm outline-none ring-[color:var(--coral)] focus:ring-2 disabled:opacity-50"
            />
          </label>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={asStory}
              onChange={(e) => setAsStory(e.target.checked)}
              className="h-4 w-4 rounded border-[color:var(--line)]"
            />
            Enfileirar como Story (cron 11h / 17h BRT)
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="submit" disabled={!files.length || uploading} className="wa-btn disabled:opacity-50">
            {uploading ? "Enviando…" : "Adicionar à fila"}
          </button>
          {files.length ? (
            <span className="text-sm text-[color:var(--ink-soft)]">
              {asStory
                ? "Story"
                : files.length > 1
                  ? `Carrossel · ${files.length} fotos`
                  : files[0]!.type.startsWith("video/")
                    ? "Reel"
                    : "Foto"}
              {files.length === 1 ? ` · ${files[0]!.name}` : null}
            </span>
          ) : null}
        </div>
        {error ? <p className="mt-3 text-sm text-[color:var(--coral-deep)]">{error}</p> : null}
      </form>

      <section className="mt-10">
        <div className="flex flex-wrap gap-2">
          {TYPE_TABS.map((tab) => {
            const n =
              tab.id === "all" ? posts.length : counts.byType[tab.id] || 0;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setTypeFilter(tab.id)}
                className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ${
                  typeFilter === tab.id
                    ? "bg-[color:var(--ink)] text-white"
                    : "border border-[color:var(--line)] text-[color:var(--ink-soft)] hover:text-[color:var(--ink)]"
                }`}
              >
                {tab.label} ({n})
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {STATUS_TABS.map((tab) => {
            const n =
              tab.id === "all" ? posts.length : counts.byStatus[tab.id] || 0;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  statusFilter === tab.id
                    ? "bg-[color:var(--coral)] text-white"
                    : "border border-[color:var(--line)] text-[color:var(--ink-soft)]"
                }`}
              >
                {tab.label} ({n})
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => void load()}
            className="ml-auto text-sm font-semibold text-[color:var(--ink-soft)] hover:text-[color:var(--ink)]"
          >
            Atualizar
          </button>
        </div>
      </section>

      {loading ? <p className="mt-8 text-[color:var(--ink-soft)]">Carregando…</p> : null}

      {!loading && filtered.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-[color:var(--line)] px-5 py-10 text-center text-[color:var(--ink-soft)]">
          Nada neste filtro. Ajuste o tipo/status ou envie um novo item.
        </p>
      ) : null}

      <div className="mt-8 space-y-12">
        {grouped.map((group) => (
          <section key={group.kind}>
            <div className="mb-4 flex items-baseline gap-3">
              <h2 className="text-lg font-semibold capitalize">
                {mediaKindLabel(group.kind, 2).replace(/ ·.*/, "")}
              </h2>
              <span className="text-sm text-[color:var(--ink-soft)]">{group.items.length} item(ns)</span>
            </div>
            <ul
              className={`grid gap-5 ${
                group.kind === "story"
                  ? "sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
                  : "sm:grid-cols-2 lg:grid-cols-3"
              }`}
            >
              {group.items.map((p) => (
                <li
                  key={p.id}
                  className="cursor-pointer overflow-hidden rounded-2xl border border-[color:var(--line)] bg-white/80"
                  onClick={() => setOpenId(p.id)}
                >
                  <div
                    className={`relative bg-[color:var(--bg-deep)] ${
                      group.kind === "story" ? "aspect-[9/16]" : "aspect-[4/5]"
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
                      className={`absolute bottom-3 left-3 z-20 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold ${statusTone(p.status)}`}
                    >
                      {STATUS_LABEL[p.status] || p.status}
                    </span>
                  </div>
                  <div className="flex flex-col gap-3 p-4">
                    <p className="line-clamp-3 whitespace-pre-wrap text-sm text-[color:var(--ink-soft)]">
                      {p.media_type === "story"
                        ? "Story — sem legenda no Instagram"
                        : p.caption || <em>Sem legenda</em>}
                    </p>
                    {p.tags?.length && p.media_type !== "story" ? (
                      <p className="line-clamp-2 text-xs text-[color:var(--ink-soft)]">
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
                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[color:var(--line)] pt-3">
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
                            className="rounded-full bg-[color:var(--ink)] px-3.5 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                          >
                            {publishingId === p.id || p.status === "publishing" ? "…" : "Publicar"}
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
                            className="rounded-full bg-[color:var(--ink)] px-3.5 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                          >
                            {publishingId === p.id ? "…" : "Republicar"}
                          </button>
                        ) : null}
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
          </section>
        ))}
      </div>

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
