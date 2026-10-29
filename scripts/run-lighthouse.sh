#!/usr/bin/env bash
set -euo pipefail
export PATH="/home/hitss/.nvm/versions/node/v24.15.0/bin:$PATH"
cd /home/hitss/prumo
npx --yes lighthouse https://www.webprumo.com.br \
  --only-categories=performance,seo,accessibility \
  --form-factor=mobile \
  --screenEmulation.mobile=true \
  --chrome-flags="--headless --no-sandbox" \
  --quiet \
  --output=json \
  --output-path=/tmp/lh.json
python3 /home/hitss/prumo/scripts/parse-lh.py
