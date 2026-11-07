# -*- coding: utf-8 -*-
"""A2: 从原型单文件 HTML 抽取全量样式 token，并切分「展示壳 / 屏内」两套作用域。

输入：谕心夜色神谕签筒完整可演示Demo.html（视觉唯一真源）
输出：
  miniprogram/styles/tokens.json   —— 变量 / 颜色 token / 字体 / 间距 / 圆角 / 阴影 / 渐变 / 动效 / 规则 / keyframes / px→rpx
  miniprogram/styles/tokens.wxss   —— 变量声明 + 阴影渐变复合 token + keyframes（不含页面布局）
用法：python tools/extract_tokens.py
"""
import io
import os
import re
import json
import hashlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "谕心夜色神谕签筒完整可演示Demo.html")
OUT_JSON = os.path.join(ROOT, "miniprogram", "styles", "tokens.json")
OUT_WXSS = os.path.join(ROOT, "miniprogram", "styles", "tokens.wxss")

SCREEN_W = 306.0
RPX = 750.0
K = RPX / SCREEN_W

# 展示壳专用选择器：这些样式只服务“网页里的手机模型”，小程序里没有对应对象
DEMO_RE = re.compile(r"(^|[\s,>+~(])\.(phone|screen|hero|demo-bar|demo-note|demo-tip|dv|kicker|wrap)\b"
                     r"|^body\b|^h1\b|^footer\b|^html\b")

# 裸色值语义命名（hex，屏内仍在用的）
HEX_NAMES = {
    "#4a3417": "cardink",
    "#7c5a24": "wooddeep",
    "#a99f8e": "inkmute",
    "#b08a3f": "woodmid",
    "#12111c": "night0",
    "#241b12": "backdeep",
    "#e6e1d4": "textlight",
    "#ffb35c": "ember",
    "#0a0d18": "canvasbg",
    "#0e0a04": "mouthdark",
    "#241a09": "mouth",
    "#2c2008": "woodinner",
    "#3a2c1a": "backtop",
    "#5d4216": "stickedge",
    "#6b4a1d": "woodbody",
    "#8e7f63": "ashdeep",
    "#b9a98a": "ashlight",
    "#96722f": "stickline",
    "#9c7b3c": "coincore",
    "#a97b33": "woodlight",
    "#dec98f": "stickshade",
    "#f2e4bc": "sticklight",
    "#e3c586": "rim",
    "#e8c98a": "stickglow",
    "#fff6de": "starcore",
}

# 同一个色值被多个变量引用时，取语义最基础的那个作为规范名
PREFERRED = ["--ink", "--gold", "--gold-deep", "--gold-soft", "--card-a", "--card-b",
             "--sky-1", "--sky-2", "--sky-3", "--shell-1", "--shell-2", "--shell-line",
             "--nav-text", "--nav-bg", "--nav-line", "--green", "--red", "--moon-1", "--moon-2",
             "--moon-glow", "--btn-a", "--btn-b", "--btn-text", "--ghost-text", "--ghost-bg",
             "--ghost-line", "--card-line", "--tint-bg", "--tint-line", "--qian-line", "--star"]

# rgba 的 rgb 部分没有现成 hex token 时，用这些family 命名
BASE_RGB = {
    "0,0,0": "black",
    "255,255,255": "white",
    "11,14,26": "night",
    "20,20,31": "shellbg",
    "140,100,40": "wood",
    "190,150,70": "coin",
    "238,214,150": "warm",
    "216,201,170": "holder",
    "233,226,210": "cardline",
    "243,239,230": "bone",
    "255,226,160": "sunk",
    "255,240,210": "hilite",
    "130,95,40": "woodshadow",
}

PREFIX_STRIP = ("t", "q", "c", "e", "ob", "dv", "sh", "p", "lv", "vip", "btn", "qian", "tarot")


def rpx(px, font=False):
    v = px * K
    if font:
        return round(v * 2) / 2.0
    return round(v, 1)


