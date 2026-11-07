const app = getApp();
Page({
  data: { statusBarHeight: 20, step: 1, name: '', m: '', d: '', zod: '待补充', mbti: {} },
  onLoad() { this.setData({ statusBarHeight: app.globalData.statusBarHeight || 20 }); },
  onName(e) { this.setData({ name: e.detail.value }); },
  onM(e) { this.setData({ m: e.detail.value }); this.calcZod(); },
  onD(e) { this.setData({ d: e.detail.value }); this.calcZod(); },
  calcZod() {
    const m = parseInt(this.data.m), d = parseInt(this.data.d);
    if (!m || !d) return;
    const zod = ['摩羯','水瓶','双鱼','白羊','金牛','双子','巨蟹','狮子','处女','天秤','天蝎','射手'];
    const ends = [19,18,20,19,20,21,22,22,22,23,22,21];
    let idx = (m - 1 + (d > ends[m-1] ? 1 : 0)) % 12;
    this.setData({ zod: zod[idx] + '座' });
  },
  pickMbti(e) {
    const k = e.currentTarget.dataset.k;
    const dim = k < 'E' ? 'ei' : (k < 'S' ? 'ei' : (k < 'T' ? 'sn' : (k < 'J' ? 'tf' : 'jp')));
    // simpler: group by pair
    const groups = { E:'ei',I:'ei', S:'sn',N:'sn', T:'tf',F:'tf', J:'jp',P:'jp' };
    const g = groups[k];
    this.setData({ ['mbti.'+g]: k });
  },
  next() { if (this.data.step >= 3) { wx.navigateBack(); } else { this.setData({ step: this.data.step + 1 }); } },
  prev() { if (this.data.step > 1) this.setData({ step: this.data.step - 1 }); },
  goBack() { wx.navigateBack(); },
  toast(e) { wx.showToast({ title: e.currentTarget.dataset.t || '演示中', icon: 'none' }); }
});
