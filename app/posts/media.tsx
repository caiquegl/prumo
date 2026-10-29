"use client";

import { PointerEvent, useEffect, useRef, useState } from "react";

export type QueuePost = {
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

export const STATUS_LABEL: Record<string, string> = {
  pending: "Na fila",
  publishing: "Publicando",
  published: "Publicado",
  failed: "Falhou",
};

export function mediaKindLabel(type: QueuePost["media_type"], count = 1) {
  if (type === "video") return "vídeo";
  if (type === "carousel") return `carrossel · ${count} fotos`;
  return "foto";
}

export function slideUrls(post: QueuePost) {
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

export function tagsToInput(tags: string[] | null) {
  return (tags || []).join(", ");
}

export function parseTagInput(raw: string) {
  return raw
    .split(/[\s,]+/)
    .map((t) => t.replace(/^#/, "").trim())
    .filter(Boolean)
    .slice(0, 12);
}

export function QueueMedia({ post, fit = "cover" }: { post: QueuePost; fit?: "cover" | "contain" }) {
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
    return (
      <video
        src={post.image_url}
        className={`h-full w-full ${fit === "contain" ? "object-contain" : "object-cover"}`}
        controls
        muted
        playsInline
      />
    );
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
      <img
        src={src}
        alt=""
        className={`h-full w-full ${fit === "contain" ? "object-contain bg-black" : "object-cover"}`}
        draggable={false}
      />
      {carousel ? (
        <>
          <button
            type="button"
            aria-label="Slide anterior"
            onClick={(e) => {
              e.stopPropagation();
              go(index - 1);
            }}
            className="absolute left-2 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white"
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Próximo slide"
            onClick={(e) => {
              e.stopPropagation();
              go(index + 1);
            }}
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
                onClick={(e) => {
                  e.stopPropagation();
                  setIndex(i);
                }}
                className={`h-1.5 rounded-full ${i === index ? "w-5 bg-white" : "w-1.5 bg-white/50"}`}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
