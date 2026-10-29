#!/usr/bin/env bash
set -euo pipefail
cd /home/hitss/prumo
git add \
  app/api/cron/instagram/route.ts \
  app/api/posts/route.ts \
  app/posts/page.tsx \
  lib/ig/publish.ts \
  lib/ig/queue.ts \
  scripts/queue-ads.py \
  scripts/merge-ads-carousel.py \
  scripts/commit-carousel.sh
git status --short -- \
  app/api/cron/instagram/route.ts \
  app/api/posts/route.ts \
  app/posts/page.tsx \
  lib/ig/publish.ts \
  lib/ig/queue.ts \
  scripts/queue-ads.py \
  scripts/merge-ads-carousel.py \
  scripts/commit-carousel.sh
git commit -m "$(cat <<'EOF'
feat(ig): carrossel na fila, preview e publicação Graph

Junta várias imagens num post só, com swipe em /posts e media_type CAROUSEL no Instagram.
EOF
)"
git push origin HEAD
echo PUSHED
