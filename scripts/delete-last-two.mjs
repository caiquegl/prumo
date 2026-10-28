import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);
const rows = await sql`
  SELECT id, item_id, title, media_id, permalink, published_at
  FROM ig_publications
  ORDER BY published_at DESC
  LIMIT 5`;
console.log("recent", JSON.stringify(rows, null, 2));

const tokenRow = await sql`SELECT page_token FROM ig_auth WHERE id = 1 LIMIT 1`;
const token = tokenRow[0]?.page_token;
if (!token) {
  console.error("no page token");
  process.exit(1);
}

const toDelete = rows.slice(0, 2);
for (const row of toDelete) {
  if (!row.media_id) {
    console.log("skip no media_id", row.item_id);
    continue;
  }
  const url = `https://graph.facebook.com/v21.0/${row.media_id}?access_token=${encodeURIComponent(token)}`;
  const res = await fetch(url, { method: "DELETE" });
  const body = await res.text();
  console.log("delete IG", row.media_id, res.status, body.slice(0, 300));
  if (res.ok) {
    await sql`DELETE FROM ig_publications WHERE id = ${row.id}`;
    console.log("deleted neon", row.item_id, row.permalink);
  }
}
console.log("DONE");
