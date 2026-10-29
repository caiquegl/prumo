import json
d = json.load(open("/tmp/lh.json"))
cat = d.get("categories", {})
aud = d.get("audits", {})
print("scores:")
for k, v in cat.items():
    print(f"  {k}: {round((v.get('score') or 0) * 100)}")
print("metrics:")
for k in [
    "largest-contentful-paint",
    "cumulative-layout-shift",
    "total-blocking-time",
    "first-contentful-paint",
    "speed-index",
]:
    a = aud.get(k, {})
    print(f"  {k}: {a.get('displayValue')} score={a.get('score')}")
