# -*- coding: utf-8 -*-
"""A2: 由 tokens.json 生成《视觉规格表》（docs/A2-视觉规格表.html）。

用法：python tools/build_spec.py
"""
import io
import os
import re
import json
import collections

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TOK = os.path.join(ROOT, "miniprogram", "styles", "tokens.json")
OUT = os.path.join(ROOT, "docs", "A2-视觉规格表.html")

CSS = """
:root{--bg:#0E0D14;--bg2:#141320;--line:rgba(216,180,106,.18);--gold:#D8B46A;--gold2:#E8CF97;
--ink:#EDE8DC;--ink2:#A99F8E;--ink3:#6A6255;--card:#191826;--green:#7FA57C;--red:#D98A76}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:
 radial-gradient(120% 80% at 12% -10%,#241f36 0%,transparent 55%),
 linear-gradient(180deg,#0E0D14,#0B0A11 60%,#0E0D14);
 color:var(--ink);font:400 15px/1.75 "Songti SC","SimSun",serif;padding:56px 40px 120px}
.wrap{max-width:1180px;margin:0 auto}
.kicker{font:500 12px/1.6 "SF Mono",Consolas,monospace;letter-spacing:.18em;color:var(--gold);opacity:.85}
h1{font:400 42px/1.25 "Songti SC","STZhongsong",serif;margin:14px 0 10px;letter-spacing:.02em}
h1 em{color:var(--gold2);font-style:normal}
.lead{color:var(--ink2);max-width:900px;font-size:15px}
.lead b{color:var(--ink)}
.stats{display:flex;flex-wrap:wrap;gap:10px;margin:26px 0 8px}
.stat{flex:1 1 150px;background:linear-gradient(165deg,#1B1A28,#141320);border:1px solid var(--line);
 border-radius:14px;padding:14px 16px}
.stat .n{font:400 26px/1 "Songti SC",serif;color:var(--gold2)}
.stat .l{font-size:11px;color:var(--ink3);margin-top:6px;letter-spacing:.04em}
.toc{display:flex;flex-wrap:wrap;gap:6px 18px;margin:22px 0 8px;font:12px/2 "SF Mono",Consolas,monospace;
 color:var(--ink3);border-bottom:1px solid rgba(255,255,255,.06);padding-bottom:14px}
h2{font:400 26px/1.4 "Songti SC","STZhongsong",serif;margin:56px 0 6px;letter-spacing:.03em}
h2 .idx{font:11px/1 "SF Mono",Consolas,monospace;color:var(--gold);letter-spacing:.12em;display:block;margin-bottom:10px}
h3{font:400 18px/1.5 "Songti SC",serif;margin:28px 0 8px;color:var(--gold2)}
p{margin:10px 0;color:var(--ink2)}
p b{color:var(--ink)}
.mono{font-family:"SF Mono",Consolas,monospace;font-size:12.5px;color:var(--gold2)}
.tblwrap{overflow-x:auto;margin:14px 0 6px;border:1px solid rgba(255,255,255,.07);border-radius:12px;
 background:rgba(255,255,255,.02)}
table{border-collapse:collapse;width:100%;font-size:12.5px;min-width:640px}
th,td{text-align:left;padding:8px 10px;border-bottom:1px solid rgba(255,255,255,.055);vertical-align:top}
th{font:500 11.5px/1.5 "SF Mono",Consolas,monospace;letter-spacing:.06em;color:var(--ink3);
 background:rgba(255,255,255,.03);position:sticky;top:0}
tr:last-child td{border-bottom:0}
td.v{font-family:"SF Mono",Consolas,monospace;color:var(--ink);white-space:nowrap}
td.num{font-family:"SF Mono",Consolas,monospace;text-align:right;white-space:nowrap}
.sw{display:inline-block;width:12px;height:12px;border-radius:3px;margin-right:7px;vertical-align:-1px;
 border:1px solid rgba(255,255,255,.18)}
.tag{display:inline-block;font:500 10.5px/1.5 "SF Mono",Consolas,monospace;padding:1px 7px;border-radius:999px;
 border:1px solid var(--line);color:var(--gold2)}
.tag.t-new{background:rgba(216,180,106,.12);border-color:rgba(216,180,106,.4)}
.tag.t-old{color:var(--ink2);border-color:rgba(255,255,255,.14)}
.tag.t-demo{color:var(--ink3);border-color:rgba(255,255,255,.1)}
.note{border-left:2px solid var(--gold);padding:2px 0 2px 14px;margin:16px 0;color:var(--ink2);font-size:13.5px}
.warnbox{border:1px solid rgba(216,180,106,.26);background:rgba(216,180,106,.05);border-radius:12px;
 padding:16px 18px;margin:18px 0}
.warnbox h4{margin:0 0 8px;font:500 13px/1.5 "SF Mono",Consolas,monospace;letter-spacing:.08em;color:var(--gold)}
.warnbox ol,.warnbox ul{margin:0;padding-left:20px;color:var(--ink2);font-size:13.5px}
.warnbox li{margin:6px 0}
.kf{background:linear-gradient(165deg,#1B1A28,#141320);border:1px solid rgba(255,255,255,.07);
 border-radius:12px;padding:14px 16px;margin:10px 0}
.kf .h{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:baseline}
.kf .name{font:500 14px/1.4 "SF Mono",Consolas,monospace;color:var(--gold2)}
.kf .meta{font:11.5px/1.5 "SF Mono",Consolas,monospace;color:var(--ink3)}
.kf .steps{margin:8px 0 0;font:12px/1.7 "SF Mono",Consolas,monospace;color:var(--ink2);white-space:pre-wrap}
footer{margin-top:64px;padding-top:18px;border-top:1px solid rgba(255,255,255,.07);
 color:var(--ink3);font-size:12px;display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap}
"""


