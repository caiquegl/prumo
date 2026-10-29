"use client";

import { useEffect, useState } from "react";
import { parseTagInput, QueueMedia, tagsToInput, type QueuePost } from "./media";

function timeAgo(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.max(0, Math.floor(ms / 60000));
  if (min < 1) return "agora";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h`;
  return `${Math.floor(h / 24)} d`;
}

export function IgModal({
  post,
  busy,
  onClose,
  onSave,
  onPublish,
  onRepublish,
  onDelete,
}: {
  post: QueuePost;
  busy: boolean;
  onClose: () => void;
  onSave: (caption: string, tags: string[]) => Promise<void>;
  onPublish: () => void;
  onRepublish: () => void;
  onDelete: () => void;
}) {
  const [caption, setCaption] = useState(post.caption || "");
  const [tagsRaw, setTagsRaw] = useState(tagsToInput(post.tags));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const tags = parseTagInput(tagsRaw);
  const canPublish = post.status === "pending" || post.status === "failed";
  const canRepublish = post.status === "published";

  useEffect(() => {
    setCaption(post.caption || "");
    setTagsRaw(tagsToInput(post.tags));
  }, [post]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  async function save() {
    setSaving(true);
    setSaveError("");
    try {
      await onSave(caption.trim(), tags);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Falha ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 md:p-8"
      onClick={onClose}
    >
      <button
        type="button"
        aria-label="Fechar"
        className="absolute right-4 top-4 z-50 text-3xl leading-none text-white/90 hover:text-white"
        onClick={onClose}
      >
        ×
      </button>
      <article
        className="grid max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-xl bg-black text-white shadow-2xl md:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative min-h-[320px] bg-black md:min-h-[640px]">
          <QueueMedia post={post} fit="contain" />
        </div>
        <div className="flex max-h-[92vh] flex-col border-t border-white/10 md:border-l md:border-t-0">
          <header className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/logo-favicon.png"
              alt=""
              className="h-9 w-9 rounded-full bg-white object-contain"
            />
            <div className="min-w-0">
              <p className="text-sm font-semibold">web.prumo</p>
              <p className="text-xs text-white/50">{timeAgo(post.created_at)}</p>
            </div>
          </header>

          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
            <p className="whitespace-pre-wrap text-sm leading-relaxed">
              <span className="font-semibold">web.prumo</span>{" "}
              {caption || <span className="text-white/40">Sem legenda</span>}
            </p>
            {tags.length ? (
              <p className="text-sm leading-relaxed text-[#e0f1ff]">
                {tags.map((t) => `#${t}`).join(" ")}
              </p>
            ) : null}

            <div className="border-t border-white/10 pt-4">
              <label className="block text-xs font-semibold uppercase tracking-wider text-white/50">
                Legenda
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  rows={6}
                  className="mt-2 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                />
              </label>
              <label className="mt-3 block text-xs font-semibold uppercase tracking-wider text-white/50">
                Hashtags
                <input
                  value={tagsRaw}
                  onChange={(e) => setTagsRaw(e.target.value)}
                  placeholder="webprumo, ads, landingpage"
                  className="mt-2 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                />
              </label>
              <button
                type="button"
                onClick={() => void save()}
                disabled={saving || busy}
                className="mt-3 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
              >
                {saving ? "Salvando…" : "Salvar descrição"}
              </button>
              {saveError ? <p className="mt-2 text-xs text-[#ff8f8f]">{saveError}</p> : null}
            </div>
          </div>

          <footer className="border-t border-white/10 px-4 py-3">
            <div className="mb-3 flex gap-4 text-white" aria-hidden>
              <span className="text-lg">♡</span>
              <span className="text-lg">✈</span>
              <span className="ml-auto text-lg">⚑</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {canPublish ? (
                <button
                  type="button"
                  onClick={onPublish}
                  disabled={busy}
                  className="rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-black disabled:opacity-50"
                >
                  Publicar
                </button>
              ) : null}
              {canRepublish ? (
                <button
                  type="button"
                  onClick={onRepublish}
                  disabled={busy}
                  className="rounded-full bg-white/15 px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  Republicar
                </button>
              ) : null}
              <button
                type="button"
                onClick={onDelete}
                disabled={busy}
                className="rounded-full bg-[#c45a48] px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                Apagar
              </button>
            </div>
          </footer>
        </div>
      </article>
    </div>
  );
}
