# -*- coding: utf-8 -*-
"""把原型 tabBar 的 5 个内联 SVG 图标（.ic-home/.ic-ask/.ic-tree/.ic-ritual/.ic-me）抽成 WXSS。

图形一个像素都不重画：直接搬运原型里的 background-image data-URI，只把 px 换成 rpx。
"""
import io
import json
import re

ROOT = r"E:\miniprogram\yuxin"
K = 750.0 / 306.0
d = json.load(io.open(ROOT + r"\miniprogram\styles\tokens.json", encoding="utf-8"))


def conv(v):
    def rep(m):
        n = float(m.group(1))
        return "0" if n == 0 else str(round(n * K, 1)).rstrip("0").rstrip(".") + "rpx"
    return re.sub(r"(-?\d*\.?\d+)px", rep, v)


out = ["/* 由 tools/gen_tab_icons.py 从原型 .ic-* 抽取，勿手改。 */", ""]
order = ["home", "ask", "tree", "ritual", "me"]
n = 0
for r in d["rules"]:
    m = re.match(r"^\.ic-(home|ask|tree|ritual|me)(::before)?$", r["sel"])
    if not m:
        continue
    name = m.group(1)
    idx = order.index(name) + 1
    for pref in (".ic-%s" % name, ".tab-%d" % idx):
        decls = "; ".join("%s:%s" % (x["p"], conv(x["v"])) for x in r["decls"])
        out.append("%s%s {%s;}" % (pref, m.group(2) or "", decls))
        n += 1
io.open(ROOT + r"\miniprogram\styles\tabbar-icons.wxss", "w", encoding="utf-8", newline="\n").write("\n".join(out) + "\n")
print("icons", n)