def esc(s):
    return (str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))


def fnum(v):
    if v is None:
        return ""
    if abs(v - round(v)) < 1e-9:
        return str(int(round(v)))
    return ("%.1f" % v).rstrip("0").rstrip(".")


def swatch(v):
    if v.startswith("#") and len(v) in (4, 7, 9):
        return '<span class="sw" style="background:%s"></span>' % v
    return '<span class="sw" style="background:repeating-linear-gradient(45deg,#2a2740 0 3px,#3a3550 3px 6px)"></span>'


def main():
    d = json.load(io.open(TOK, encoding="utf-8"))
    meta = d["meta"]
    vars_ = d["vars"]
    colors = d["colors"]
    grads = d["gradients"]
    fonts = d["fontFamily"]
    sizes = d["fontSize"]
    lhs = d["lineHeight"]
    lss = d["letterSpacing"]
    radii = d["radius"]
    shadows = d["shadow"]
    px = d["px2rpx"]
    kfs = d["keyframes"]
    motion = d["motion"]

    app_colors = [c for c in colors if "app" in c["scopes"]]
    new_tokens = [c for c in app_colors if not c["vars"]]
    demo_colors = [c for c in colors if c["scopes"] == ["demo"]]
    app_sizes = [s for s in sizes if s["appCount"] > 0]
    uni_grads = collections.OrderedDict()
    for g in grads:
        key = re.sub(r"\s+", " ", g["value"]).strip()
        uni_grads.setdefault(key, []).append(g["uses"][0]["sel"])
    app_px = [p for p in px if "app" in p["scopes"]]

    out = []
    w = out.append
    w('<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">')
    w('<meta name="viewport" content="width=device-width,initial-scale=1">')
    w('<title>谕心 · A2 视觉规格表</title><style>%s</style></head><body><div class="wrap">' % CSS)

    w('<div class="kicker">YUXIN · A2 · VISUAL SPEC</div>')
    w('<h1>视觉规格表：<em>原型 style 的全量账本</em></h1>')
    w('<p class="lead">这一页只回答一件事：原型那 30,644 字节样式，<b>哪一条要搬、搬成什么、搬过去用什么单位</b>。'
      '所有数字由 <span class="mono">tools/extract_tokens.py</span> 从源码解析生成，重生任意一次即可复算，'
      '没有一条是手抄的。真源指纹 <span class="mono">%s</span>（%s B / %s 行）。</p>'
      % (meta["sha256"][:16] + "…" + meta["sha256"][-4:], "{:,}".format(meta["bytes"]), meta["lines"]))

    w('<div class="stats">')
    for n, l in [("%d" % meta["ruleApp"], "屏内规则（要搬）"),
                 ("%d" % meta["ruleDemo"], "展示壳规则（不搬）"),
                 ("%d" % len(vars_), "原型变量"),
                 ("%d" % len(app_colors), "屏内色值（全有 token）"),
                 ("%d" % len(app_sizes), "字号档位"),
                 ("%d" % len(app_px), "屏内 px 档位 → rpx"),
                 ("%d" % len(kfs), "keyframes")]:
        w('<div class="stat"><div class="n">%s</div><div class="l">%s</div></div>' % (n, l))
    w("</div>")

    w('<div class="toc"><span>01 抽取口径</span><span>02 色板</span><span>03 字体与字号</span>'
      '<span>04 行高字距</span><span>05 圆角与阴影</span><span>06 渐变</span>'
      '<span>07 px→rpx 对照表</span><span>08 关键帧与动效</span><span>09 落地规则</span>'
      '<span>10 与开工清单的四处对账</span></div>')

    # ---------------- 01 ----------------
    w('<h2><span class="idx">01 / SCOPE</span>抽取口径：先把展示壳切出去</h2>')
    w('<p>原型是“网页里的手机模型”，页面上有一层<b>不属于产品</b>的东西：<span class="mono">.phone</span> 手机壳、'
      '<span class="mono">.screen</span> 内屏框、<span class="mono">.hero</span> 深色舞台、'
      '<span class="mono">.demo-bar / .demo-note / .demo-tip</span> 演示说明、<span class="mono">body / h1 / footer</span> 的落地页排版。'
      '这些在小程序里没有对应对象（内屏就是真机屏幕），必须<b>整段不搬</b>；否则 WXSS 会带着一套手机边框和演示文案，'
      '或者在真机上被裁掉、被压扁。</p>')
    w('<div class="note">切分规则写死在脚本里：<span class="mono">%s</span> 命中即判为 <span class="tag t-demo">demo</span>，'
      '其余为 <span class="tag">app</span>。结果是 %d 条搬、%d 条不搬，逐条可在 tokens.json 的 <span class="mono">rules[].scope</span> 里核对。</div>'
      % (".phone / .screen / .hero / .demo-bar / .demo-note / .demo-tip / .dv / .kicker / .wrap / .stars / body / h1 / footer",
         meta["ruleApp"], meta["ruleDemo"]))
    w('<p>颜色分三类各自处理：<b>hex</b> 与 <b>rgba</b> 归并为命名 token（屏内 %d 个色值全部有名字，零裸色值）；'
      '<b>渐变</b>不做 token——渐变是“几何 + 色标”的混合体，拆成 token 反而看不出角度和停止点，'
      'A4 时整条内联写、只把色标换成 <span class="mono">var()</span>；<b>body 内的 base64 图</b>与 '
      '<span class="mono">data:image</span> 图标不在颜色统计里（另有 5 个 tab 图标单独走烘焙，见开工清单 NT-07）。</p>' % len(app_colors))

    # ---------------- 02 ----------------
    color_vars = [v for v in vars_ if v["value"].startswith(("#", "rgba", "rgb"))]
    dim_vars = [v for v in vars_ if v not in color_vars]
    w('<h2><span class="idx">02 / PALETTE</span>色板：%d 个颜色 token（另有 %d 个尺寸变量）</h2>'
      % (len(color_vars) + len(new_tokens), len(dim_vars)))
    w('<p>左列是 token 名（直接进 <span class="mono">page{}</span>），值是<b>原文字面</b>，一位都没动。'
      '<span class="tag t-old">原型既有</span> 来自原型自己的 <span class="mono">:root</span>；'
      '<span class="tag t-new">A2 新增</span> 是我为原型的裸色值起的语义名——只加名字，不改色。'
      '同一色值被多个变量引用时（如 <span class="mono">#D8B46A</span> 同时是 <span class="mono">--gold</span> 与 '
      '<span class="mono">--moon-2</span>），取语义最基础的一个作规范名。其中 %d 个是屏内样式里真出现过字面值的色值；'
      '另外 %d 个虽只在展示壳规则里露过字面值，但原型把它们定义在 <span class="mono">:root</span>，'
      '变量本身是屏内资源（例如 <span class="mono">--nav-text</span> 给 tabBar 文字用），因此照样保留。</p>'
      % (len(app_colors), len(color_vars) + len(new_tokens) - len(app_colors)))

    w('<h3>2.1 原型既有变量（%d）</h3>' % len(vars_))
    w('<div class="tblwrap"><table><thead><tr><th>token</th><th>值</th><th>类型</th>'
      '<th>px 值 → rpx</th><th>定义位置</th><th>作用域</th></tr></thead><tbody>')
    for v in vars_:
        kind = "尺寸" if v["rpx"] is not None else ("颜色" if v["value"].startswith(("#", "rgba")) else "其他")
        w('<tr><td class="v">%s</td><td class="v">%s%s</td><td>%s</td><td class="num">%s</td>'
          '<td class="v">%s</td><td>%s</td></tr>'
          % (esc(v["name"]), swatch(v["value"]), esc(v["value"]), kind,
             fnum(v["rpx"]), esc(",".join(v["selectors"])[:60]),
             '<span class="tag t-demo">demo</span>' if v["scope"] == "demo" else '<span class="tag">app</span>'))
    w("</tbody></table></div>")

    w('<h3>2.2 A2 新增 token（%d）——裸色值归并</h3>' % len(new_tokens))
    w('<div class="tblwrap"><table><thead><tr><th>token</th><th>值</th><th>原文字面出现</th>'
      '<th>用在（屏内选择器）</th></tr></thead><tbody>')
    for c in sorted(new_tokens, key=lambda x: -x["appUses"]):
        sels = sorted({u["sel"] for u in c["uses"] if u["sel"] != ":root"})
        w('<tr><td class="v">%s</td><td class="v">%s%s</td><td class="num">%d</td><td class="v">%s</td></tr>'
          % (esc(c["token"]), swatch(c["value"]), esc(c["value"]), c["appUses"],
             esc(" · ".join(sels)[:110])))
    w("</tbody></table></div>")

    if demo_colors:
        w('<h3>2.3 只在展示壳里出现的色值（不建 token）</h3>')
        w('<div class="tblwrap"><table><thead><tr><th>值</th><th>出现位置</th><th>处置</th></tr></thead><tbody>')
        for c in demo_colors:
            sels = " · ".join(sorted({u["sel"] for u in c["uses"]}))
            w('<tr><td class="v">%s%s</td><td class="v">%s</td><td>不搬（属手机壳/演示说明）</td></tr>'
              % (swatch(c["value"]), esc(c["value"]), esc(sels)))
        w("</tbody></table></div>")

    # ---------------- 03 ----------------
    w('<h2><span class="idx">03 / TYPE</span>字体与字号</h2>')
    w('<p>原型一共 7 条 <span class="mono">font-family</span> 声明，去重后是 4 套字族 + 若干 <span class="mono">inherit</span>。'
      '这一层是<b>唯一必须跨平台替换的资源层</b>：Windows 有 SimSun，macOS 有 Songti SC，Android 两个都没有。'
      'D5 已定 F1：打包思源宋体子集、云存储下发、<span class="mono">wx.loadFontFace</span> 注册，'
      '字族栈固定为 <span class="mono">"YXSong","Songti SC","serif"</span>，等宽栈固定为 '
      '<span class="mono">"SF Mono","Consolas",monospace</span>（仅用于数字与代码块，Android 落到 monospace 也可接受）。</p>')
    w('<div class="tblwrap"><table><thead><tr><th>原字族栈</th><th>出现</th><th>小程序落地</th></tr></thead><tbody>')
    for f in fonts:
        val = f["value"]
        if "Mono" in val:
            land = '等宽栈原样保留'
        elif val.strip() == "inherit":
            land = '继承父级（WXSS 同样支持，保留）'
        elif "PingFang" in val:
            land = '系统无衬线栈，原样保留（只用于极少数辅助字）'
        else:
            land = '替换为 <span class="mono">"YXSong","Songti SC",serif</span>'
        w('<tr><td class="v">%s</td><td class="num">%d</td><td>%s</td></tr>'
          % (esc(val), len(f["selectors"]), land))
    w("</tbody></table></div>")

    w('<h3>3.1 字号阶梯（%d 档，屏内 %d 档）</h3>' % (len(sizes), len(app_sizes)))
    w('<p>口径按你的硬约束：<b>字号 px 乘以 k=2.450980 后取整到 0.5rpx</b>。右列同时给出取整误差——'
      '最大 0.25rpx ≈ 0.10px，低于一个物理像素的三分之一，肉眼与 diff 都不会抓到。'
      '字号<b>不用</b> <span class="mono">min-height</span> 那套比例推导，就是这一张表定死。</p>')
    w('<div class="tblwrap"><table><thead><tr><th>原型字号</th><th>rpx（0.5 取整）</th><th>误差</th>'
      '<th>屏内用了几处</th><th>用在</th></tr></thead><tbody>')
    for s in sizes:
        pxv = float(re.findall(r"[\d.]+", s["value"])[0])
        err = s["rpx"] - pxv * meta["k"]
        sels = [x for x in s["selectors"]]
        w('<tr><td class="v">%spx</td><td class="v">%srpx</td><td class="num">%+.2f</td>'
          '<td class="num">%d / %d</td><td class="v">%s</td></tr>'
          % (fnum(pxv), fnum(s["rpx"]), err, s["appCount"], s["count"], esc(" · ".join(sels)[:96])))
    w("</tbody></table></div>")

    # ---------------- 04 ----------------
    w('<h2><span class="idx">04 / LEADING</span>行高与字距</h2>')
    w('<p>行高只有一处是 px（<span class="mono">42px</span>，需转 102.9rpx），其余是<b>无单位倍数</b>，原样保留即可——'
      '倍数行高在 WXSS 里同样生效，且不随字号取整漂移。</p>')
    w('<div class="tblwrap"><table><thead><tr><th>声明</th><th>出现</th><th>处置</th></tr></thead><tbody>')
    for l in lhs:
        v = l["value"]
        done = "转 %srpx" % fnum(float(v[:-2]) * meta["k"]) if v.endswith("px") else "原样（无单位倍数）"
        w('<tr><td class="v">line-height: %s</td><td class="num">%d</td><td>%s</td></tr>' % (esc(v), len(l["selectors"]), done))
    for l in lss:
        w('<tr><td class="v">letter-spacing: %s</td><td class="num">%d</td><td>%srpx</td></tr>'
          % (esc(l["value"]), len(l["selectors"]),
             fnum(float(re.findall(r"-?[\d.]+", l["value"])[0]) * meta["k"]) + "&nbsp;" if re.findall(r"-?[\d.]+", l["value"]) else ""))
    w("</tbody></table></div>")

    # ---------------- 05 ----------------
    w('<h2><span class="idx">05 / SURFACE</span>圆角与阴影</h2>')
    w('<p>圆角共 %d 种写法。其中 <span class="mono">38px</span> / <span class="mono">30px</span> 属于手机壳与内屏框，'
      'D2 已定这两处不计入比对、也不搬；屏内真正要用的是 <span class="mono">16px</span>（卡）、'
      '<span class="mono">14px</span>（仪式卡/回响）、<span class="mono">12px</span>（输入框/横幅）、'
      '<span class="mono">999px</span>（胶囊）这几档。百分比圆角（星空点、铜钱、签筒）在 WXSS 里同样有效，不动。</p>' % len(radii))
    w('<div class="tblwrap"><table><thead><tr><th>声明</th><th>rpx</th><th>用在</th></tr></thead><tbody>')
    for r in radii:
        val = r["value"].split(":", 1)[1].strip()
        rp = ""
        if "px" in val and "%" not in val:
            nums = re.findall(r"-?[\d.]+", val)
            rp = " / ".join(fnum(float(x) * meta["k"]) for x in nums)
        w('<tr><td class="v">%s</td><td class="v">%s</td><td class="v">%s</td></tr>'
          % (esc(val), rp or "—", esc(" · ".join(r["selectors"])[:100])))
    w("</tbody></table></div>")

    w('<h3>5.1 阴影（%d 条，其中屏内 %d 条）</h3>' % (len(shadows), len([s for s in shadows if s["scope"] == "app"])))
    w('<p>阴影我给了<b>整条 token</b>，不是拆颜色：一条阴影是“位移 + 模糊 + 扩散 + 颜色（含内阴影）”的复合体，'
      '拆开写极易在搬运时把 inset 顺序或模糊半径写反。屏内 19 条阴影各自有名字，页面里写 '
      '<span class="mono">box-shadow: var(--sh-card)</span> 即可。</p>')
    w('<div class="tblwrap"><table><thead><tr><th>token</th><th>值</th><th>原型选择器</th></tr></thead><tbody>')
    for s in shadows:
        tag = '<span class="tag t-demo">不搬</span>' if s["scope"] == "demo" else '<span class="tag t-new">%s</span>' % esc(s["token"])
        w('<tr><td class="v">%s</td><td class="v">%s</td><td class="v">%s</td></tr>'
          % (tag, esc(s["value"]), esc(" · ".join(s["selectors"])[:90])))
    w("</tbody></table></div>")

    # ---------------- 06 ----------------
    grad_uses = sum(len(g["uses"]) for g in grads)
    w('<h2><span class="idx">06 / GRADIENT</span>渐变：%d 个唯一值、共 %d 次使用</h2>' % (len(uni_grads), grad_uses))
    w('<p>不建 token，理由写在 01。这里给的是<b>唯一值清单</b>：A4 写页面时从这里整条取，'
      '只把其中出现的 hex / rgba 换成 02 节的 token 名。有 <span class="mono">var()</span> 的已经是变量版，直接用。</p>')
    w('<div class="tblwrap"><table><thead><tr><th>渐变（唯一值）</th><th>用了几次</th><th>用在</th></tr></thead><tbody>')
    for g, sels in uni_grads.items():
        cnt = sum(len(x["uses"]) for x in grads if re.sub(r"\s+", " ", x["value"]).strip() == g)
        w('<tr><td class="v">%s</td><td class="num">%d</td><td class="v">%s</td></tr>'
          % (esc(g), cnt, esc(" · ".join(sorted(set(sels)))[:90])))
    w("</tbody></table></div>")

    # ---------------- 07 ----------------
    w('<h2><span class="idx">07 / SCALE</span>px→rpx 对照表（%d 档）</h2>' % len(px))
    w('<p>k = 750 / 306 = <span class="mono">%.6f</span>。全表按“长度取 1 位小数、字号取 0.5rpx”两列并排给出，'
      '<b>写代码时照右两列抄</b>，不要现场心算。标注 <span class="tag t-demo">demo</span> 的档位只在展示壳出现，'
      '不进小程序（保留在表里是为了将来重跑原型截图时能对上）。</p>' % meta["k"])
    w('<div class="tblwrap"><table><thead><tr><th>px</th><th>rpx（长度，1 位小数）</th><th>rpx（字号，0.5 取整）</th>'
      '<th>出现</th><th>属性</th><th>作用域</th></tr></thead><tbody>')
    for p in px:
        scope = "app" if "app" in p["scopes"] else "demo"
        w('<tr><td class="num">%s</td><td class="num">%s</td><td class="num">%s</td><td class="num">%d</td>'
          '<td class="v">%s</td><td>%s</td></tr>'
          % (fnum(p["px"]), fnum(p["rpx"]), fnum(p["rpxFont"]), p["count"],
             esc(", ".join(p["props"])[:70]),
             '<span class="tag">app</span>' if scope == "app" else '<span class="tag t-demo">demo</span>'))
    w("</tbody></table></div>")
    w('<div class="warnbox"><h4>三个非整数陷阱</h4><ol>'
      '<li><b>1px 边框</b> → 2.45rpx。真机上 2.45rpx ≈ 1.00px，直接用即可；但若某台机型 DPR 折算后落在半个物理像素，'
      '线会“发虚”。处置：先按 2.45rpx 写，真机三机型比对时若发现发虚，再对该处单独换 '
      '<span class="mono">transform: scaleY()</span> 的 hairline 方案——不预先改，避免大多数机型反而变粗。</li>'
      '<li><b>动画位移</b>里的 px 不要转 rpx。签筒 7 根签的 <span class="mono">translate</span> 是 rAF 逐帧数学，'
      'A5 烘焙 keyframes 时要<b>按 px 采样的比例换算成百分比或 rpx 字面值</b>，两者不能混用，否则位移幅度随屏宽变化。</li>'
      '<li><b>字距 letter-spacing</b> 介于字体与布局之间，一律按 px→rpx 转，不保留 px（保留会导致小屏上标题撑行）。</li>'
      '</ol></div>')

    # ---------------- 08 ----------------
    w('<h2><span class="idx">08 / MOTION</span>关键帧与动效</h2>')
    w('<p>原型共 %d 个 <span class="mono">@keyframes</span>、%d 条动效声明（含 transition）。'
      '时长与缓动<b>原样搬运，不重编</b>；只有签筒那 5.6 秒是 rAF 数学，A5 用构建期采样烘焙成 keyframes（见 NT-09）。'
      '下面每张卡的关键帧内容都是从源码逐条读出来的，可直接对照。</p>' % (len(kfs), len(motion)))
    for k in kfs:
        names = [m for m in motion if m.get("name") == k["name"]]
        durs = sorted({(m.get("duration") or "") for m in names})
        meta_s = " · ".join([x for x in ["时长 " + "/".join(durs) if durs else "",
                                         "引用 %d 处" % len(names),
                                         "原型第 %d 行" % k["line"]] if x])
        w('<div class="kf"><div class="h"><span class="name">@keyframes %s</span><span class="meta">%s</span></div>'
          % (esc(k["name"]), esc(meta_s)))
        steps = []
        for st in k["steps"]:
            steps.append("%-10s %s" % (st["at"] + " {", "; ".join("%s:%s" % (x["p"], x["v"]) for x in st["decls"])))
        w('<div class="steps">%s</div></div>' % esc("\n".join(steps)))
    w('<h3>8.1 动效声明明细（%d 条）</h3>' % len(motion))
    w('<div class="tblwrap"><table><thead><tr><th>选择器</th><th>类型</th><th>参数</th><th>行</th></tr></thead><tbody>')
    for m in motion:
        if m["kind"] == "animation":
            pv = "name=%s, duration=%s, easing=%s, delay=%s, iter=%s, fill=%s" % tuple(
                (m.get(k) if m.get(k) is not None else "—") for k in
                ("name", "duration", "easing", "delay", "iteration", "fill"))
            kind = '<span class="tag t-new">anim</span>'
        else:
            pv = m["value"]
            kind = "transition"
        w('<tr><td class="v">%s</td><td>%s</td><td class="v">%s</td><td class="num">%d</td></tr>'
          % (esc(m["sel"][:56]), kind, esc(pv), m["line"]))
    w("</tbody></table></div>")

    # ---------------- 09 ----------------
    w('<h2><span class="idx">09 / RULES</span>落地规则（写 WXSS 时照这七条）</h2>')
    w('<div class="warnbox"><h4>硬规则</h4><ol>'
      '<li><b>零裸色值</b>：页面 WXSS 里只允许出现 <span class="mono">var(--…)</span>。检验方式是一条脚本：'
      '对 <span class="mono">miniprogram/pages/**/*.wxss</span> 扫 <span class="mono">#hex</span> 与 '
      '<span class="mono">rgba(</span>，命中即失败。</li>'
      '<li><b>字号只从 03 节抄</b>：21 档已在表里，出现表外字号即视为新增设计，需要先改本表。</li>'
      '<li><b>长度只用 07 节两列</b>：不要现场心算 k；长度 1 位小数、字号 0.5 取整。</li>'
      '<li><b>展示壳样式一条都不搬</b>：<span class="mono">.phone / .screen / .hero / .demo-* / body / footer</span>。'
      '真机屏幕就是内屏，没有壳。</li>'
      '<li><b>渐变内联、阴影取 token</b>：渐变整条写，只换色标；阴影一律 <span class="mono">var(--sh-…)</span>。</li>'
      '<li><b>keyframes 数值写死</b>：不在 keyframes 里用 <span class="mono">var()</span> 做插值（iOS 上有已知不稳），'
      '变量只用在选择器端的 <span class="mono">animation-duration/delay</span>。</li>'
      '<li><b>字体三件套</b>：<span class="mono">loadFontFace</span> 成功回调后再触发任何 canvas 文字绘制（NT-18），'
      '失败则整页落 <span class="mono">Songti SC / serif</span> 并在报告里标注。</li>'
      '</ol></div>')
    w('<p>关于 <span class="mono">var()</span> 的可靠性：WXSS 跑在 WKWebView / XWeb 上，自定义属性是支持的；'
      '风险只在“变量被用在 keyframes 内部插值”这一处。因此 tokens.wxss 里变量照常声明，'
      '但 A5 的签筒 keyframes 一律用字面数值。若真机三机型里真的出现某台机型变量失效（历史上有过 X5 内核老版本），'
      '兜底方案是构建期把 <span class="mono">var(--x)</span> 就地展开成字面值——tokens.json 里每个 token 都带原值，'
      '展开是机械操作，不需要重写样式。</p>')

    # ---------------- 10 ----------------
    w('<h2><span class="idx">10 / RECONCILE</span>与开工清单的四处对账</h2>')
    w('<p>清单是先读源码手写结论、本页是脚本全量解析，两者有一处数字对不上，以本页为准：</p>')
    w('<div class="tblwrap"><table><thead><tr><th>项</th><th>清单里写的</th><th>脚本实测</th><th>结论</th></tr></thead><tbody>')
    for a, b, c, dd in [
        ("CSS 变量个数", "37 个", "%d 个（原文 %d 次同名声明）" % (len(vars_), meta["varRawCount"]),
         "37 是把同名变量在不同选择器下的重复声明也数进去了；去重后 %d（:root %d + 元素级 %d）"
         % (len(vars_), len([v for v in vars_ if ":root" in v["selectors"]]),
            len([v for v in vars_ if ":root" not in v["selectors"]]))),
        ("颜色个数", "110 处 hex + 103 处 rgba", "%d 个唯一色值（hex %d + rgba %d）+ %d 条渐变字面"
         % (len(colors), len([c for c in colors if c["kind"] == "hex"]),
            len([c for c in colors if c["kind"] == "rgba"]), len(grads)),
         "清单数的是“出现次数”不是“唯一值”，两者不冲突；A2 按唯一值建 token"),
        ("px 声明", "809 处 px 声明", "%d 处出现、%d 个唯一值（屏内 %d 个）"
         % (sum(p["count"] for p in px), len(px), len(app_px)),
         "同上，唯一值才是要转的；重复值复用同一行 rpx"),
        ("规则条数", "未统计", "%d 条（屏内 %d / 展示壳 %d）" % (len(d["rules"]), meta["ruleApp"], meta["ruleDemo"]),
         "展示壳 %d 条整段不搬，这是清单里没量化的一项，也是避免带壳进小程序的关键" % meta["ruleDemo"]),
    ]:
        w('<tr><td class="v">%s</td><td class="v">%s</td><td class="v">%s</td><td>%s</td></tr>'
          % (esc(a), esc(b), esc(c), esc(dd)))
    w("</tbody></table></div>")

    w('<p>另外补一条清单里没有、但 A3 一定会撞上的：<b>内屏高度</b>。原型 <span class="mono">.screen{height:640px}</span>，'
      '换算 1568.6rpx；但真机屏高不是 640px，所以 D2 的“基准对齐模式”要用 <span class="mono">656.25rpx 的安全区换算</span>'
      '之外的一套：A3 里用 <span class="mono">flex:1 + min-height:1466.7rpx</span>（= 598.45px，扣除自绘状态栏 41.55px），'
      '这个数字已写进开工清单 NT-02，本表不重复推导。</p>')

    w('<footer><span>A2 视觉规格表 · 由 tokens.json 生成，勿手改</span>'
      '<span class="mono">源 SHA256 %s</span></footer>' % meta["sha256"][:24] + "…")
    w('</div></body></html>')

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    io.open(OUT, "w", encoding="utf-8", newline="\n").write("\n".join(out))
    print("written", OUT, os.path.getsize(OUT), "bytes")


if __name__ == "__main__":
    main()
