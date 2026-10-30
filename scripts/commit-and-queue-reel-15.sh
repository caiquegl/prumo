#!/usr/bin/env bash
set -euo pipefail
cd /home/hitss/prumo
git add \
  media/reel-web-prumo-15.html \
  scripts/render-reel-web-15.mjs \
  scripts/commit-and-queue-reel-15.sh \
  public/ig/prumo-reel-15.mp4 \
  public/ig/prumo-reel-15-cover.jpg \
  app/posts/page.tsx
git commit -m "$(cat <<'EOF'
feat(ig): reel de 15s e botão Publicar na fila

Sobe o HTML novo para a fila e deixa Publicar visível no topo da página de posts.
EOF
)" || true
git push origin HEAD
echo PUSHED
python3 - <<'PY'
import json, time, urllib.request

API = "https://prumo-tawny.vercel.app"
RAW = "https://raw.githubusercontent.com/caiquegl/prumo/main/public/ig/prumo-reel-15.mp4"
secret = None
with open("/home/hitss/prumo/.env.local") as f:
    for line in f:
        if line.startswith("CRON_SECRET="):
            secret = line.split("=", 1)[1].strip().strip('"').strip("'")

def url_ok(u):
    try:
        req = urllib.request.Request(u, method="HEAD")
        with urllib.request.urlopen(req, timeout=25) as r:
            ln = int(r.headers.get("Content-Length") or 0)
            print("HEAD", r.status, ln)
            return r.status == 200 and ln > 200000
    except Exception as e:
        print("HEAD fail", e)
        return False

for i in range(24):
    if url_ok(RAW):
        break
    print("wait cdn", i)
    time.sleep(8)
else:
    raise SystemExit("cdn not ready")

body = json.dumps({
    "imageUrl": RAW,
    "mediaType": "video",
    "caption": "Seu site está te fazendo perder clientes?\n\nSingle page que vende. Design autoral, no prazo. Páginas, plataformas e integrações.\n\nWeb Prumo · (11) 96633-1995",
    "tags": ["webprumo", "reels", "trafegopago", "sites", "landingpage"],
}).encode()
req = urllib.request.Request(
    f"{API}/api/posts",
    data=body,
    headers={"Authorization": f"Bearer {secret}", "Content-Type": "application/json"},
    method="POST",
)
j = json.loads(urllib.request.urlopen(req, timeout=40).read())
p = j.get("post") or {}
print("queued", p.get("id"), p.get("media_type"), p.get("status"), p.get("image_url"))
PY
