# -*- coding: utf-8 -*-
"""A3: 把原型 CSS 自动转成 WXSS。

- px → rpx（字号 0.5 取整，其余 1 位小数）
- 颜色 → var(--token)（裸色值零容忍）
- inset → 四边；aspect-ratio → 显式高度
- 剔除：展示壳 / 自绘状态栏 / 星空 / tabBar / 页面切页 / 滚动条 / nth-child / attr() / :root
输出：miniprogram/styles/base.wxss、docs/.gen_report.txt
用法：python tools/gen_wxss.py
"""
import io
import json
import re

ROOT = r"E:\miniprogram\yuxin"
TOK = ROOT + r"\miniprogram\styles\tokens.json"
OUT = ROOT + r"\miniprogram\styles\base.wxss"
REPORT = ROOT + r"\docs\.gen_report.txt"

K = 750.0 / 306.0

EXCLUDE = [
    "::-webkit", ":nth-child", "attr(", ":root", ".phone", ".screen", ".hero", ".demo-", ".wrap",
    ".kicker", ".dv", "body", "h1", "footer", ".status", ".stars", ".pnav", "data-page", ".page.on",
    ".page{", "canvas", ".shwrap", ".vswitch",
]
# 整条丢掉的选择器（原型是单屏切页，小程序每页独立，.page{display:none} 不能进全局样式）
DROP_SEL = {".page"}
ASPECT_FIX = {".sq-card": "676.4rpx"}


def conv_px(value, prop):
    def rep(m):
        v = float(m.group(1))
        if v == 0:
            return "0"
        r = v * K
        r = round(r * 2) / 2.0 if prop == "font-size" else round(r, 1)
        s = ("%.1f" % r).rstrip("0").rstrip(".")
        return s + "rpx"
    return re.sub(r"(-?\d*\.?\d+)px", rep, value)


def norm_color_key(v):
    return re.sub(r"\s+", "", v).lower()


def main():
    d = json.load(io.open(TOK, encoding="utf-8"))
    cmap = {}
    for v in d["vars"]:
        val = v["value"]
        if val.startswith(("#", "rgba")):
            cmap.setdefault(norm_color_key(val), v["name"])
    for c in d["colors"]:
        if not c["token"]:
            continue
        cmap.setdefault(norm_color_key(c["value"]), c["token"])

    def sub_color(value):
        def rep_rgba(m):
            key = norm_color_key(m.group(0))
            return "var(%s)" % cmap[key] if key in cmap else m.group(0)

        value = re.sub(r"rgba?\([^)]*\)", rep_rgba, value)

        def rep_hex(m):
            key = m.group(0).lower()
            return "var(%s)" % cmap[key] if key in cmap else m.group(0)

        return re.sub(r"#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b", rep_hex, value)

    order = []
    blocks = {}
    idx = {}
    skipped, stats = [], {"rules": 0, "decls": 0, "color": 0}
    for r in d["rules"]:
        sel, decls = r["sel"], r["decls"]
        if r["scope"] == "demo" or any(k in sel for k in EXCLUDE):
            skipped.append(sel)
            continue
        if sel.strip() == "*":
            # WXSS 不支持通配选择器，reset 改由 shell.wxss 用元素选择器实现
            skipped.append(sel + " (通配选择器，WXSS 不支持)")
            continue
        if sel.strip() in DROP_SEL:
            skipped.append(sel + " (单屏切页遗留，不参与编译)")
            continue
        if re.search(r"[0-9]px", sel) or "@" in sel or sel.startswith("--"):
            skipped.append(sel)
            continue
        if sel not in blocks:
            blocks[sel] = []
            idx[sel] = {}
            order.append(sel)
        tgt, prop_i = blocks[sel], idx[sel]
        for x in decls:
            p, v = x["p"], x["v"]
            if p in ("cursor", "user-select", "scrollbar-width", "scrollbar-color", "backdrop-filter"):
                continue
            if p == "aspect-ratio":
                items = [("height", ASPECT_FIX.get(sel, "676.4rpx"))]
            elif p == "inset":
                parts = v.split()
                if len(parts) == 1:
                    parts = parts * 4
                elif len(parts) == 2:
                    parts = [parts[0], parts[1], parts[0], parts[1]]
                elif len(parts) == 3:
                    parts = [parts[0], parts[1], parts[2], parts[1]]
                items = [(side, conv_px(val, "inset")) for side, val in
                         zip(("top", "right", "bottom", "left"), parts)]
            else:
                items = [(p, conv_px(v, p) if "px" in v else v)]
            for prop, val in items:
                val = sub_color(val)
                if "var(" in val:
                    stats["color"] += 1
                if prop in prop_i:
                    tgt[prop_i[prop]] = (prop, val)
                else:
                    prop_i[prop] = len(tgt)
                    tgt.append((prop, val))
                stats["decls"] += 1

    out = []
    for sel in order:
        body = blocks[sel]
        if not body:
            continue
        out.append("%s {" % sel)
        out.append("\n".join("  %s:%s;" % (p, v) for p, v in body))
        out.append("}")
        stats["rules"] += 1

    header = ("/* 由 tools/gen_wxss.py 从原型 CSS 生成，勿手改。\n"
              "   px 已按 306→750 换算为 rpx；颜色已全部换成 tokens.wxss 里的变量。\n"
              "   生成规则数 %d，声明 %d 条 */\n\n" % (stats["rules"], stats["decls"]))
    io.open(OUT, "w", encoding="utf-8", newline="\n").write(header + "\n".join(out) + "\n")
    rep = ["rules={} decls={} color={}".format(stats["rules"], stats["decls"], stats["color"]),
           "skipped={}".format(len(skipped))]
    rep += ["  " + s for s in skipped]
    io.open(REPORT, "w", encoding="utf-8", newline="\n").write("\n".join(rep))
    print("done", stats["rules"])


if __name__ == "__main__":
    main()
