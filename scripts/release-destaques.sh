#!/usr/bin/env bash
# Publishes the highlight stories in creation order (estrutura -> parcerias).
set -euo pipefail
cd /home/hitss/prumo
sed -i 's/\r$//' scripts/*.sh scripts/publish_ig.py
mkdir -p public/ig/destaques
cp /mnt/c/Users/Hitss/prumo-assets/out3/hl-*.jpg public/ig/destaques/
KEYS=()
for f in hl-estrutura-{1..3} hl-orcamento-{1..2} hl-seguranca-{1..3} hl-tecnologias-{1..3} hl-parcerias-{1..3}; do KEYS+=("$f"); done
bash scripts/commit-push-landing.sh "feat: highlight stories (parcerias, tecnologias, seguranca, orcamento, estrutura)" | tail -2
bash scripts/wait-media.sh destaques/hl-estrutura-1.jpg destaques/hl-parcerias-3.jpg
python3 scripts/publish_ig.py "${KEYS[@]}"
