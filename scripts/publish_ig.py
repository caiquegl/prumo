#!/usr/bin/env python3
"""Publish feed images, reels and stories to @prumo264 via the Instagram Graph API.

Usage: publish_ig.py <section-title> [...]
Token is read from $PRUMO_PAGE_TOKEN_FILE (default /tmp/prumo-page-token.txt); never commit it.
"""
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request

API = "https://graph.facebook.com/v26.0"
IG_ID = "17841427877735853"
BASE = "https://prumo-tawny.vercel.app/ig"
CAPTIONS = os.path.join(os.path.dirname(__file__), "..", "content", "legendas-14-16-reels-story.md")

POSTS = {
    "terra": {"type": "REELS", "file": "prumo-reel-01-terra.mp4", "cover": "prumo-reel-01-terra-cover.jpg", "section": "Reel 01"},
    "prisma": {"type": "REELS", "file": "prumo-reel-02-prisma.mp4", "cover": "prumo-reel-02-prisma-cover.jpg", "section": "Reel 02"},
    "lex": {"type": "IMAGE", "file": "prumo-feed-14-lex.jpg", "section": "14"},
    "pata": {"type": "IMAGE", "file": "prumo-feed-15-pata.jpg", "section": "15"},
    "motriz": {"type": "IMAGE", "file": "prumo-feed-16-motriz.jpg", "section": "16"},
    "story": {"type": "STORIES", "file": "prumo-story-01-projetos.jpg", "section": None},
}

BATCH2 = os.path.join(os.path.dirname(__file__), "..", "content", "legendas-17-26.md")
for key, kind, name, section in [
    ("prazo", "REELS", "prumo-reel-03-prazo", "01"),
    ("performance", "IMAGE", "prumo-feed-17-performance", "02"),
    ("trade", "REELS", "prumo-reel-04-trade", "03"),
    ("painel", "IMAGE", "prumo-feed-18-painel-trade", "04"),
    ("lead", "REELS", "prumo-reel-05-lead", "05"),
    ("seguranca", "IMAGE", "prumo-feed-19-seguranca", "06"),
    ("antes", "REELS", "prumo-reel-06-antes-depois", "07"),
    ("integracoes", "IMAGE", "prumo-feed-20-integracoes", "08"),
    ("agenda", "REELS", "prumo-reel-07-agenda", "09"),
    ("orcamento", "IMAGE", "prumo-feed-21-orcamento", "10"),
]:
    spec = {"type": kind, "section": section, "captions": BATCH2}
    if kind == "REELS":
        spec.update(file=f"{name}.mp4", cover=f"{name}-cover.jpg")
    else:
        spec.update(file=f"{name}.jpg")
    POSTS[key] = spec

for hl, count in [("estrutura", 3), ("orcamento", 2), ("seguranca", 3), ("tecnologias", 3), ("parcerias", 3)]:
    for i in range(1, count + 1):
        POSTS[f"hl-{hl}-{i}"] = {"type": "STORIES", "file": f"destaques/hl-{hl}-{i}.jpg", "section": None}


def token():
    path = os.environ.get("PRUMO_PAGE_TOKEN_FILE", "/tmp/prumo-page-token.txt")
    with open(path) as f:
        return f.read().strip()


def call(method, path, **params):
    params["access_token"] = token()
    data = urllib.parse.urlencode(params).encode()
    url = f"{API}/{path}"
    if method == "GET":
        req = urllib.request.Request(f"{url}?{data.decode()}")
    else:
        req = urllib.request.Request(url, data=data, method=method)
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        raise SystemExit(f"{method} {path} -> {e.code}: {e.read().decode()}")


def caption(section, path=CAPTIONS):
    if not section:
        return None
    text = open(path, encoding="utf-8").read()
    m = re.search(rf"^## {re.escape(section)}\b.*?\n(.*?)(?=^## |\Z)", text, re.S | re.M)
    return m.group(1).strip() if m else None


def publish(key):
    spec = POSTS[key]
    params = {}
    url = f"{BASE}/{spec['file']}"
    if spec["type"] == "REELS":
        params.update(media_type="REELS", video_url=url, share_to_feed="true", cover_url=f"{BASE}/{spec['cover']}")
    elif spec["type"] == "STORIES":
        params.update(media_type="STORIES", image_url=url)
    else:
        params.update(image_url=url)
    cap = caption(spec["section"], spec.get("captions", CAPTIONS))
    if spec["section"] and not cap:
        raise SystemExit(f"{key}: caption section {spec['section']} not found")
    if cap:
        params["caption"] = cap

    container = call("POST", f"{IG_ID}/media", **params)["id"]
    for _ in range(60):
        status = call("GET", container, fields="status_code,status").get("status_code")
        if status == "FINISHED":
            break
        if status == "ERROR":
            raise SystemExit(f"{key}: container error {call('GET', container, fields='status')}")
        time.sleep(5)
    media = call("POST", f"{IG_ID}/media_publish", creation_id=container)["id"]
    link = call("GET", media, fields="permalink").get("permalink")
    print(f"{key}: published {media} {link}", flush=True)


if __name__ == "__main__":
    print(call("GET", IG_ID, fields="username,media_count"))
    for k in sys.argv[1:]:
        publish(k)
