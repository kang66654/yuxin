# -*- coding: utf-8 -*-
"""A3 离线静态审计：没有模拟器也能先拦住结构性问题。

检查项：
1. app.json 里每个页面的 4 个文件是否齐全
2. WXML 标签是否配对（自定义组件标签按单标签处理）
3. usingComponents 能否解析到文件
4. WXSS 里是否还有裸色值 / 裸 px（tokens.wxss 的声明本身除外）
5. var(--x) 是否都在 tokens.wxss 里声明过
结果写 docs/.audit.txt，同时打印摘要。
"""
import io
import json
import os
import re

ROOT = r"E:\miniprogram\yuxin\miniprogram"
OUT = r"E:\miniprogram\yuxin\docs\.audit.txt"
VOID = {"image", "input", "icon", "progress", "switch", "slider", "textarea", "canvas", "camera", "video", "map"}

problems, notes = [], []
app = json.load(io.open(os.path.join(ROOT, "app.json"), encoding="utf-8"))
pages = app.get("pages", [])

for p in pages:
    base = os.path.join(ROOT, p)
    for ext in (".js", ".json", ".wxml", ".wxss"):
        if not os.path.exists(base + ext):
            problems.append("缺文件 %s%s" % (p, ext))

# tokens 声明
tokens = io.open(os.path.join(ROOT, "styles", "tokens.wxss"), encoding="utf-8").read()
declared = set(re.findall(r"(--[a-z0-9\-]+)\s*:", tokens))

wxss_files = []
for dirpath, _, files in os.walk(ROOT):
    for f in files:
        if not f.endswith(".wxss"):
            continue
        full = os.path.join(dirpath, f)
        rel = os.path.relpath(full, ROOT).replace("\\", "/")
        # 只审计参与编译的：app.wxss、styles/*、custom-tab-bar/*、app.json 里的页面
        live = rel in ("app.wxss").replace("\\", "/") or rel.startswith("styles/") or rel.startswith("custom-tab-bar/")
        live = live or any(rel == p + ".wxss" for p in pages)
        if live:
            wxss_files.append(full)

bad_color, bad_px = [], []
for f in wxss_files:
    rel = os.path.relpath(f, ROOT)
    s = io.open(f, encoding="utf-8").read()
    if rel.endswith("tokens.wxss"):
        continue
    body = re.sub(r"/\*.*?\*/", "", s, flags=re.S)
    for m in re.finditer(r"#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)", body):
        bad_color.append("%s: %s" % (rel, m.group(0)))
    for m in re.finditer(r"-?\d*\.?\d+px", body):
        bad_px.append("%s: %s" % (rel, m.group(0)))

# var 引用闭合
used = set()
for f in wxss_files:
    used |= set(re.findall(r"var\((--[a-z0-9\-]+)\)", io.open(f, encoding="utf-8").read()))
missing = sorted(used - declared)

# WXML 结构 + 组件解析
def check_wxml(rel_path):
    s = io.open(os.path.join(ROOT, rel_path), encoding="utf-8").read()
    s = re.sub(r"<!--.*?-->", "", s, flags=re.S)
    stack = []
    for m in re.finditer(r"<(/?)([a-zA-Z][\w-]*)([^>]*?)(/?)>", s):
        close, name, rest, self_close = m.group(1) == "/", m.group(2), m.group(3), m.group(4) == "/"
        if name in VOID or self_close:
            continue
        if not close:
            stack.append(name)
        else:
            if stack and stack[-1] == name:
                stack.pop()
            else:
                problems.append("%s: 标签错配 </%s>（栈顶 %s）" % (rel_path, name, stack[-1] if stack else "空"))
                if name in stack:
                    while stack and stack[-1] != name:
                        stack.pop()
                    if stack:
                        stack.pop()
    if stack:
        problems.append("%s: 未闭合 %s" % (rel_path, stack))
    # 组件
    cfg = json.load(io.open(os.path.join(ROOT, rel_path.replace(".wxml", ".json")), encoding="utf-8")) \
        if os.path.exists(os.path.join(ROOT, rel_path.replace(".wxml", ".json"))) else {}
    comps = cfg.get("usingComponents", {})
    for tag in set(re.findall(r"<([a-z][a-z0-9]*-[a-z0-9-]+)[\s>/]", s)):
        if tag not in comps:
            problems.append("%s: 用了未声明的组件 <%s>" % (rel_path, tag))
    for name, path in comps.items():
        target = os.path.join(ROOT, path.lstrip("/")) if path.startswith("/") else os.path.join(os.path.dirname(os.path.join(ROOT, rel_path)), path)
        if not os.path.exists(target + ".wxml"):
            problems.append("%s: usingComponents.%s 指向不存在的 %s" % (rel_path, name, path))

for p in pages:
    check_wxml(p + ".wxml")

# custom tabBar
ctb = os.path.join(ROOT, "custom-tab-bar")
if app.get("tabBar", {}).get("custom"):
    for ext in (".js", ".json", ".wxml", ".wxss"):
        if not os.path.exists(ctb + r"\index" + ext):
            problems.append("custom-tab-bar 缺 index%s" % ext)

summary = [
    "pages=%d  wxss=%d  tokens=%d  var_used=%d" % (len(pages), len(wxss_files), len(declared), len(used)),
    "bare_color=%d  bare_px=%d  missing_var=%d" % (len(bad_color), len(bad_px), len(missing)),
    "problems=%d" % len(problems),
]
summary += ["  ! " + p for p in problems]
summary += ["  ~ bare_px " + p for p in bad_px[:30]]
summary += ["  ~ bare_color " + p for p in bad_color[:20]]
summary += ["  ~ missing_var " + m for m in missing[:20]]
io.open(OUT, "w", encoding="utf-8", newline="\n").write("\n".join(summary) + "\n")
print("\n".join(summary[:3]))
