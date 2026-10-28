import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);
const tokenRow = await sql`SELECT page_token, ig_user_id, page_id FROM ig_auth WHERE id = 1 LIMIT 1`;
const auth = tokenRow[0];
if (!auth?.page_token) {
  console.error("no auth");
  process.exit(1);
}
const token = auth.page_token;
console.log("auth meta", { ig_user_id: auth.ig_user_id, page_id: auth.page_id, tokenLen: token.length });

const debug = await fetch(
  `https://graph.facebook.com/v21.0/debug_token?input_token=${encodeURIComponent(token)}&access_token=${encodeURIComponent(token)}`,
);
console.log("debug_token", debug.status, (await debug.text()).slice(0, 800));

const rows = await sql`
  SELECT id, item_id, media_id, permalink
  FROM ig_publications
  ORDER BY published_at DESC
  LIMIT 2`;

for (const row of rows) {
  const mid = row.media_id;
  // probe media object
  const get = await fetch(
    `https://graph.facebook.com/v21.0/${mid}?fields=id,media_type,permalink,caption,owner&access_token=${encodeURIComponent(token)}`,
  );
  console.log("GET media", mid, get.status, (await get.text()).slice(0, 400));

  // try DELETE with different paths
  for (const path of [
    `https://graph.facebook.com/v21.0/${mid}`,
    `https://graph.facebook.com/v19.0/${mid}`,
  ]) {
    const res = await fetch(`${path}?access_token=${encodeURIComponent(token)}`, { method: "DELETE" });
    console.log("DELETE", path.split("/").pop(), res.status, (await res.text()).slice(0, 250));
  }
}
