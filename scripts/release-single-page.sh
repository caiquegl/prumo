#!/usr/bin/env bash
set -euo pipefail
cd /home/hitss/prumo
sed -i 's/\r$//' scripts/*.sh scripts/publish_ig.py
SRC=/mnt/c/Users/Hitss/prumo-assets/out2
cp "$SRC/post-anatomia.jpg" public/ig/prumo-feed-22-sp-anatomia.jpg
cp "$SRC/post-comparativo.jpg" public/ig/prumo-feed-23-sp-comparativo.jpg
cp "$SRC/post-checklist.jpg" public/ig/prumo-feed-24-sp-checklist.jpg
bash scripts/commit-push-landing.sh "feat: single page posts" | tail -2
bash scripts/wait-media.sh prumo-feed-22-sp-anatomia.jpg prumo-feed-23-sp-comparativo.jpg prumo-feed-24-sp-checklist.jpg
python3 scripts/publish_ig.py sp-checklist sp-comparativo sp-anatomia
