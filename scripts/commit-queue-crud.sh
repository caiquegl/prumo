#!/usr/bin/env bash
set -euo pipefail
cd /home/hitss/prumo
export PATH="/home/hitss/.nvm/versions/node/v20.20.2/bin:$PATH"

git add \
  lib/admin/auth.ts \
  lib/admin/guard.ts \
  lib/ig/queue.ts \
  middleware.ts \
  app/layout.tsx \
  app/components/SiteChrome.tsx \
  app/login/page.tsx \
  app/login/layout.tsx \
  app/posts/page.tsx \
  app/api/auth/login/route.ts \
  app/api/auth/logout/route.ts \
  app/api/auth/me/route.ts \
  app/api/posts/route.ts \
  app/api/posts/\[id\]/route.ts \
  scripts/queue-upload.mjs \
  scripts/commit-queue-crud.sh \
  env.example

git status --short
git commit -m "$(cat <<'EOF'
feat(ig): admin queue CRUD for photo/video posts with captions

Add login, /posts gallery, and API so uploads (UI or agent Bearer)
land in ig_queue with captions/tags for the worker to publish later.
EOF
)"
git push origin HEAD
echo PUSHED
