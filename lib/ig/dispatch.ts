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

function layoutFor(mediaType: QueuePost["media_type"]) {
  if (mediaType === "video") return "reel";
  if (mediaType === "carousel") return "carousel";
  if (mediaType === "story") return "story";
  return "feed";
}

export async function publishClaimedQueueItem(claimed: QueuePost, slot: string) {
  const caption = captionWithTags(claimed.caption, claimed.tags, claimed.media_type);
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

  const layout = layoutFor(claimed.media_type);
  await insertPublication({
    slot,
    itemId: `queue:${claimed.id}`,
    title: `Fila #${claimed.id}`,
    layout,
    format: layout === "feed" ? "post" : layout,
    mediaId: published.id,
    permalink: published.permalink,
    imageUrl: claimed.image_url,
    caption: claimed.media_type === "story" ? null : caption,
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
