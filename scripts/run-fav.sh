#!/usr/bin/env bash
set -euo pipefail
export PATH="/home/hitss/.nvm/versions/node/v24.15.0/bin:$PATH"
cd /home/hitss/prumo
npm i -D png-to-ico --no-fund --no-audit
node scripts/regen-favicons.mjs
file public/favicon.ico
ls -la public/favicon.ico public/favicon-32.png public/favicon-48.png app/favicon.ico
