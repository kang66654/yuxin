# -*- coding: utf-8 -*-
import io
import json

ROOT = r"E:\miniprogram\yuxin"
d = json.load(io.open(ROOT + r"\miniprogram\styles\tokens.json", encoding="utf-8"))
lines = []
for r in d["rules"]:
    if "nth-child" in r["sel"] or "pnav" in r["sel"]:
        lines.append("%-46s %s | %s" % (r["sel"], r["scope"], "; ".join("%s:%s" % (x["p"], x["v"]) for x in r["decls"])))
io.open(ROOT + r"\docs\.probe2.txt", "w", encoding="utf-8", newline="\n").write("\n".join(lines))
print("lines", len(lines))
