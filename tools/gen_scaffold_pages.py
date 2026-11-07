# -*- coding: utf-8 -*-
"""A3 骨架：为 4 个 tab 页生成可编译的最小外壳（真实复刻在 A4 逐页替换）。
只写 json/js/wxml/wxss 四个文件，不触碰已有非空内容。
"""
import io
import os

ROOT = r"E:\miniprogram\yuxin\miniprogram"
PAGES = [
    ("ask", "问事签", "问事", 1),
    ("tree", "情绪树洞", "树洞", 2),
    ("ritual", "仪式库", "仪式", 3),
    ("me", "我的", "我的", 4),
]

WXML = """<!-- {alias}：A3 骨架页，A4 按原型 L{line} 逐页替换 -->
<view class="app-bg"></view>
<view class="stars">
  <view class="star star-1"></view>
  <view class="star star-2"></view>
  <view class="star star-3"></view>
  <view class="star star-4"></view>
  <view class="star star-5"></view>
</view>

<view class="nav" style="padding-top:{{statusBarHeight}}px"></view>

<view class="pbody">
  <view class="page-view">
    <view class="page-hd">
      <text class="pt">{title}</text>
      <text class="ps">骨架已就位 · A4 复刻本页</text>
    </view>
    <view class="scaffold-note">本页结构、文案、动效将在 A4 按原型第 {line} 行起逐条对齐，当前仅为可编译骨架。</view>
  </view>
  <view class="tab-space"></view>
</view>
"""

JS = """const app = getApp();

Page({
  data: { statusBarHeight: 20, navRight: 8 },

  onLoad() {
    const g = app.globalData;
    const win = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    const navRight = g.capsule && g.capsule.left ? Math.max(0, win.windowWidth - g.capsule.left + 8) : 16;
    this.setData({ statusBarHeight: g.statusBarHeight || 20, navRight });
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().sync({index});
    }
  },
});
"""

WXSS = """/* {alias} 骨架样式；真实样式随 A4 从 base.wxss / 原型逐条落位 */
.scaffold-note {{
  font-size: 27rpx;
  color: var(--ink-faint);
  line-height: 1.7;
  margin-top: 24.5rpx;
}}
"""

LINES = {"ask": 412, "tree": 513, "ritual": 549, "me": 738}

for name, title, alias, idx in PAGES:
    d = os.path.join(ROOT, "pages", name)
    os.makedirs(d, exist_ok=True)
    io.open(os.path.join(d, name + ".json"), "w", encoding="utf-8", newline="\n").write(
        '{\n  "navigationStyle": "custom",\n  "usingComponents": {}\n}\n')
    io.open(os.path.join(d, name + ".wxml"), "w", encoding="utf-8", newline="\n").write(
        WXML.format(alias=alias, title=title, line=LINES[name]))
    io.open(os.path.join(d, name + ".wxss"), "w", encoding="utf-8", newline="\n").write(
        WXSS.format(alias=alias))
    io.open(os.path.join(d, name + ".js"), "w", encoding="utf-8", newline="\n").write(
        JS.replace("{index}", str(idx)))
print("pages", len(PAGES))
