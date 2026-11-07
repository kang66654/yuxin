# -*- coding: utf-8 -*-
"""把需要的规则导出成文本，便于在无法直接看 stdout 时读取。"""
import io
import json

ROOT = r"E:\miniprogram\yuxin"
d = json.load(io.open(ROOT + r"\miniprogram\styles\tokens.json", encoding="utf-8"))
keys = ["pnav", "status", "stars", "vip-tag", "sq-top", "sq-mid", "sq-bottom", "page-hd .pt", "page-hd .ps",
        ".pt{", "pbody", "screen", "phone", "page{", "app-"]
out = []
for r in d["rules"]:
    sel = r["sel"]
    if any(k.strip("{").lstrip(".") in sel for k in keys) or sel in (".page", ".pbody", ".pt", ".ps"):
        out.append("L%-4d %-38s %-5s | %s" % (
            r["line"], sel[:38], r["scope"],
            "; ".join("%s:%s" % (x["p"], x["v"]) for x in r["decls"])))

src = io.open(ROOT + r"\谕心夜色神谕签筒完整可演示Demo.html", encoding="utf-8").read().split("\n")
for i, l in enumerate(src, 1):
    if "pnav" in l or "statusTag" in l:
        out.append("HTML %d %s" % (i, l.strip()[:300]))

io.open(ROOT + r"\docs\.probe.txt", "w", encoding="utf-8", newline="\n").write("\n".join(out))
print("lines", len(out))
