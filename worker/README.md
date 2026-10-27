# Publicação automática no Instagram

Três vezes ao dia (8:00, 12:00 e 18:00 de Brasília) o Next.js gera um post 1080×1350 no visual da Prumo e publica no [@prumo.web](https://instagram.com/prumo.web).

Os horários no `vercel.json` estão em UTC: 11:00, 15:00 e 21:00.

## O que roda onde

| | Post (imagem) | Reel (vídeo 12s) |
|---|---|---|
| **Vercel cron** (`/api/cron/instagram`) | sim — 3× ao dia | não (Playwright + ffmpeg não cabem no serverless) |
| **GitHub Actions** (`instagram-autopost.yml`) | sim | sim, intercalado com post |

No dia a dia use a Vercel. Para reel, dispare o workflow *Instagram autopost* manualmente (ou reative o `schedule` no YAML e pause os crons da Vercel, para não duplicar).

O banco de conteúdo está em `worker/bank.json` (21 peças, ~7 dias sem repetir). Depois disso o cron republica o item mais antigo. O workflow do GitHub ainda pode chamar a OpenAI se `OPENAI_API_KEY` estiver definido.

## Variáveis na Vercel

Project → Settings → Environment Variables, ambiente **Production**:

| Chave | Obrigatório | O que é |
|---|---|---|
| `META_PAGE_TOKEN` | sim | token da **Página** (não o de usuário) |
| `IG_USER_ID` | já tem padrão | `17841427877735853` |
| `CRON_SECRET` | sim | string aleatória; a Vercel manda no header dos crons |
| `META_APP_ID` | para renovar token | App ID em Configurações → Básico |
| `META_APP_SECRET` | para renovar token | App Secret no mesmo lugar |
| Blob store | sim | Settings → Blob → Connect (o `@vercel/blob` já está no projeto) |

Depois de salvar, faça um Redeploy.

## Token da Meta (o que a Vercel precisa)

Não existe “chave eterna” de usuário. O que não expira é o **token da Página**, desde que venha de um token de usuário de 60 dias, gerado **no app de vocês** (não no Graph API Explorer genérico).

1. Abra [developers.facebook.com/apps](https://developers.facebook.com/apps). Já existe um app ligado a `prumo264@gmail.com` (App ID `1129487102830562`).
2. Em **Configurações → Básico**, copie **App ID** e **App Secret** para `META_APP_ID` e `META_APP_SECRET` na Vercel.
3. Em [Graph API Explorer](https://developers.facebook.com/tools/explorer):
   - Meta App = o app da Prumo (não “Graph API Explorer”)
   - User or Page = **User Token**
   - Permissões: `pages_show_list`, `pages_read_engagement`, `instagram_basic`, `instagram_content_publish`, `business_management`
   - Generate Access Token
4. Troque esse token curto pelo da Página:

```bash
curl -sS -X POST "https://prumo-tawny.vercel.app/api/ig/token" \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"user_token":"EAAB..."}'
```

5. Cole o `META_PAGE_TOKEN` (e o `IG_USER_ID` se vier) na Vercel. **Não commite.**

Atalho no debugger: [Access Token Debugger](https://developers.facebook.com/tools/debug/accesstoken/) → **Extend Access Token** (pede a senha do Facebook) gera os 60 dias; em seguida o POST acima ainda é necessário para obter o token da Página.

## Testar sem esperar o cron

Prévia da arte (não publica):

`https://prumo-tawny.vercel.app/api/og/feed?id=sinais-site-perdendo`

Publicar agora:

```bash
curl -sS "https://prumo-tawny.vercel.app/api/cron/instagram?secret=$CRON_SECRET&force=1"
```

## GitHub Actions (reels)

Secrets: `META_PAGE_TOKEN`, opcional `OPENAI_API_KEY`.  
Variables: `IG_USER_ID`, opcional `OPENAI_MODEL`.

```bash
cd worker && npm install && npx playwright install chromium
DRY_RUN=true node run.mjs
```
