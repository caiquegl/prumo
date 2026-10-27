#!/usr/bin/env bash
set -euo pipefail

IG_ID="17841427877735853"
TOKEN="${IG_PAGE_TOKEN:-EAAQDQzWK5ZBIBSzCZCo2LjGEibmpbUsHtCeg0ye8eSkcNPZBqktVMP8SuqU7JROpYW7fzZBkzrYdT9cfPsOIOqaDK0mHOuK0HbVheD2mBiF9luzarCcNbPIVZBOhtKk4X1pLI02J6YnahmUPygj2OVW4cLM9aCaEpF6Ma5CHGal6gKc7s3lnZBDzpukxXhAjdar7ZAXvBSs6AIDqwIXEtBwMrHiKmklahJQ9A7HDscZD}"
BASE="https://raw.githubusercontent.com/caiquegl/prumo/main/public/ig"

publish_one() {
  local file="$1"
  local caption="$2"
  local image_url="${BASE}/${file}"
  echo "==> $file"
  echo "    url=$image_url"

  local create
  create=$(curl -sS -X POST "https://graph.facebook.com/v26.0/${IG_ID}/media" \
    --data-urlencode "image_url=${image_url}" \
    --data-urlencode "caption=${caption}" \
    --data-urlencode "access_token=${TOKEN}")
  echo "    create=$create"
  local creation_id
  creation_id=$(python3 -c "import json,sys; print(json.load(sys.stdin).get('id',''))" <<<"$create")
  if [[ -z "$creation_id" ]]; then
    echo "    FAIL create"
    return 1
  fi

  for i in 1 2 3 4 5 6 7 8; do
    sleep 3
    local st
    st=$(curl -sS "https://graph.facebook.com/v26.0/${creation_id}?fields=status_code&access_token=${TOKEN}")
    echo "    status=$st"
    if grep -q FINISHED <<<"$st"; then
      break
    fi
    if grep -q ERROR <<<"$st"; then
      echo "    FAIL status"
      return 1
    fi
  done

  local pub
  pub=$(curl -sS -X POST "https://graph.facebook.com/v26.0/${IG_ID}/media_publish" \
    --data-urlencode "creation_id=${creation_id}" \
    --data-urlencode "access_token=${TOKEN}")
  echo "    publish=$pub"
}

publish_one "prumo-feed-09-seguranca.jpg" "$(cat <<'EOF'
Segurança não é um plugin no final.

É HTTPS, autenticação e cuidado com dados desde o primeiro commit.

Na Prumo Web, o básico bem feito já diferencia.

Orçamentos no Direct ou WhatsApp (11) 96633-1995.

#seguranca #webdev #prumoweb #sites
EOF
)"

publish_one "prumo-feed-10-automacao.jpg" "$(cat <<'EOF'
Automação boa é invisível.

Formulários, integrações e fluxos que tiram trabalho repetitivo — e reduzem erro humano.

Menos planilha. Mais operação rodando.

#automacao #produtividade #prumoweb #tecnologia
EOF
)"

publish_one "prumo-feed-11-inovacao.jpg" "$(cat <<'EOF'
Inovação de verdade o cliente sente.

Carregamento rápido, hierarquia clara, movimento com intenção.

Não é tendência. É experiência.

#inovacao #ux #prumoweb #digital
EOF
)"

publish_one "prumo-feed-12-scroll-apple.jpg" "$(cat <<'EOF'
Sabe aquele site da Apple em que o celular gira enquanto você rola?

Isso é scroll storytelling: o produto responde ao gesto.

Usamos a mesma lógica — elegante, sem barulho — em landing pages e produtos web.

#webdesign #scrollanimation #prumoweb #frontend
EOF
)"

publish_one "prumo-feed-13-microinteracoes.jpg" "$(cat <<'EOF'
O site “parece caro” nos detalhes.

Hover certo, feedback imediato, transição que respira.

Microinterações não são enfeite — são percepção de qualidade.

WhatsApp orçamentos: (11) 96633-1995

#microinteracoes #ui #prumoweb #design
EOF
)"

echo "ALL_DONE"
