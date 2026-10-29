#!/usr/bin/env bash
set -euo pipefail
URL='https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=https%3A%2F%2Fwww.webprumo.com.br%2F&strategy=mobile&category=performance&category=accessibility&category=seo&category=best-practices'
curl -s "$URL" -o /tmp/psi.json
python3 <<'PY'
import json
d=json.load(open('/tmp/psi.json'))
l=d.get('lighthouseResult',{})
if not l:
  print(d.get('error', d) )
  raise SystemExit(1)
cat=l.get('categories',{})
aud=l.get('audits',{})
print('scores:')
for k,v in cat.items():
  print(f"  {k}: {round((v.get('score') or 0)*100)}")
keys=['largest-contentful-paint','cumulative-layout-shift','total-blocking-time','interaction-to-next-paint','first-contentful-paint','speed-index','render-blocking-resources','unused-javascript','font-display','prioritize-lcp-image','lcp-lazy-loaded']
print('metrics:')
for k in keys:
  a=aud.get(k)
  if not a: continue
  print(f"  {k}: score={a.get('score')} display={a.get('displayValue')}")
PY
