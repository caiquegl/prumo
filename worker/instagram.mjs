const API = "https://graph.facebook.com/v26.0";
const sleep = ms => new Promise(r => setTimeout(r, ms));

export function instagram({ igId, token }) {
  async function call(method, path, params = {}) {
    const body = new URLSearchParams({ ...params, access_token: token });
    const res = method === "GET"
      ? await fetch(`${API}/${path}?${body}`)
      : await fetch(`${API}/${path}`, { method, body });
    const json = await res.json();
    if (!res.ok || json.error) throw new Error(`${method} ${path} -> ${res.status}: ${JSON.stringify(json.error ?? json)}`);
    return json;
  }

  return {
    account: () => call("GET", igId, { fields: "username,media_count" }),

    /** Creates the container, waits for Instagram to process the media and publishes it. */
    async publish({ kind, url, coverUrl, caption }) {
      const params = { caption };
      if (kind === "reel") Object.assign(params, { media_type: "REELS", video_url: url, cover_url: coverUrl, share_to_feed: "true" });
      else params.image_url = url;

      const { id: container } = await call("POST", `${igId}/media`, params);
      for (let i = 0; ; i++) {
        const { status_code, status } = await call("GET", container, { fields: "status_code,status" });
        if (status_code === "FINISHED") break;
        if (status_code === "ERROR" || status_code === "EXPIRED") throw new Error(`container ${container}: ${status}`);
        if (i > 120) throw new Error(`container ${container} não ficou pronto em 10 minutos`);
        await sleep(5000);
      }
      const { id } = await call("POST", `${igId}/media_publish`, { creation_id: container });
      const { permalink } = await call("GET", id, { fields: "permalink" });
      return { id, permalink };
    },
  };
}
