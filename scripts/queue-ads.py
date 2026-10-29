import json, time, urllib.request

RAW = "https://raw.githubusercontent.com/caiquegl/prumo/main/public/ig/"
SITE = "https://www.webprumo.com.br/ig/"
API = "https://prumo-tawny.vercel.app"

CAROUSEL = [
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


def url_ok(u):
    try:
        req = urllib.request.Request(u, method="HEAD")
        with urllib.request.urlopen(req, timeout=25) as r:
            ln = int(r.headers.get("Content-Length") or 0)
            print("HEAD", r.status, ln, u[-40:])
            return r.status == 200 and ln > 20000
    except Exception as e:
        print("HEAD fail", e, u[-40:])
        return False


def host(name):
    for i in range(20):
        if url_ok(RAW + name):
            return RAW + name
        if url_ok(SITE + name):
            return SITE + name
        print("wait cdn", name, i)
        time.sleep(8)
    raise SystemExit(f"cdn not ready {name}")


def post(body):
    req = urllib.request.Request(
        f"{API}/api/posts",
        data=json.dumps(body).encode(),
        headers={"Authorization": f"Bearer {secret}", "Content-Type": "application/json"},
        method="POST",
    )
    j = json.loads(urllib.request.urlopen(req, timeout=40).read())
    p = j.get("post") or {}
    print("queued", p.get("id"), p.get("media_type"), p.get("image_url"))
    return j


def main():
    reel = host("prumo-reel-ads-trafego.mp4")
    post(
        {
            "imageUrl": reel,
            "mediaType": "video",
            "caption": "Site parado não vende. A Web Prumo coloca no ar landing ou site institucional com prazo e valor fechados. Chama no WhatsApp.\n\nWeb Prumo · webprumo.com.br · @web.prumo\n(11) 96633-1995",
            "tags": ["webprumo", "trafegopago", "landingpage", "whatsapp"],
        }
    )
    children = [host(name) for name in CAROUSEL]
    post(
        {
            "imageUrl": children[0],
            "children": children,
            "mediaType": "carousel",
            "caption": "Site que trabalha pelo seu negócio.\n\nSeu site aparece no Google. E aí?\nLanding com oferta, prova e WhatsApp — prazo e valor fechados.\n\nWeb Prumo · webprumo.com.br · @web.prumo\nWhatsApp (11) 96633-1995",
            "tags": ["webprumo", "ads", "carrossel"],
        }
    )


if __name__ == "__main__":
    main()
