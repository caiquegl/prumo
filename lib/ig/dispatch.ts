import { account, publishQueueMedia } from "./publish";
import {
  captionWithTags,
  carouselUrls,
  claimQueuePost,
  markQueueFailed,
  markQueuePublished,
  type QueuePost,
} from "./queue";
import { insertPublication, logEvent } from "./store";

export async function publishClaimedQueueItem(claimed: QueuePost, slot: string) {
  const caption = captionWithTags(claimed.caption, claimed.tags);
  const ig = await account();
  const published = await publishQueueMedia({
    mediaType: claimed.media_type,
    mediaUrl: claimed.image_url,
    children: carouselUrls(claimed),
    caption,
  });

  await markQueuePublished(claimed.id, {
    mediaId: published.id,
    permalink: published.permalink,
  });

  await insertPublication({
    slot,
    itemId: `queue:${claimed.id}`,
    title: `Fila #${claimed.id}`,
    layout: claimed.media_type === "video" ? "reel" : claimed.media_type === "carousel" ? "carousel" : "feed",
    format: claimed.media_type === "video" ? "reel" : claimed.media_type === "carousel" ? "carousel" : "post",
    mediaId: published.id,
    permalink: published.permalink,
    imageUrl: claimed.image_url,
    caption,
  });

  await logEvent("info", "publish", "post da fila publicado", {
    slot,
    queueId: claimed.id,
    mediaType: claimed.media_type,
    permalink: published.permalink,
  });

  return {
    ok: true as const,
    queueId: claimed.id,
    mediaType: claimed.media_type,
    permalink: published.permalink,
    account: ig.username,
    slot,
  };
}

export async function publishQueuePostNow(id: number, opts?: { republish?: boolean }) {
  const slot = `manual-${new Date().toISOString().slice(0, 16)}`;
  const claimed = await claimQueuePost(id, opts);
  if (!claimed) {
    return {
      ok: false as const,
      status: 409,
      error: opts?.republish
        ? `post ${id} não pode ser republicado neste status`
        : `post ${id} não está pending/failed`,
    };
  }
  await logEvent("info", "queue", opts?.republish ? "republicar agora" : "publicar agora", {
    id: claimed.id,
    mediaType: claimed.media_type,
    slot,
  });
  try {
    const result = await publishClaimedQueueItem(claimed, slot);
    return { ...result, status: 200 };
  } catch (err) {
    const message = err instanceof Error ? err.message : "falhou ao publicar";
    await markQueueFailed(claimed.id, message);
    await logEvent("error", "publish", message, { queueId: claimed.id });
    return { ok: false as const, status: 500, error: message, queueId: claimed.id };
  }
}
