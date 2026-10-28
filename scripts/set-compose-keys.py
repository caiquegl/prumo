#!/usr/bin/env python3
"""Write ORSHOT/JSON2VIDEO keys into .env.local from argv. Does not print values."""
import sys
from pathlib import Path

if len(sys.argv) != 3:
    print("usage: set-compose-keys.py <ORSHOT_KEY> <JSON2VIDEO_KEY>", file=sys.stderr)
    sys.exit(1)

repl = {
    "ORSHOT_API_KEY": sys.argv[1].strip(),
    "JSON2VIDEO_API_KEY": sys.argv[2].strip(),
}
p = Path("/home/hitss/prumo/.env.local")
text = p.read_text() if p.exists() else ""
lines = text.splitlines()
out = []
seen = set()
for line in lines:
    if "=" in line and not line.strip().startswith("#"):
        k = line.split("=", 1)[0]
        if k in repl:
            out.append(f"{k}={repl[k]}")
            seen.add(k)
            continue
    out.append(line)
for k, v in repl.items():
    if k not in seen:
        out.append(f"{k}={v}")
p.write_text("\n".join(out) + "\n")
print("wrote", sorted(repl))
