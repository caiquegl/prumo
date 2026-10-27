#!/usr/bin/env bash
set -euo pipefail
cd /home/hitss/prumo
sed -i 's/\r$//' scripts/*.sh scripts/publish_ig.py
ORDER=(orcamento agenda integracoes antes seguranca lead painel trade performance prazo)

python3 - "${ORDER[@]}" <<'PY'
import sys
sys.path.insert(0, "scripts")
import publish_ig as p
for k in sys.argv[1:]:
    s = p.POSTS[k]
    assert p.caption(s["section"], s["captions"]), k
print("captions ok")
PY

bash scripts/commit-push-landing.sh "feat: batch 2 reels and posts (trade marketing, automation, security)" | tail -3
bash scripts/wait-media.sh prumo-reel-03-prazo.mp4 prumo-reel-07-agenda.mp4 prumo-feed-21-orcamento.jpg prumo-reel-07-agenda-cover.jpg
python3 scripts/publish_ig.py "${ORDER[@]}"