def split_decls(body):
    out, buf, paren, q = [], "", 0, None
    for ch in body:
        if q:
            buf += ch
            if ch == q:
                q = None
            continue
        if ch in "\"'":
            q = ch
            buf += ch
        elif ch == "(":
            paren += 1
            buf += ch
        elif ch == ")":
            paren -= 1
            buf += ch
        elif ch == ";" and paren == 0:
            out.append(buf)
            buf = ""
        else:
            buf += ch
    if buf.strip():
        out.append(buf)
    res = []
    for d in out:
        if ":" not in d:
            continue
        p, v = d.split(":", 1)
        p, v = p.strip(), v.strip()
        if p:
            res.append((p, v))
    return res


def parse_blocks(text):
    out, i, n = [], 0, len(text)
    while i < n:
        while i < n and text[i] in " \t\r\n":
            i += 1
        if i >= n:
            break
        if text[i:i + 2] == "/*":
            j = text.find("*/", i)
            i = n if j < 0 else j + 2
            continue
        start, paren, q = i, 0, None
        while i < n:
            ch = text[i]
            if q:
                if ch == q:
                    q = None
            elif ch in "\"'":
                q = ch
            elif ch == "(":
                paren += 1
            elif ch == ")":
                paren -= 1
            elif paren == 0 and ch in "{};":
                break
            i += 1
        head = text[start:i].strip()
        if i < n and text[i] == "{":
            j, depth, q = i + 1, 1, None
            while j < n and depth:
                ch = text[j]
                if q:
                    if ch == q:
                        q = None
                elif ch in "\"'":
                    q = ch
                elif ch == "{":
                    depth += 1
                elif ch == "}":
                    depth -= 1
                j += 1
            out.append((head, text[i + 1:j - 1], text.count("\n", 0, start) + 1))
            i = j
        else:
            i += 1
    return out


HEX_RE = re.compile(r"#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b")
RGBA_RE = re.compile(r"\brgba?\(([^)]*)\)")
GRAD_START_RE = re.compile(r"(?:repeating-)?(?:linear|radial)-gradient\(")


def find_gradients(v):
    out, pos = [], 0
    while True:
        m = GRAD_START_RE.search(v, pos)
        if not m:
            break
        depth, j = 0, m.end() - 1
        while j < len(v):
            if v[j] == "(":
                depth += 1
            elif v[j] == ")":
                depth -= 1
                if depth == 0:
                    j += 1
                    break
            j += 1
        out.append(v[m.start():j])
        pos = j
    return out


def norm_rgba(m):
    nums = [x.strip() for x in m.group(1).split(",")]
    return "rgba(%s)" % ",".join(nums)


def role_of(sel):
    """从选择器推一个短角色名，用于阴影/渐变 token 命名（保留伪元素与状态，避免同名冲突）。"""
    s = sel
    pseudo = ""
    if "::" in s:
        s, p = s.split("::", 1)
        pseudo = "-" + (re.sub(r"[^a-z]", "", p.split(",")[0]) or "pe")
    states = []
    for st in ("hover", "focus", "active", "disabled"):
        if ":%s" % st in s:
            states.append(st)
            s = s.replace(":%s" % st, "")
    for st in ("on", "cur", "out"):
        if "." + st in s:
            states.append(st)
            s = s.replace("." + st, "")
    s = re.sub(r"\[[^\]]*\]", "", s)
    parts = [x for x in re.split(r"[ >+~]+", s.strip()) if x]
    if not parts:
        return "x"
    last = parts[-1].lstrip(".#").replace(".", "-")
    seg = last.split("-")
    if len(seg) > 1 and seg[0] in PREFIX_STRIP:
        last = "-".join(seg[1:])
    last = re.sub(r"[^a-z0-9-]", "", last.lower()) or "x"
    if states:
        last += "-" + "-".join(states)
    return last + pseudo


def is_demo(sel):
    """按 DOM 归属判定：选择器里的类名若在页面标记里出现过，就是屏内样式。

    单靠类名黑名单会漏掉 .sub / .vswitch 这类演示专用类（它们出现在手机壳外），
    所以改为正向判定：页面标记里没有这个类 → 展示壳。
    """
    if DEMO_RE.search(sel):
        return True
    classes = set(re.findall(r"\.(-?[_a-zA-Z][_a-zA-Z0-9-]*)", sel))
    if not classes:
        return False
    if classes & APP_CLASSES:
        return False
    return True


