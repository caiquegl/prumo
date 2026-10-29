#!/usr/bin/env python3
import json, time, urllib.request, urllib.error

API = "https://prumo-tawny.vercel.app"
RAW = "https://raw.githubusercontent.com/caiquegl/prumo/main/public/ig/"
SLIDES = [
    "ads-c1-hook.jpg",
    "ads-c2-problem.jpg",
    "ads-c3-solution.jpg",
    "ads-c4-proof.jpg",
    "ads-c5-cta.jpg",
]

secret = None
with open("/home/hitss/prumo/.env.local") as f:
    for line in f:
        if line.startswith("CRON_SECRET="):
            secret = line.split("=", 1)[1].strip().strip('"').strip("'")


def req(method, path, body=None, timeout=40):
    data = None if body is None else json.dumps(body).encode()
    headers = {"Authorization": f"Bearer {secret}"}
    if data is not None:
        headers["Content-Type"] = "application/json"
    r = urllib.request.Request(API + path, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r, timeout=timeout) as res:
            return res.status, json.loads(res.read())
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", "replace")
        try:
            parsed = json.loads(raw)
        except Exception:
            parsed = {"error": raw}
        return e.code, parsed


def list_posts():
    code, j = req("GET", "/api/posts")
    if code != 200:
        raise SystemExit(f"GET posts {code} {j}")
    return j.get("posts") or []


def wait_carousel_api():
    for i in range(24):
        posts = list_posts()
        if posts and "children" in posts[0]:
            print("api carousel ready")
            return posts
        print("wait deploy", i)
        time.sleep(10)
    raise SystemExit("deploy não expôs children")


def main():
    posts = wait_carousel_api()
    names = tuple(SLIDES)
    doomed = []
    for p in posts:
        url = p.get("image_url") or ""
        if p.get("media_type") == "image" and any(n in url for n in names) and p.get("status") in (
            "pending",
            "failed",
        ):
            doomed.append(p)
    doomed.sort(key=lambda p: next((i for i, n in enumerate(SLIDES) if n in (p.get("image_url") or "")), 99))
    print("remove", [p.get("id") for p in doomed])
    for p in doomed:
        code, j = req("DELETE", f"/api/posts/{p['id']}")
        print("delete", p["id"], code, j.get("ok") or j.get("error"))

    children = [RAW + name for name in SLIDES]
    code, j = req(
        "POST",
        "/api/posts",
        {
            "imageUrl": children[0],
            "children": children,
            "mediaType": "carousel",
            "caption": "Site que trabalha pelo seu negócio.\n\nSeu site aparece no Google. E aí?\nLanding com oferta, prova e WhatsApp — prazo e valor fechados.\n\nWeb Prumo · webprumo.com.br · @web.prumo\nWhatsApp (11) 96633-1995",
            "tags": ["webprumo", "ads", "carrossel"],
        },
    )
    print("create", code, json.dumps(j, ensure_ascii=False)[:500])
    if code != 201:
        raise SystemExit("falhou ao criar carrossel")
    post = j.get("post") or {}
    print("CAROUSEL_ID", post.get("id"), "slides", len(post.get("children") or []))


if __name__ == "__main__":
    main()