APP_CLASSES = set()


def main():
    raw = open(SRC, "rb").read()
    text = io.open(SRC, encoding="utf-8").read()
    m = re.search(r"<style[^>]*>(.*?)</style>", text, re.S)
    css = m.group(1)
    css_line0 = text[:m.start(1)].count("\n") + 1

    rules, keyframes = [], []
    # 页面标记里出现过的类名 = 屏内样式（另外显式补上星空、tabBar、自绘状态栏）
    start = text.index('<div class="page')
    frag = text[start:]
    for c in re.findall(r'class="([^"]+)"', frag):
        for tok in c.split():
            APP_CLASSES.add(tok)
    APP_CLASSES.update({"stars", "pnav", "star", "status"})
    for head, body, line in parse_blocks(css):
        ln = line + css_line0 - 1
        if head.startswith("@keyframes"):
            name = head.split(None, 1)[1].strip()
            steps = [{"at": sh, "decls": [{"p": p, "v": v} for p, v in split_decls(sb)]}
                     for sh, sb, _ in parse_blocks(body)]
            keyframes.append({"name": name, "line": ln, "steps": steps})
            continue
        if head.startswith("@"):
            continue
        rules.append({"sel": head, "line": ln, "scope": "demo" if is_demo(head) else "app",
                      "decls": [{"p": p, "v": v} for p, v in split_decls(body)]})

    # ---------- 变量 ----------
    var_owner, var_raw_count = {}, 0
    for r in rules:
        for d in r["decls"]:
            if d["p"].startswith("--"):
                var_raw_count += 1
                e = var_owner.setdefault(d["p"], {"value": d["v"], "selectors": [], "line": r["line"],
                                                  "scope": r["scope"]})
                if r["sel"] not in e["selectors"]:
                    e["selectors"].append(r["sel"])
                e["value"] = d["v"]

    # ---------- 颜色 ----------
    color_use = {}

    def add_color(key, kind, sel, prop, scope, line):
        e = color_use.setdefault(key, {"kind": kind, "vars": [], "uses": [], "scopes": set()})
        e["uses"].append({"sel": sel, "p": prop, "line": line})
        e["scopes"].add(scope)

    for r in rules:
        for d in r["decls"]:
            v = d["v"]
            for h in HEX_RE.findall(v):
                add_color(h.lower(), "hex", r["sel"], d["p"], r["scope"], r["line"])
            for mm in RGBA_RE.finditer(v):
                add_color(norm_rgba(mm).replace(" ", "").lower().replace("rgba(", "rgba("), "rgba",
                          r["sel"], d["p"], r["scope"], r["line"])
            for g in find_gradients(v):
                add_color(re.sub(r"\s+", " ", g).strip(), "gradient", r["sel"], d["p"], r["scope"], r["line"])

    for name, info in var_owner.items():
        val = info["value"]
        for h in HEX_RE.findall(val):
            e = color_use.setdefault(h.lower(), {"kind": "hex", "vars": [], "uses": [], "scopes": set()})
            if name not in e["vars"]:
                e["vars"].append(name)
        for mm in RGBA_RE.finditer(val):
            key = norm_rgba(mm).replace(" ", "").lower()
            e = color_use.setdefault(key, {"kind": "rgba", "vars": [], "uses": [], "scopes": set()})
            if name not in e["vars"]:
                e["vars"].append(name)

    # 语义命名
    rgb2token = {}
    for key, info in color_use.items():
        if info["kind"] != "hex":
            continue
        cand = [v for v in PREFERRED if v in info["vars"]] or info["vars"]
        tok = (cand[0] if cand else "--" + HEX_NAMES.get(key, "c" + key[1:]))[2:]
        info["token"] = "--" + tok
        rgb2token[tuple(int(key[i:i + 2], 16) for i in (1, 3, 5))] = tok

    for key, info in list(color_use.items()):
        if info["kind"] != "rgba":
            continue
        # 已经以变量形式存在于 :root 的 rgba，直接沿用变量名（避免出现 --cardline-a60 与 --card-line 并存）
        if info["vars"]:
            cand = [v for v in PREFERRED if v in info["vars"]] or info["vars"]
            info["token"] = cand[0]
            continue
        inner = key[5:-1].split(",")
        rgb = ",".join(inner[:3])
        alpha = inner[3] if len(inner) > 3 else "1"
        try:
            a = float(alpha)
        except ValueError:
            a = 1.0
        triple = tuple(int(float(x)) for x in inner[:3])
        base = rgb2token.get(triple)
        if not base:
            base = BASE_RGB.get(rgb, "c" + "".join("%02x" % x for x in triple))
        info["token"] = "--%s-a%02d" % (base, int(round(a * 100)))
        info["base"] = base

    for key, info in list(color_use.items()):
        if info["kind"] == "gradient":
            continue  # 渐变不做 token：几何与色标不可拆，A4 内联写并在色标处引用 var
        # 有变量寄生的颜色一律视为屏内资源（变量会被页面直接引用）
        if info.get("vars"):
            info["scopes"].add("app")

    # 同名 token 冲突时加序号
    used = {}
    for key, info in color_use.items():
        tok = info.get("token")
        if not tok:
            continue
        if tok in used:
            used[tok] += 1
            if info["kind"] == "gradient":
                info["token"] = "%s-%d" % (tok, used[tok])
        else:
            used[tok] = 1

    # ---------- 其余分类 ----------
    font_family, font_size, line_height, letter_spacing = {}, {}, {}, {}
    radius, shadow = {}, {}
    for r in rules:
        for d in r["decls"]:
            if d["p"] == "font-family":
                font_family.setdefault(d["v"], []).append(r["sel"])
            elif d["p"] == "font-size":
                font_size.setdefault(d["v"], []).append({"sel": r["sel"], "scope": r["scope"]})
            elif d["p"] == "line-height":
                line_height.setdefault(d["v"], []).append(r["sel"])
            elif d["p"] == "letter-spacing":
                letter_spacing.setdefault(d["v"], []).append(r["sel"])
            elif d["p"] in ("border-radius", "border-top-left-radius", "border-top-right-radius",
                            "border-bottom-left-radius", "border-bottom-right-radius"):
                radius.setdefault("%s: %s" % (d["p"], d["v"]), []).append(r["sel"])
            elif d["p"] in ("box-shadow", "text-shadow"):
                shadow.setdefault("%s: %s" % (d["p"], d["v"]), []).append({"sel": r["sel"], "scope": r["scope"]})

    shadow_tokens = []
    seen_sh = {}
    for k, v in shadow.items():
        prop, val = k.split(":", 1)
        val = val.strip()
        app = [x for x in v if x["scope"] == "app"]
        tok = None
        if app:
            base = "--sh-" + role_of(app[0]["sel"])
            n = seen_sh.get(base, 0) + 1
            seen_sh[base] = n
            tok = base if n == 1 else "%s-%d" % (base, n)
        shadow_tokens.append({"token": tok, "prop": prop.strip(), "value": val,
                              "selectors": [x["sel"] for x in v],
                              "scope": "app" if app else "demo"})

    # ---------- px → rpx ----------
    px_map = {}
    for r in rules:
        for d in r["decls"]:
            for num in re.findall(r"(-?\d*\.?\d+)px", d["v"]):
                f = float(num)
                e = px_map.setdefault(num, {"px": f, "rpx": rpx(f), "rpxFont": rpx(f, True), "count": 0,
                                            "props": [], "selectors": [], "scopes": set()})
                e["count"] += 1
                if d["p"] not in e["props"]:
                    e["props"].append(d["p"])
                if r["sel"] not in e["selectors"]:
                    e["selectors"].append(r["sel"])
                e["scopes"].add(r["scope"])
    for kf in keyframes:
        for st in kf["steps"]:
            for d in st["decls"]:
                for num in re.findall(r"(-?\d*\.?\d+)px", d["v"]):
                    f = float(num)
                    e = px_map.setdefault(num, {"px": f, "rpx": rpx(f), "rpxFont": rpx(f, True), "count": 0,
                                                "props": [], "selectors": [], "scopes": set()})
                    e["count"] += 1
                    if d["p"] not in e["props"]:
                        e["props"].append(d["p"])
                    tag = "@" + kf["name"]
                    if tag not in e["selectors"]:
                        e["selectors"].append(tag)
                    e["scopes"].add("app")

    # ---------- 动效 ----------
    motion = []
    for r in rules:
        acc = {}
        for d in r["decls"]:
            if d["p"] == "animation":
                for p in re.findall(r"[A-Za-z0-9_-]+\([^)]*\)|\S+", d["v"]):
                    if re.match(r"^[A-Za-z][A-Za-z0-9_-]*$", p) and p not in (
                            "linear", "ease", "ease-in", "ease-out", "ease-in-out", "infinite",
                            "forwards", "backwards", "both", "alternate", "reverse", "normal", "none"):
                        acc.setdefault("name", p)
                    elif p.endswith("ms") or p.endswith("s"):
                        if "duration" in acc:
                            acc.setdefault("delay", p)
                        else:
                            acc["duration"] = p
                    elif p in ("linear", "ease", "ease-in", "ease-out", "ease-in-out") or p.startswith("cubic-bezier"):
                        acc.setdefault("easing", p)
                    elif p == "infinite":
                        acc.setdefault("iteration", p)
                    elif p in ("forwards", "backwards", "both"):
                        acc.setdefault("fill", p)
                    elif p in ("normal", "reverse", "alternate"):
                        acc.setdefault("direction", p)
            elif d["p"] == "transition":
                motion.append({"sel": r["sel"], "kind": "transition", "value": d["v"], "line": r["line"]})
            elif d["p"].startswith("animation-"):
                acc[d["p"].replace("animation-", "")] = d["v"]
        if acc:
            acc.update({"sel": r["sel"], "kind": "animation", "line": r["line"],
                        "scope": r["scope"]})
            motion.append(acc)

    # ---------- tokens.wxss ----------
    out = []
    out.append("/* 由 tools/extract_tokens.py 生成，勿手改。")
    out.append("   源：谕心夜色神谕签筒完整可演示Demo.html  SHA256 " + hashlib.sha256(raw).hexdigest().upper())
    out.append("   306px ↔ 750rpx，k = %.6f；字号已按 0.5rpx 取整口径登记在 tokens.json */" % K)
    # .yx-varscope：自定义 tabBar 是独立层，page 上的变量进不去组件，
    # 所以变量同时挂在 .yx-varscope 上，组件根节点加这个 class 即可自洽取色
    out.append("page, .yx-varscope {")
    for name in sorted(var_owner, key=lambda x: (var_owner[x]["line"], x)):
        out.append("  %s: %s;" % (name, var_owner[name]["value"]))
    out.append("")
    out.append("  /* 以下为 A2 新增：原型裸色值按语义归并，值与原文字面完全一致 */")
    emitted = set(var_owner)
    for key, info in sorted(color_use.items(), key=lambda kv: kv[1].get("token") or ""):
        tok = info.get("token")
        if not tok or tok in emitted or info["kind"] in ("gradient",):
            continue
        if "app" not in info["scopes"]:
            continue
        emitted.add(tok)
        val = key
        out.append("  %s: %s;" % (tok, val))
    out.append("")
    out.append("  /* 复合 token：阴影与渐变整条搬运，避免拆散后走形 */")
    for st in shadow_tokens:
        if st["token"] and st["scope"] == "app":
            out.append("  %s: %s;" % (st["token"], st["value"]))
    out.append("}")
    out.append("")
    for kf in keyframes:
        out.append("@keyframes %s {" % kf["name"])
        for st in kf["steps"]:
            out.append("  %s {" % st["at"])
            for d in st["decls"]:
                out.append("    %s: %s;" % (d["p"], d["v"]))
            out.append("  }")
        out.append("}")
        out.append("")

    data = {
        "meta": {
            "source": os.path.basename(SRC),
            "bytes": len(raw),
            "sha256": hashlib.sha256(raw).hexdigest().upper(),
            "lines": text.count("\n") + 1,
            "styleLineRange": [css_line0, text[:m.end(1)].count("\n") + 1],
            "screenWidthPx": SCREEN_W,
            "rpxBase": RPX,
            "k": K,
            "ruleCount": len(rules),
            "ruleApp": len([r for r in rules if r["scope"] == "app"]),
            "ruleDemo": len([r for r in rules if r["scope"] == "demo"]),
            "keyframeCount": len(keyframes),
            "varCount": len(var_owner),
            "varRawCount": var_raw_count,
            "pxValueCount": len(px_map),
            "colorCount": len(color_use),
            "generatedAt": None,
        },
        "vars": [{"name": n, "value": v["value"], "selectors": v["selectors"], "line": v["line"],
                  "scope": v["scope"],
                  "rpx": (rpx(float(v["value"][:-2])) if re.fullmatch(r"-?\d*\.?\d+px", v["value"]) else None)}
                 for n, v in sorted(var_owner.items(), key=lambda kv: (kv[1]["line"], kv[0]))],
        "colors": [{"value": k, "kind": v["kind"], "token": v.get("token"), "vars": v["vars"],
                    "uses": v["uses"], "scopes": sorted(v["scopes"]),
                    "appUses": len([u for u in v["uses"] if not is_demo(u["sel"]) or u["sel"] == ":root"])}
                   for k, v in sorted(color_use.items(), key=lambda kv: (-len(kv[1]["uses"]), kv[0]))
                   if v["kind"] != "gradient"],
        "gradients": [{"value": k, "scopes": sorted(v["scopes"]),
                       "uses": v["uses"],
                       "appUses": len([u for u in v["uses"] if not is_demo(u["sel"])])}
                      for k, v in sorted(color_use.items(), key=lambda kv: (-len(kv[1]["uses"]), kv[0]))
                      if v["kind"] == "gradient"],
        "fontFamily": [{"value": k, "selectors": v} for k, v in font_family.items()],
        "fontSize": [{"value": k, "rpx": rpx(float(re.findall(r"[\d.]+", k)[0]), True),
                      "count": len(v), "appCount": len([x for x in v if x["scope"] == "app"]),
                      "selectors": [x["sel"] for x in v]} for k, v in
                     sorted(font_size.items(), key=lambda kv: -float(re.findall(r"[\d.]+", kv[0])[0]))],
        "lineHeight": [{"value": k, "selectors": v} for k, v in line_height.items()],
        "letterSpacing": [{"value": k, "selectors": v} for k, v in letter_spacing.items()],
        "radius": [{"value": k, "selectors": v} for k, v in radius.items()],
        "shadow": shadow_tokens,
        "motion": motion,
        "px2rpx": [{"px": v["px"], "rpx": v["rpx"], "rpxFont": v["rpxFont"], "count": v["count"],
                    "props": v["props"], "selectors": v["selectors"], "scopes": sorted(v["scopes"])}
                   for v in sorted(px_map.values(), key=lambda e: e["px"])],
        "keyframes": keyframes,
        "rules": rules,
    }

    os.makedirs(os.path.dirname(OUT_JSON), exist_ok=True)
    with io.open(OUT_JSON, "w", encoding="utf-8", newline="\n") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    with io.open(OUT_WXSS, "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(out) + "\n")

    print("rules", len(rules), "(app %d / demo %d)" % (data["meta"]["ruleApp"], data["meta"]["ruleDemo"]))
    print("keyframes", len(keyframes), "vars", len(var_owner), "varRaw", var_raw_count,
          "colors", len(color_use), "px", len(px_map), "shadow", len(shadow_tokens), "motion", len(motion))
    print("json", os.path.getsize(OUT_JSON), "wxss", os.path.getsize(OUT_WXSS))


if __name__ == "__main__":
    main()
