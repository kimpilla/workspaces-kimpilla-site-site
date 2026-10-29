// EQとコンプの立体: EQ=平面(周波数)、コンプ=奥行き(入力の大きさ)。高さ=かかるゲイン(dB)
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const FS = 48000, FMIN = 20, FMAX = 20000, LMIN = -60, LMAX = 0, NX = 56, NZ = 26, GR_RANGE = 18;
  // ---------- 状態 ----------
  const GF = [31.25, 62.5, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];       // 1オクターブごと
  const S = { eq: GF.map((f) => ({ type: 'peaking', f, g: 0, q: 1.4 })), eqOn: true, comp: { thr: -24, ratio: 4, knee: 6, att: 10, rel: 150, mk: 0 }, compOn: true, order: 'eqc', src: 'real', lvl: -14, sf: 400, mode: 'surf', wsrc: 'out', wstep: 60, wstyle: 'thick', contour: false, bg: -60, mb: false, xo: [200, 2000], cb: 0, bands: [{ thr: -26, ratio: 3, knee: 6, att: 30, rel: 250, mk: 0 }, { thr: -24, ratio: 3, knee: 6, att: 15, rel: 150, mk: 0 }, { thr: -26, ratio: 3, knee: 6, att: 5, rel: 100, mk: 0 }] };
  // ---------- 計算(音と表示で同じ式) ----------
  function bq(type, f0, gdb, Q) {                               // RBJ
    const A = Math.pow(10, gdb / 40), w0 = 2 * Math.PI * f0 / FS, c = Math.cos(w0), s = Math.sin(w0), al = s / (2 * Q);
    let b0, b1, b2, a0, a1, a2;
    if (type === 'peaking') { b0 = 1 + al * A; b1 = -2 * c; b2 = 1 - al * A; a0 = 1 + al / A; a1 = -2 * c; a2 = 1 - al / A; }
    else { const sq = 2 * Math.sqrt(A) * al; if (type === 'lowshelf') { b0 = A * ((A + 1) - (A - 1) * c + sq); b1 = 2 * A * ((A - 1) - (A + 1) * c); b2 = A * ((A + 1) - (A - 1) * c - sq); a0 = (A + 1) + (A - 1) * c + sq; a1 = -2 * ((A - 1) + (A + 1) * c); a2 = (A + 1) + (A - 1) * c - sq; } else { b0 = A * ((A + 1) + (A - 1) * c + sq); b1 = -2 * A * ((A - 1) + (A + 1) * c); b2 = A * ((A + 1) + (A - 1) * c - sq); a0 = (A + 1) - (A - 1) * c + sq; a1 = 2 * ((A - 1) - (A + 1) * c); a2 = (A + 1) - (A - 1) * c - sq; } }
    return [b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0];
  }
  const magDb = (co, f) => { const w = 2 * Math.PI * f / FS, c1 = Math.cos(w), s1 = Math.sin(w), c2 = Math.cos(2 * w), s2 = Math.sin(2 * w); const nr = co[0] + co[1] * c1 + co[2] * c2, ni = -(co[1] * s1 + co[2] * s2), dr = 1 + co[3] * c1 + co[4] * c2, di = -(co[3] * s1 + co[4] * s2); return 10 * Math.log10((nr * nr + ni * ni) / (dr * dr + di * di)); };
  let eqCoef = [];
  const rebuildEq = () => { eqCoef = S.eq.map((b) => bq(b.type, b.f, b.g, b.q)); };
  const eqDb = (f) => { if (!S.eqOn) return 0; let s = 0; for (const c of eqCoef) s += magDb(c, f); return s; };
  const curC = () => (S.mb ? S.bands[S.cb] : S.comp);           // いま画面で編集しているコンプ
  function compOutC(C, x) {                                     // 入力x(dB) → 出力(dB)。ソフトニー
    const { thr: T, ratio: R, knee: K } = C; const d = x - T;
    if (2 * d < -K) return x; if (2 * Math.abs(d) <= K) return x + (1 / R - 1) * Math.pow(d + K / 2, 2) / (2 * K); return T + d / R;
  }
  const compOut = (x) => compOutC(curC(), x);
  // マルチバンド: LR4(リンクウィッツ・ライリー4次)で3つに分ける。振幅は 低=LP1, 中=HP1*LP2, 高=HP1*HP2(足すと1)
  const lr = (f, fc) => { const r4 = Math.pow(f / fc, 4); return [1 / (1 + r4), r4 / (1 + r4)]; };    // [LP, HP]
  const bandAmp = (f) => { const [l1, h1] = lr(f, S.xo[0]), [l2, h2] = lr(f, S.xo[1]); return [l1, h1 * l2, h1 * h2]; };
  // 「いっしょに鳴っている低音」(BG_F Hz, bg dB)がいるとき、その上に乗った1つのサイン波(f, x dB)が受けるゲインを出す
  let swOff = 0; const LV = () => S.lvl + swOff;                // 「音量をゆらす」で、入力の大きさを 0〜-30dB の間でゆっくり上下させる
  const BG_F = 80, pw = (d) => Math.pow(10, d / 10), bgOn = () => bgLevel() > LMIN + 0.5;
  const bgLevel = () => (S.src === 'duck' ? LV() : S.bg);
  function mbGain(f, x, bgx) {                                  // マルチバンド: 帯域ごとに、その帯域にいる音の大きさだけを見る
    const A = bandAmp(f), M = bgx === null ? [0, 0, 0] : bandAmp(BG_F); let sum = 0;
    for (let b = 0; b < 3; b++) { if (A[b] < 1e-5) continue; const xb = 10 * Math.log10(A[b] * A[b] * pw(x) + M[b] * M[b] * (bgx === null ? 0 : pw(bgx)) + 1e-12), C = S.bands[b]; sum += A[b] * Math.pow(10, (compOutC(C, xb) - xb + C.mk) / 20); }
    return 20 * Math.log10(Math.max(sum, 1e-6));
  }
  function cg(f, x, bgx) {
    if (!S.compOn) return 0; if (S.mb) return mbGain(f, x, bgx);
    const xs = bgx === null ? x : 10 * Math.log10(pw(x) + pw(bgx)); return compOutC(S.comp, xs) - xs + S.comp.mk;   // シングル: 全帯域の合計の大きさを見る
  }
  const gain = (f, L, eq) => { const e = eq === undefined ? eqDb(f) : eq, bgx = bgOn() ? bgLevel() + (S.order === 'eqc' ? eqDb(BG_F) : 0) : null; return S.order === 'eqc' ? e + cg(f, L + e, bgx) : e + cg(f, L, bgx); };
  const fAt = (u) => FMIN * Math.pow(FMAX / FMIN, u), lAt = (v) => LMIN + (LMAX - LMIN) * v;   // u,v: 0..1
  const uOf = (f) => Math.log(f / FMIN) / Math.log(FMAX / FMIN);

  // ---------- 3D 描画 ----------
  const cv = $('c3'), g = cv.getContext('2d');
  const V = { yaw: -0.55, pitch: 0.5, dist: 3.1, zoom: 1, target: null };
  const VIEWS_SURF = [['ななめ', -0.55, 0.5, null, 3.1, 1], ['正面', 0, 0.02, null, 3.1, 1.5], ['真横', Math.PI / 2, 0.02, null, 3.1, 1.3], ['真上', 0, 1.5, null, 3.1, 1]];
  const VIEWS_WAVE = [['斜め上', 0, 0.62, 'thick', 4.0, 1], ['真横', -Math.PI / 2, 0.02, 'thick', 14, 1.25], ['正面(波形の線)', 0, 0.02, 'wave', 14, 1.7]];
  const vb = $('views');
  function buildViews() {
    vb.querySelectorAll('.vbtn').forEach((b) => b.remove());
    (S.mode === 'wave' ? VIEWS_WAVE : VIEWS_SURF).forEach(([n, y, p, st, dd, zm]) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'vbtn'; b.textContent = n; b.onclick = () => { V.target = { yaw: y, pitch: p, dist: dd || 3.1, zoom: zm || 1 }; if (st) { S.wstyle = st; changed(); } }; vb.appendChild(b); });
  }
  let drag = null;
  cv.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, yaw: V.yaw, pitch: V.pitch }; cv.setPointerCapture(e.pointerId); V.target = null; V.zoom = 1; if (V.dist > 5) V.dist = S.mode === 'wave' ? 3.7 : 3.1; });
  cv.addEventListener('pointermove', (e) => { if (!drag) return; V.yaw = drag.yaw + (e.clientX - drag.x) * 0.008; V.pitch = Math.max(0, Math.min(1.5, drag.pitch + (e.clientY - drag.y) * 0.008)); });
  cv.addEventListener('pointerup', () => { drag = null; });
  const isDark = () => { const m = getComputedStyle(document.body).backgroundColor.match(/\d+/g) || [255, 255, 255]; return (+m[0] + +m[1] + +m[2]) / 3 < 128; };
  const cssv = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim() || '#888';
  let W = 0, H = 0, dpr = 1;
  function fit() { dpr = window.devicePixelRatio || 1; W = cv.clientWidth; H = cv.clientHeight; cv.width = W * dpr; cv.height = H * dpr; }
  window.addEventListener('resize', fit); fit();
  function proj(x, y, z) {                                      // world → screen
    const cy = Math.cos(V.yaw), sy = Math.sin(V.yaw), cp = Math.cos(V.pitch), sp = Math.sin(V.pitch);
    let X = x * cy + z * sy, Z = -x * sy + z * cy, Y = y;
    const Y2 = Y * cp + Z * sp, Z2 = Z * cp - Y * sp;
    const d = V.dist + Z2, f = 2.1 / d, sc = Math.min(W * 0.9, H * 1.1) * 0.42 * (V.dist / 3.1) * V.zoom * (S.mode === 'wave' ? 1 - 0.42 * Math.pow(Math.sin(V.pitch), 2) : 1);
    return [W / 2 + X * f * sc, H * 0.52 - Y2 * f * sc, d];
  }
  const colAt = (gdb, dark) => {
    const t = Math.max(-1, Math.min(1, gdb / 12)), a = Math.abs(t), mid = dark ? [70, 70, 74] : [225, 225, 228], hi = t < 0 ? [42, 109, 244] : [224, 40, 60];
    return 'rgb(' + mid.map((m, i) => Math.round(m + (hi[i] - m) * a)).join(',') + ')';
  };
  const wx = (u) => (u - 0.5) * 2, wz = (v) => (v - 0.5) * 2, wy = (gdb) => Math.max(-GR_RANGE, Math.min(GR_RANGE, gdb)) / GR_RANGE * 0.8;
  let grid = null, dirty = true;
  const live = { L: LMIN, gr: 0, grs: [0, 0, 0] };
  function build() {
    const eqs = []; for (let i = 0; i <= NX; i++) eqs.push(eqDb(fAt(i / NX)));
    grid = []; for (let i = 0; i <= NX; i++) { const row = []; for (let j = 0; j <= NZ; j++) row.push(gain(fAt(i / NX), lAt(j / NZ), eqs[i])); grid.push(row); }
    dirty = false;
  }
  function draw() {
    if (S.mode === 'wave') { drawWave(); return; }
    if (V.target) { V.yaw += (V.target.yaw - V.yaw) * 0.18; V.pitch += (V.target.pitch - V.pitch) * 0.18; if (V.target.dist) V.dist += (V.target.dist - V.dist) * 0.18; if (V.target.zoom) V.zoom += (V.target.zoom - V.zoom) * 0.18; if (Math.abs(V.target.yaw - V.yaw) < 0.002 && Math.abs(V.target.pitch - V.pitch) < 0.002 && (!V.target.dist || Math.abs(V.target.dist - V.dist) < 0.05) && (!V.target.zoom || Math.abs(V.target.zoom - V.zoom) < 0.01)) V.target = null; }
    if (dirty || !grid) build();
    const dark = isDark(), fg = cssv('--fg'), muted = cssv('--muted'), accent = cssv('--accent');
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    // 面
    const quads = [];
    for (let i = 0; i < NX; i++) for (let j = 0; j < NZ; j++) {
      const p = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]].map(([a, b]) => proj(wx(a / NX), wy(grid[a][b]), wz(b / NZ)));
      quads.push({ p, d: (p[0][2] + p[1][2] + p[2][2] + p[3][2]) / 4, gdb: (grid[i][j] + grid[i + 1][j] + grid[i + 1][j + 1] + grid[i][j + 1]) / 4 });
    }
    // 床(ゲイン0の面)の枠と目盛
    const fl = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, z]) => proj(x, 0, z));
    g.strokeStyle = muted; g.lineWidth = 1; g.beginPath(); fl.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); g.stroke();
    quads.sort((a, b) => b.d - a.d);
    for (const q of quads) { g.beginPath(); q.p.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); g.fillStyle = colAt(q.gdb, dark); g.fill(); g.strokeStyle = dark ? 'rgba(255,255,255,.10)' : 'rgba(0,0,0,.14)'; g.lineWidth = 0.6; g.stroke(); }
    // 軸ラベル(床の縁)
    g.fillStyle = fg; g.font = '11px ui-monospace, monospace'; g.textAlign = 'center';
    [[100, '100'], [1000, '1k'], [10000, '10k']].forEach(([f, s]) => { const p = proj(wx(uOf(f)), 0, -1.08); g.fillText(s, p[0], p[1] + 4); });
    const pf = proj(0, 0, -1.3); g.fillText('周波数 →', pf[0], pf[1] + 8);
    g.textAlign = 'right';
    [-40, -20, 0].forEach((l) => { const p = proj(-1.08, 0, wz((l - LMIN) / (LMAX - LMIN))); g.fillText(l + 'dB', p[0], p[1] + 4); });
    g.textAlign = 'center'; const pl = proj(0, 0, 1.12); g.fillText('奥ほど大きい音', pl[0], pl[1] - 4);
    g.textAlign = 'right';
    [12, 0, -12].forEach((v) => { const p = proj(1.0, wy(v), -1.05); g.fillStyle = muted; g.fillText((v > 0 ? '+' : '') + v + 'dB', p[0] - 4, p[1] + 3); });
    if (S.mb) { g.save(); g.setLineDash([5, 4]); g.strokeStyle = fg; g.globalAlpha = 0.55; g.lineWidth = 1; g.textAlign = 'center'; g.fillStyle = fg; g.font = '10px ui-monospace, monospace';
      S.xo.forEach((fc) => { const a = proj(wx(uOf(fc)), 0, -1), b = proj(wx(uOf(fc)), 0, 1); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); g.fillText('▲' + fmtF(fc), a[0], a[1] + 26); }); g.restore(); }
    // いまの音: 太い線(その大きさでの周波数特性)、またはサインの点
    const L = Math.max(LMIN, Math.min(LMAX, live.L)), v = (L - LMIN) / (LMAX - LMIN);
    if (S.src === 'sweep') {                                      // スイープが通る道すじ(その大きさでの周波数特性)を、薄い線で
      g.strokeStyle = accent; g.globalAlpha = 0.45; g.lineWidth = 2; g.beginPath(); const zz = wz((LV() - LMIN) / (LMAX - LMIN));
      for (let i = 0; i <= NX; i++) { const p = proj(wx(i / NX), wy(gain(fAt(i / NX), LV())) + 0.004, zz); i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]); } g.stroke(); g.globalAlpha = 1;
    }
    if (S.src === 'sine' || S.src === 'sweep') {
      const f = S.src === 'sweep' ? sweepF() : S.sf, gz = gain(f, LV()), p0 = proj(wx(uOf(f)), 0, wz((LV() - LMIN) / (LMAX - LMIN))), p1 = proj(wx(uOf(f)), wy(gz), wz((LV() - LMIN) / (LMAX - LMIN)));
      g.strokeStyle = accent; g.lineWidth = 2; g.beginPath(); g.moveTo(p0[0], p0[1]); g.lineTo(p1[0], p1[1]); g.stroke(); g.fillStyle = accent; g.beginPath(); g.arc(p1[0], p1[1], 6, 0, 7); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.stroke();
    } else if (S.playing) {
      g.strokeStyle = accent; g.lineWidth = 3; g.beginPath();
      for (let i = 0; i <= NX; i++) { const f = fAt(i / NX), p = proj(wx(i / NX), wy(gain(f, L)) + 0.004, wz(v)); i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]); } g.stroke();
      if (S.src === 'multi') MULTI.forEach((f) => { const p = proj(wx(uOf(f)), wy(gain(f, L)) + 0.004, wz(v)); g.fillStyle = accent; g.beginPath(); g.arc(p[0], p[1], 4.5, 0, 7); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 1.2; g.stroke(); });
    }
    g.textAlign = 'left'; g.fillStyle = muted; g.fillText('ドラッグで回す', 6, H - 6);
  }
  // ---------- 波形の奥行き(平面=波形、奥=時間) ----------
  const WN = 48, WM = 112, ZW = 3.6, hist = [];                           // hist[0]=最新
  function drawWave() {
    if (V.target) { V.yaw += (V.target.yaw - V.yaw) * 0.18; V.pitch += (V.target.pitch - V.pitch) * 0.18; if (V.target.dist) V.dist += (V.target.dist - V.dist) * 0.18; if (V.target.zoom) V.zoom += (V.target.zoom - V.zoom) * 0.18; if (Math.abs(V.target.yaw - V.yaw) < 0.002 && Math.abs(V.target.pitch - V.pitch) < 0.002 && (!V.target.dist || Math.abs(V.target.dist - V.dist) < 0.05) && (!V.target.zoom || Math.abs(V.target.zoom - V.zoom) < 0.01)) V.target = null; }
    const fg = cssv('--fg'), muted = cssv('--muted'), accent = cssv('--accent'), bg = cssv('--bg');
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    const GY = V.pitch < 0.3 ? 2.6 : 1;                           // 真横・正面(低い視点)では、縦をぐっと大きく見せる
    const Y = (a) => Math.max(-1, Math.min(1, a * 4 * GY)) * 0.8, Zw = (k) => -ZW / 2 + ZW * k / (WN - 1);
    const fl = [[-1, -ZW / 2], [1, -ZW / 2], [1, ZW / 2], [-1, ZW / 2]].map(([x, z]) => proj(x, 0, z)); g.strokeStyle = muted; g.lineWidth = 1; g.beginPath(); fl.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); if (!(S.wstyle === 'wave' && Math.abs(Math.sin(V.yaw)) < 0.25 && V.pitch < 0.3)) g.stroke();
    if (S.wstyle === 'thick') {                                   // 厚み: 各瞬間の波の大きさ(包絡)を、上下に膨らんだ立体にする
      const n = Math.min(hist.length, WN), C = 56, cols = [], tmp = [];
      for (let k = 0; k < n; k++) { const s = hist[k].w, row = new Float32Array(C); for (let c = 0; c < C; c++) { let m = 0; const a = Math.floor(c * WM / C), b = Math.min(WM, a + Math.ceil(WM / C) + 4); for (let i = a; i < b; i++) { const v = Math.abs(s[i]); if (v > m) m = v; } row[c] = m; } cols.push(row); }
      let mxA = 0.08; cols.forEach((row) => row.forEach((v) => { if (v > mxA) mxA = v; }));
      const E = (a) => Math.min(1, a * 5 * GY) * 1.0, quads = [];
      for (let k = 0; k < n - 1; k++) for (let c = 0; c < C - 1; c++) for (const sgn of [1, -1]) {
        const pts = [[k, c], [k, c + 1], [k + 1, c + 1], [k + 1, c]].map(([kk, cc]) => proj(-1 + 2 * cc / (C - 1), sgn * E(cols[kk][cc]), Zw(kk)));
        const lv = (cols[k][c] + cols[k][c + 1] + cols[k + 1][c] + cols[k + 1][c + 1]) / 4;
        quads.push({ pts, d: (pts[0][2] + pts[1][2] + pts[2][2] + pts[3][2]) / 4 - (sgn < 0 ? 0.001 : 0), lv, sgn, age: k / (WN - 1) });
      }
      if (S.contour) {                                            // 等高線(赤い山=上側だけ): マーチングスクエア
        const ev = (k, c) => Math.min(1, cols[k][c] * 5), LV = [0.06, 0.12, 0.2, 0.3, 0.42, 0.56, 0.72, 0.9];
        for (let k = 0; k < n - 1; k++) for (let c = 0; c < C - 1; c++) {
          const v = [ev(k, c), ev(k, c + 1), ev(k + 1, c + 1), ev(k + 1, c)];
          for (const L of LV) {
            const pts = []; const ed = [[0, 1], [1, 2], [3, 2], [0, 3]];                // 上辺・右辺・下辺・左辺
            ed.forEach(([a, b]) => { if ((v[a] < L) !== (v[b] < L)) { const t = (L - v[a]) / (v[b] - v[a]); const kk = [k, k, k + 1, k + 1], cc = [c, c + 1, c + 1, c]; pts.push(proj(-1 + 2 * (cc[a] + (cc[b] - cc[a]) * t) / (C - 1), L + 0.004, Zw(kk[a] + (kk[b] - kk[a]) * t))); } });
            for (let m = 0; m + 1 < pts.length; m += 2) quads.push({ seg: [pts[m], pts[m + 1]], d: (pts[m][2] + pts[m + 1][2]) / 2 - 0.004, lv: L });
          }
        }
      }
      const ramp = (t, dark) => {                                  // 高さ→色(グラデーション)
        const st = dark ? [[238, 238, 240], [170, 170, 176], [95, 95, 102], [30, 30, 36]] : [[255, 244, 225], [255, 205, 130], [255, 130, 60], [224, 40, 60], [110, 0, 22]];
        const x = Math.max(0, Math.min(1, t)) * (st.length - 1), i = Math.min(st.length - 2, Math.floor(x)), f = x - i;
        return 'rgb(' + st[i].map((v, k) => Math.round(v + (st[i + 1][k] - v) * f)).join(',') + ')';
      };
      quads.sort((a, b2) => b2.d - a.d);
      for (const q of quads) {
        if (q.seg) { g.beginPath(); g.moveTo(q.seg[0][0], q.seg[0][1]); g.lineTo(q.seg[1][0], q.seg[1][1]); g.globalAlpha = 0.85; g.strokeStyle = '#fff'; g.lineWidth = 1; g.stroke(); g.globalAlpha = 1; continue; } g.beginPath(); q.pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); g.globalAlpha = 1; g.fillStyle = ramp(Math.sqrt(q.lv / mxA), q.sgn < 0); g.fill(); g.globalAlpha = 0.08; g.strokeStyle = bg; g.lineWidth = 0.5; g.stroke(); }
      g.globalAlpha = 1;
      if (n > 1) { for (const sgn of [1, -1]) { g.beginPath(); hist.slice(0, WN).forEach((e, k) => { const p = proj(-1, E(sgn * e.pk / 4 * 4), Zw(k)); k ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]); }); g.strokeStyle = fg; g.lineWidth = 2; g.stroke(); } }
      g.fillStyle = fg; g.font = '11px ui-monospace, monospace'; g.textAlign = 'center';
      g.textAlign = 'left'; g.fillStyle = fg; g.fillText('手前=いま / 奥=過去 / 厚み=音の大きさ(サスティーン)', 6, 14); g.textAlign = 'center';
      g.textAlign = 'left'; g.fillStyle = muted; g.fillText((S.wsrc === 'out' ? '出力(EQ・コンプのあと)' : '入力(EQ・コンプのまえ)') + ' / ドラッグで回す', 6, H - 6);
      if (!S.playing && !hist.length) { g.textAlign = 'center'; g.fillText('「▶ なる」を おすと、音の厚みが奥に流れる', W / 2, H / 2); }
      return;
    }
    const front = Math.abs(Math.sin(V.yaw)) < 0.25 && V.pitch < 0.3;   // 正面から見るときは、いまの波形だけ(過ぎた波形は出さない)
    for (let k = (front ? Math.min(hist.length, 1) : Math.min(hist.length, WN)) - 1; k >= 0; k--) {   // 奥(古い)から手前へ
      const s = hist[k].w, z = Zw(k), age = k / (WN - 1);
      g.beginPath(); for (let i = 0; i < WM; i++) { const p = proj(-1 + 2 * i / (WM - 1), Y(s[i]), z); i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]); }
      const pe = proj(1, 0, z), ps = proj(-1, 0, z); g.lineTo(pe[0], pe[1]); g.lineTo(ps[0], ps[1]); g.closePath();
      g.globalAlpha = 0.88; g.fillStyle = bg; g.fill(); g.globalAlpha = 1;
      g.strokeStyle = accent; g.globalAlpha = Math.max(0.15, 1 - age * 0.85); g.lineWidth = k === 0 ? 2 : 1.1; g.stroke(); g.globalAlpha = 1;
    }
    if (false && hist.length > 1) {                             // (波形の線の表示では、左の壁の線は出さない)
      for (const sgn of [1, -1]) { g.beginPath(); hist.slice(0, WN).forEach((e, k) => { const p = proj(-1, Y(sgn * e.pk), Zw(k)); k ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]); }); g.strokeStyle = fg; g.lineWidth = 2; g.stroke(); }
    }
    g.fillStyle = fg; g.font = '11px ui-monospace, monospace'; g.textAlign = 'center';
    g.textAlign = 'left'; g.fillText(front ? 'いまの波形' : '手前=いま(太線) / 奥=過去 / 波形を線で重ねる', 6, 14); g.textAlign = 'center';
    g.textAlign = 'left'; g.fillStyle = muted; g.fillText((S.wsrc === 'out' ? '出力(EQ・コンプのあと)' : '入力(EQ・コンプのまえ)') + ' / ドラッグで回す', 6, H - 6);
    if (!S.playing && !hist.length) { g.textAlign = 'center'; g.fillStyle = muted; g.fillText('「▶ なる」を おすと、波形が奥に流れる', W / 2, H / 2); }
  }
  // ---------- 小さい2つのグラフ ----------
  function fit2(c) { const d = window.devicePixelRatio || 1; c.width = c.clientWidth * d; c.height = c.clientHeight * d; const x = c.getContext('2d'); x.setTransform(d, 0, 0, d, 0, 0); return [x, c.clientWidth, c.clientHeight]; }
  // ----- グラフィックEQ(縦のフェーダー10本。ドラッグでなぞって動かせる) -----
  const geq = $('geq'), GMAX = 12;
  const gBand = (px) => { const w = geq.clientWidth, bw = w / GF.length; return Math.max(0, Math.min(GF.length - 1, Math.floor(px / bw))); };
  const gY = (gdb, h) => h / 2 - gdb / GMAX * (h / 2 - 22);
  function drawGEQ() {
    const muted = cssv('--muted'), accent = cssv('--accent'), fg = cssv('--fg'), line = cssv('--line');
    const [x, w, h] = fit2(geq), bw = w / GF.length; x.font = '10px ui-monospace, monospace'; x.textAlign = 'right';
    [-12, -6, 0, 6, 12].forEach((d) => { const y = gY(d, h); x.strokeStyle = d === 0 ? muted : line; x.lineWidth = d === 0 ? 1 : 0.6; x.beginPath(); x.moveTo(0, y); x.lineTo(w, y); x.stroke(); x.fillStyle = muted; x.fillText((d > 0 ? '+' : '') + d, w - 2, y - 2); });
    // 周波数特性の曲線(フェーダーの位置と同じ横軸=1オクターブごと)
    x.strokeStyle = accent; x.lineWidth = 2; x.beginPath(); for (let i = 0; i <= 160; i++) { const px = i / 160 * w, f = GF[0] * Math.pow(2, (px / bw) - 0.5), y = gY(Math.max(-15, Math.min(15, eqDb(f))), h); i ? x.lineTo(px, y) : x.moveTo(px, y); } x.stroke();
    if (S.mb) { x.save(); x.setLineDash([4, 3]); x.strokeStyle = fg; x.globalAlpha = 0.5; S.xo.forEach((fc) => { const px = (Math.log2(fc / GF[0]) + 0.5) * bw; x.beginPath(); x.moveTo(px, 0); x.lineTo(px, h); x.stroke(); }); x.restore(); }
    S.eq.forEach((b, i) => {
      const cx = (i + 0.5) * bw, y0 = gY(0, h), y1 = gY(S.eqOn ? b.g : 0, h);
      x.strokeStyle = line; x.lineWidth = 1; x.beginPath(); x.moveTo(cx, 18); x.lineTo(cx, h - 18); x.stroke();
      x.fillStyle = b.g >= 0 ? 'rgba(224,40,60,.25)' : 'rgba(42,109,244,.25)'; x.fillRect(cx - bw * 0.28, Math.min(y0, y1), bw * 0.56, Math.abs(y1 - y0));
      x.fillStyle = fg; x.strokeStyle = fg; x.beginPath(); x.arc(cx, y1, 7, 0, 7); x.fillStyle = b.g === 0 ? cssv('--bg') : accent; x.fill(); x.lineWidth = 2; x.strokeStyle = b.g === 0 ? fg : accent; x.stroke();
      x.fillStyle = muted; x.textAlign = 'center'; x.fillText(b.f >= 1000 ? b.f / 1000 + 'k' : Math.round(b.f), cx, h - 4);
      if (b.g !== 0) { x.fillStyle = fg; x.fillText((b.g > 0 ? '+' : '') + b.g, cx, y1 + (b.g > 0 ? -11 : 17)); }
    });
    x.textAlign = 'left';
  }
  let geqDrag = false;
  const geqSet = (e) => { const r = geq.getBoundingClientRect(), i = gBand(e.clientX - r.left), h = r.height; let gdb = (h / 2 - (e.clientY - r.top)) / (h / 2 - 22) * GMAX; gdb = Math.round(Math.max(-GMAX, Math.min(GMAX, gdb)) * 2) / 2; if (Math.abs(gdb) < 0.6) gdb = 0; S.eq[i].g = gdb; S.eqOn = true; changed(); };
  geq.addEventListener('pointerdown', (e) => { geqDrag = true; geq.setPointerCapture(e.pointerId); geqSet(e); });
  geq.addEventListener('pointermove', (e) => { if (geqDrag) geqSet(e); });
  geq.addEventListener('pointerup', () => { geqDrag = false; });
  // ----- コンプ: 入出力カーブ。丸をドラッグして、スレッショルド・レシオ・ニー・メイクアップを動かす -----
  const cc = $('cComp'), OMIN = -60, OMAX = 12, PAD = { l: 34, r: 12, t: 12, b: 24 };
  const cX = (l, w) => PAD.l + (l - LMIN) / (LMAX - LMIN) * (w - PAD.l - PAD.r), cY = (o, h) => h - PAD.b - (o - OMIN) / (OMAX - OMIN) * (h - PAD.t - PAD.b);
  const cLv = (px, w) => LMIN + (px - PAD.l) / (w - PAD.l - PAD.r) * (LMAX - LMIN), cOut = (py, h) => OMIN + (h - PAD.b - py) / (h - PAD.t - PAD.b) * (OMAX - OMIN);
  const outAt = (l) => (S.compOn ? compOut(l) + curC().mk : l);
  function handles(w, h) {
    const { thr: T, knee: K, mk } = curC(), kx = Math.min(0, T + Math.max(K, 4) / 2);
    return [{ id: 'thr', n: 'スレッショルド', x: cX(T, w), y: cY(outAt(T), h) }, { id: 'knee', n: 'ニー', x: cX(kx, w), y: cY(outAt(kx), h) }, { id: 'ratio', n: 'レシオ', x: cX(0, w), y: cY(outAt(0), h) }, { id: 'mk', n: 'メイクアップ', x: cX(LMIN, w), y: cY(LMIN + mk, h) }];
  }
  function drawComp() {
    const muted = cssv('--muted'), accent = cssv('--accent'), fg = cssv('--fg'), line = cssv('--line'), bg = cssv('--bg');
    const [x, w, h] = fit2(cc); x.font = '10px ui-monospace, monospace';
    [-60, -40, -20, 0].forEach((l) => { const px = cX(l, w); x.strokeStyle = line; x.lineWidth = 0.6; x.beginPath(); x.moveTo(px, PAD.t); x.lineTo(px, h - PAD.b); x.stroke(); x.fillStyle = muted; x.textAlign = 'center'; x.fillText(l, px, h - 8); });
    [-60, -40, -20, 0].forEach((o) => { const py = cY(o, h); x.strokeStyle = line; x.beginPath(); x.moveTo(PAD.l, py); x.lineTo(w - PAD.r, py); x.stroke(); x.fillStyle = muted; x.textAlign = 'right'; x.fillText(o, PAD.l - 3, py + 3); });
    x.fillStyle = muted; x.textAlign = 'left'; x.fillText('入力 →', w - 52, h - 8); x.save(); x.translate(10, PAD.t + 36); x.rotate(-Math.PI / 2); x.fillText('出力', 0, 0); x.restore();
    x.strokeStyle = muted; x.setLineDash([4, 4]); x.beginPath(); x.moveTo(cX(LMIN, w), cY(LMIN, h)); x.lineTo(cX(LMAX, w), cY(LMAX, h)); x.stroke(); x.setLineDash([]);
    x.beginPath(); for (let i = 0; i <= 160; i++) { const l = LMIN + (LMAX - LMIN) * i / 160, px = cX(l, w), py = Math.max(PAD.t, Math.min(h - PAD.b, cY(outAt(l), h))); i ? x.lineTo(px, py) : x.moveTo(px, py); }
    x.strokeStyle = accent; x.lineWidth = 2.5; x.stroke();
    // 圧縮されている分(対角線との差)を薄く塗る
    x.beginPath(); for (let i = 0; i <= 160; i++) { const l = LMIN + (LMAX - LMIN) * i / 160, px = cX(l, w), py = Math.max(PAD.t, Math.min(h - PAD.b, cY(outAt(l), h))); i ? x.lineTo(px, py) : x.moveTo(px, py); } for (let i = 160; i >= 0; i--) { const l = LMIN + (LMAX - LMIN) * i / 160; x.lineTo(cX(l, w), cY(l, h)); } x.closePath(); x.fillStyle = 'rgba(224,40,60,.12)'; x.fill();
    if (S.playing && !S.mb) { const l = Math.max(LMIN, Math.min(LMAX, live.L)); x.fillStyle = fg; x.beginPath(); x.arc(cX(l, w), Math.max(PAD.t, Math.min(h - PAD.b, cY(outAt(l), h))), 4, 0, 7); x.fill(); }
    if (S.compOn) handles(w, h).forEach((p) => { x.fillStyle = bg; x.strokeStyle = accent; x.lineWidth = 2.5; x.beginPath(); x.arc(p.x, p.y, 9, 0, 7); x.fill(); x.stroke(); x.fillStyle = fg; x.textAlign = p.id === 'mk' ? 'left' : p.id === 'ratio' ? 'right' : 'center'; x.fillText(p.n, p.id === 'mk' ? p.x + 12 : p.id === 'ratio' ? p.x - 12 : p.x, p.id === 'mk' ? p.y - 8 : p.id === 'ratio' ? p.y - 8 : p.id === 'knee' ? p.y - 14 : p.y + 24); });
    else { x.fillStyle = muted; x.textAlign = 'center'; x.fillText('コンプはオフ(プリセットで「やさしく」などを選ぶとオン)', w / 2, PAD.t + 14); }
    x.textAlign = 'left';
  }
  let cDrag = null;
  function compMove(e) {
    const r = cc.getBoundingClientRect(), w = r.width, h = r.height, px = e.clientX - r.left, py = e.clientY - r.top, C = curC();
    if (cDrag === 'thr') C.thr = Math.round(Math.max(-60, Math.min(-1, cLv(px, w))) * 2) / 2;
    else if (cDrag === 'knee') C.knee = Math.round(Math.max(0, Math.min(30, 2 * (cLv(px, w) - C.thr))) * 2) / 2;
    else if (cDrag === 'ratio') { const o0 = Math.min(0, cOut(py, h) - C.mk); const d = o0 - C.thr; C.ratio = d <= 0.05 ? 20 : Math.round(Math.max(1, Math.min(20, -C.thr / d)) * 10) / 10; }
    else if (cDrag === 'mk') C.mk = Math.round(Math.max(0, Math.min(24, cOut(py, h) - LMIN)) * 2) / 2;
    changed();
  }
  cc.addEventListener('pointerdown', (e) => {
    if (!S.compOn) return; const r = cc.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top; let best = null, bd = 34;
    handles(r.width, r.height).forEach((p) => { const d = Math.hypot(p.x - px, p.y - py); if (d < bd) { bd = d; best = p.id; } });
    if (best) { cDrag = best; cc.setPointerCapture(e.pointerId); compMove(e); }
  });
  cc.addEventListener('pointermove', (e) => { if (cDrag) compMove(e); });
  cc.addEventListener('pointerup', () => { cDrag = null; });
  function drawSmall() { drawGEQ(); drawComp(); }
  // ---------- UI ----------
  const fmtF = (f) => (f >= 1000 ? (f / 1000).toFixed(f >= 10000 ? 0 : 1) + 'k' : Math.round(f)) + 'Hz';
  const lgSlider = (min, max) => ({ to: (v) => Math.round(Math.log(v / min) / Math.log(max / min) * 1000), from: (s) => min * Math.pow(max / min, s / 1000) });
  const bandCtl = [];
  const CROWS = [['thr', 'スレッショルド', -60, 0, 0.5, ' dB'], ['ratio', 'レシオ', 1, 20, 0.1, ' :1'], ['knee', 'ニー(丸み)', 0, 30, 0.5, ' dB'], ['att', 'アタック', 1, 100, 1, ' ms'], ['rel', 'リリース', 10, 1000, 5, ' ms'], ['mk', 'メイクアップ', 0, 24, 0.5, ' dB']];
  const cBox = $('cRows'), cCtl = [];
  CROWS.forEach(([k, name, mn, mx, st, u]) => {
    const d = document.createElement('div'); d.className = 'rw'; d.innerHTML = '<label>' + name + '</label><input type="range" min="' + mn + '" max="' + mx + '" step="' + st + '"><output></output>'; cBox.appendChild(d);
    const inp = d.querySelector('input'), out = d.querySelector('output');
    cCtl.push(() => { inp.value = curC()[k]; out.textContent = (+curC()[k]).toFixed(st < 1 ? 1 : 0) + u; }); inp.oninput = () => { curC()[k] = +inp.value; changed(); };
  });
  function chips(el, list, getOn, onClick) { list.forEach(([label, val]) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.onclick = () => { onClick(val); changed(); }; b._on = () => getOn(val); el.appendChild(b); }); }
  chips($('modeChips'), [['EQ×コンプ(効きかた)', 'surf'], ['波形の奥行き(時間)', 'wave']], (v) => S.mode === v, (v) => { S.mode = v; if (v === 'wave') S.wstyle = 'thick'; V.target = v === 'wave' ? { yaw: 0, pitch: 0.62, dist: 4.0, zoom: 1 } : { yaw: -0.55, pitch: 0.5, dist: 3.1, zoom: 1 }; buildViews(); });
  chips($('modeChips'), [['入力', 'in'], ['出力', 'out']], (v) => S.wsrc === v, (v) => { S.wsrc = v; hist.length = 0; });
  chips($('modeChips'), [['厚み', 'thick'], ['波形の線', 'wave']], (v) => S.wstyle === v, (v) => { S.wstyle = v; });
  chips($('srcChips'), [['生ドラム(フリー音源)', 'real'], ['ドラム&ベース', 'loop'], ['アンサンブル(合成)', 'ens'], ['はじいた音(のびる・合成)', 'pluck'], ['ファイル', 'file']], (v) => S.src === v, (v) => { S.src = v; if (S.playing) restartSource(); });
  chips($('ordChips'), [['EQ → コンプ', 'eqc'], ['コンプ → EQ', 'ceq']], (v) => S.order === v, (v) => { S.order = v; rewire(); });
  chips($('eqPre'), [['フラット', 0], ['ドンシャリ', 1], ['かまぼこ', 2], ['前に出す', 3], ['こもらせる', 4], ['電話', 5]], () => false, (i) => {
    const P = [[0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [6, 5, 3, 0, -2, -3, -1, 2, 5, 6], [-9, -7, -3, 1, 3, 3, 2, -3, -7, -10], [-3, -2, 0, 0, 1, 3, 5, 5, 3, 1], [2, 2, 1, 0, -1, -3, -5, -7, -9, -11], [-12, -12, -12, -8, 0, 6, 7, 3, -8, -12]][i]; S.eq.forEach((b, k) => { b.g = P[k]; }); S.eqOn = true;
  });
  const CP = [null, { thr: -20, ratio: 2.5, knee: 12, att: 20, rel: 200, mk: 3 }, { thr: -34, ratio: 8, knee: 4, att: 3, rel: 120, mk: 10 }, { thr: -10, ratio: 20, knee: 0, att: 1, rel: 80, mk: 0 }];
  const OFFB = () => ({ thr: -20, ratio: 1, knee: 0, att: 10, rel: 150, mk: 0 });
  chips($('cPre'), [['オフ', 0], ['やさしく', 1], ['ガッツリ', 2], ['リミッター', 3], ['マルチ:低域だけ', 4], ['マルチ:高域だけ', 5]], () => false, (i) => {
    if (i === 0) { S.compOn = false; return; } S.compOn = true;
    if (i < 4) { if (S.mb) S.bands = [0, 1, 2].map(() => ({ ...CP[i] })); else S.comp = { ...CP[i] }; return; }
    S.mb = true; S.cb = i === 4 ? 0 : 2; S.bands = i === 4 ? [{ thr: -30, ratio: 5, knee: 6, att: 30, rel: 250, mk: 4 }, OFFB(), OFFB()] : [OFFB(), OFFB(), { thr: -34, ratio: 6, knee: 6, att: 3, rel: 100, mk: 5 }];
  });
  chips($('mbChips'), [['シングルバンド(全帯域まとめて)', false], ['マルチバンド(3つに分ける)', true]], (v) => S.mb === v, (v) => { S.mb = v; });
  ['低域', '中域', '高域'].forEach((nm, b) => { const el = $('bandTabs'), bt = document.createElement('button'); bt.type = 'button'; bt.onclick = () => { S.cb = b; changed(); }; bt._on = () => S.cb === b; bt._txt = () => nm + ' ' + [fmtF(S.xo[0]) + '以下', fmtF(S.xo[0]) + '〜' + fmtF(S.xo[1]), fmtF(S.xo[1]) + '以上'][b]; el.appendChild(bt); });
  const XO = [[0, '低域↔中域の境目', 60, 800], [1, '中域↔高域の境目', 800, 8000]];
  XO.forEach(([k, name, mn, mx]) => { const d = document.createElement('div'); d.className = 'rw'; d.innerHTML = '<label>' + name + '</label><input type="range" min="0" max="1000"><output></output>'; $('xoRows').appendChild(d); const inp = d.querySelector('input'), out = d.querySelector('output'), sl = lgSlider(mn, mx);
    cCtl.push(() => { inp.value = sl.to(S.xo[k]); out.textContent = fmtF(S.xo[k]); }); inp.oninput = () => { S.xo[k] = Math.round(sl.from(+inp.value)); if (k === 0) S.xo[0] = Math.min(S.xo[0], S.xo[1] / 1.5); else S.xo[1] = Math.max(S.xo[1], S.xo[0] * 1.5); changed(); }; });
  const onoff = (id, label, key) => { const el = $(id); const b = document.createElement('button'); b.type = 'button'; b.onclick = () => { S[key] = !S[key]; changed(); }; b._on = () => S[key]; b._txt = () => label + ': ' + (S[key] ? 'あり' : 'なし'); el.appendChild(b); };
  onoff('modeChips', '等高線', 'contour'); onoff('srcChips', '音量をゆらす', 'swell'); onoff('eqPre', 'EQ', 'eqOn'); onoff('cPre', 'コンプ', 'compOn');
  $('wstep').oninput = (e) => { S.wstep = +e.target.value; hist.length = 0; changed(); };
  $('lvl').oninput = (e) => { S.lvl = +e.target.value; changed(); }; $('bg').oninput = (e) => { S.bg = +e.target.value; changed(); };
  buildViews();
  function changed() {
    rebuildEq(); dirty = true; bandCtl.forEach((f) => f()); cCtl.forEach((f) => f());
    $('lvlo').textContent = S.lvl + ' dB'; $('rwBg').hidden = S.src === 'duck'; $('bgo').textContent = S.bg <= LMIN + 0.5 ? 'なし' : S.bg + ' dB'; $('bg').value = S.bg; $('fileRow').hidden = $('fileRange').hidden = S.src !== 'file'; $('lgSurf').hidden = $('lgSurf2').hidden = S.mode === 'wave'; $('rwStep').hidden = S.mode !== 'wave'; $('wso').textContent = (S.wstep * 40 / 1000).toFixed(1) + ' 秒'; $('lgWave').hidden = S.mode !== 'wave'; [...$('modeChips').querySelectorAll('button')].forEach((b) => { if (/^(入力|出力|厚み|波形の線|等高線)/.test(b.textContent)) b.hidden = S.mode !== 'wave'; }); $('views').hidden = false;
    document.querySelectorAll('.chips button').forEach((b) => { if (b._on) b.classList.toggle('on', !!b._on()); if (b._txt) b.textContent = b._txt(); });
    $('bandTabs').hidden = $('xoRows').hidden = !S.mb; pushAudio(); drawSmall();
  }

  // ---------- 音 ----------
  const MULTI = [63, 125, 250, 500, 1000, 2000, 4000, 8000, 16000].map((f, i) => (i === 8 ? 12500 : f));
  const SWF0 = 30, SWF1 = 16000, SWP = 8; let sweepT0 = 0;
  const sweepF = () => { if (!ctx) return SWF0; const ph = ((ctx.currentTime - sweepT0) % SWP + SWP) % SWP / SWP; return SWF0 * Math.pow(SWF1 / SWF0, Math.max(0, Math.min(1, ph))); };
  let mbIn = null, mbOut = null, mbComp = [], mbF = {}, anOut = null, fileBuf = null, ctx = null, comp = null, src = null, srcGain = null, eqNodes = [], eqIn = null, eqOut = null, master = null, anIn = null, loopTimer = null, noiseBuf = null, workletOk = false;
  function compBlock(st, p, i, o, len, sr) {                    // コンプ本体(AudioWorkletでも代わりの方式でも、同じ式を使う)
    const aa = Math.exp(-1 / (p.att / 1000 * sr)), ar = Math.exp(-1 / (p.rel / 1000 * sr));
    for (let k = 0; k < len; k++) {
      let pk = 0; for (let c = 0; c < i.length; c++) { const a = Math.abs(i[c][k]); if (a > pk) pk = a; }
      let gr = 0; if (p.on) { const x = 20 * Math.log10(Math.max(pk, 1e-6)), d = x - p.thr, K = p.knee; let y; if (2 * d < -K) y = x; else if (2 * Math.abs(d) <= K) y = x + (1 / p.ratio - 1) * Math.pow(d + K / 2, 2) / (2 * K); else y = p.thr + d / p.ratio; gr = y - x; }
      const a = gr < st.g ? aa : ar; st.g = a * st.g + (1 - a) * gr; const m = Math.pow(10, (p.on ? st.g + p.mk : 0) / 20);
      for (let c = 0; c < o.length; c++) o[c][k] = i[Math.min(c, i.length - 1)][k] * m;
    }
  }
  const WORKLET = 'const compBlock=' + compBlock.toString() + ';class C extends AudioWorkletProcessor{constructor(){super();this.p={thr:-24,ratio:4,knee:6,att:10,rel:150,mk:0,on:true};this.st={g:0};this.n=0;this.port.onmessage=e=>Object.assign(this.p,e.data)}process(ins,outs){const i=ins[0],o=outs[0];if(!i||!i.length)return true;compBlock(this.st,this.p,i,o,i[0].length,sampleRate);this.n+=i[0].length;if(this.n>=2400){this.n=0;this.port.postMessage(this.st.g)}return true}}registerProcessor("comp",C);';
  let compMode = 'none';                                        // 'worklet' | 'script'(ScriptProcessor) | 'none'
  function makeSP() {                                           // AudioWorkletが使えない環境(ファイルとして開いた時や一部のスマホ)の代わり
    const n = ctx.createScriptProcessor(1024, 2, 2), st = { g: 0 }, p = { thr: -24, ratio: 4, knee: 6, att: 10, rel: 150, mk: 0, on: true }; let cnt = 0;
    n.port = { postMessage(d) { Object.assign(p, d); }, onmessage: null };
    n.onaudioprocess = (e) => { const ib = e.inputBuffer, ob = e.outputBuffer, ins = [], outs = []; for (let c = 0; c < ib.numberOfChannels; c++) ins.push(ib.getChannelData(c)); for (let c = 0; c < ob.numberOfChannels; c++) outs.push(ob.getChannelData(c)); compBlock(st, p, ins, outs, ib.length, ctx.sampleRate); cnt += ib.length; if (cnt >= 2400) { cnt = 0; if (n.port.onmessage) n.port.onmessage({ data: st.g }); } };
    return n;
  }
  const makeComp = () => (compMode === 'worklet' ? new AudioWorkletNode(ctx, 'comp', { outputChannelCount: [2] }) : compMode === 'script' ? makeSP() : ctx.createGain());
  async function initAudio() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0.7; master.connect(ctx.destination); anOut = ctx.createAnalyser(); anOut.fftSize = 1024; master.connect(anOut);
    srcGain = ctx.createGain(); anIn = ctx.createAnalyser(); anIn.fftSize = 1024; srcGain.connect(anIn);
    eqIn = ctx.createGain(); eqOut = ctx.createGain(); let prev = eqIn;
    S.eq.forEach((b) => { const f = ctx.createBiquadFilter(); f.type = b.type; prev.connect(f); prev = f; eqNodes.push(f); }); prev.connect(eqOut);
    for (const mk of [() => URL.createObjectURL(new Blob([WORKLET], { type: 'application/javascript' })), () => 'data:application/javascript;base64,' + btoa(WORKLET)]) {
      if (compMode !== 'none') break;
      try { await ctx.audioWorklet.addModule(mk()); compMode = 'worklet'; } catch (e) { console.warn('worklet', e && e.message); }
    }
    if (compMode === 'none' && ctx.createScriptProcessor) compMode = 'script';
    comp = makeComp(); workletOk = compMode !== 'none'; if (workletOk) comp.port.onmessage = (e) => { live.gr = e.data; };
    $('audioNote').textContent = compMode === 'worklet' ? '' : compMode === 'script' ? 'このブラウザでは、コンプを代わりの方式(ScriptProcessor)で動かしている。' : 'このブラウザでは、コンプが音に効かない(表示だけ)。';
    mbIn = ctx.createGain(); mbOut = ctx.createGain();
    const mkf = (type, k) => { const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = type === 'allpass' ? 0.7071 : Math.SQRT1_2; if (k) mbF[k] = f; return f; };
    const chain = (...ns) => { for (let i = 0; i < ns.length - 1; i++) ns[i].connect(ns[i + 1]); return ns; };
    for (let b = 0; b < 3; b++) { const n = makeComp(); if (workletOk) n.port.onmessage = (e) => { live.grs[b] = e.data; }; mbComp.push(n); n.connect(mbOut); }
    chain(mbIn, mkf('lowpass', 'l1a'), mkf('lowpass', 'l1b'), mkf('allpass', 'ap'), mbComp[0]);
    const hi = chain(mbIn, mkf('highpass', 'h1a'), mkf('highpass', 'h1b'), ctx.createGain()), hg = hi[3];
    chain(hg, mkf('lowpass', 'm2a'), mkf('lowpass', 'm2b'), mbComp[1]);
    chain(hg, mkf('highpass', 'h2a'), mkf('highpass', 'h2b'), mbComp[2]);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate); const d = noiseBuf.getChannelData(0); let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, pk = 0;
    for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852; b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898; const v = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362; b6 = w * 0.115926; d[i] = v; if (Math.abs(v) > pk) pk = Math.abs(v); }
    for (let i = 0; i < d.length; i++) d[i] /= pk;               // ピーク1.0に
    rewire(); pushAudio();
  }
  function rewire() {
    if (!ctx) return;
    [srcGain, eqOut, comp, mbOut].forEach((n) => { try { n.disconnect(); } catch (e) { /* 未接続 */ } }); try { srcGain.connect(anIn); } catch (e) { /* ok */ }
    const cin = S.mb ? mbIn : comp, cout = S.mb ? mbOut : comp;
    try { mbOut.disconnect(); } catch (e) { /* ok */ }
    try { srcGain.connect(S.order === 'eqc' ? eqIn : cin); } catch (e) { /* ok */ }
    if (S.order === 'eqc') { eqOut.connect(cin); cout.connect(master); } else { cout.connect(eqIn); eqOut.connect(master); }
  }
  function pushAudio() {
    if (!ctx) return;
    S.eq.forEach((b, i) => { const n = eqNodes[i]; n.frequency.value = b.f; n.gain.value = S.eqOn ? b.g : 0; n.Q.value = b.q; });
    if (workletOk) { const msg = (C) => ({ thr: C.thr, ratio: C.ratio, knee: C.knee, att: C.att, rel: C.rel, mk: C.mk, on: S.compOn }); comp.port.postMessage(msg(S.comp)); mbComp.forEach((n, b) => n.port.postMessage(msg(S.bands[b]))); }
    ['l1a', 'l1b', 'h1a', 'h1b'].forEach((k) => { mbF[k].frequency.value = S.xo[0]; }); ['m2a', 'm2b', 'h2a', 'h2b', 'ap'].forEach((k) => { mbF[k].frequency.value = S.xo[1]; });
    if (S.mb !== pushAudio.mb) { pushAudio.mb = S.mb; rewire(); }
    srcGain.gain.value = Math.pow(10, LV() / 20);
    if (S.src === 'sine' && src && src.frequency) src.frequency.value = S.sf;
  }
  function startSource() {
    stopSource();
    if (S.src === 'noise') { const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; s.connect(srcGain); s.start(); src = s; }
    else if (S.src === 'sweep') { const o = ctx.createOscillator(), t0 = ctx.currentTime + 0.05; o.type = 'sine'; sweepT0 = t0; o.frequency.setValueAtTime(SWF0, t0); for (let c = 0; c < 200; c++) { o.frequency.exponentialRampToValueAtTime(SWF1, t0 + (c + 1) * SWP); o.frequency.setValueAtTime(SWF0, t0 + (c + 1) * SWP); } o.connect(srcGain); o.start(); src = o; }
    else if (S.src === 'multi') { const m = ctx.createGain(); m.gain.value = 1 / MULTI.length * 1.6; const os = MULTI.map((f) => { const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f; o.connect(m); o.start(); return o; }); m.connect(srcGain); src = { stop() { os.forEach((o) => { try { o.stop(); } catch (e) { /* ok */ } }); }, disconnect() { try { m.disconnect(); } catch (e) { /* ok */ } } }; }
    else if (S.src === 'sine') { const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = S.sf; o.connect(srcGain); o.start(); src = o; }
    else if (S.src === 'file') { if (!fileBuf) { src = null; return; } const s = ctx.createBufferSource(); s.buffer = fileBuf; s.loop = true; s.loopStart = FR.a; s.loopEnd = FR.b; const n = ctx.createGain(); n.gain.value = 1 / Math.max(0.05, FR.pk || 1); s.connect(n); n.connect(srcGain); s.start(0, FR.a); src = s; src._n = n; FR.t0 = ctx.currentTime; }
    else if (S.src === 'ens') { src = null; startEnsemble(); }
    else if (S.src === 'duck') { startDuck(); }
    else if (S.src === 'real') { src = null; startReal(); }
    else if (S.src === 'pluck') { src = null; startPluck(); }
    else { src = null; startLoop(); }
  }
  function stopSource() { if (src) { try { src.stop(); } catch (e) { /* ok */ } try { src.disconnect(); } catch (e) { /* ok */ } src = null; } clearInterval(loopTimer); loopTimer = null; }
  $('fileIn').onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return; await initAudio();
    try { const ab = await f.arrayBuffer(); fileBuf = await ctx.decodeAudioData(ab); let pk = 0; for (let c = 0; c < fileBuf.numberOfChannels; c++) { const d = fileBuf.getChannelData(c); for (let i = 0; i < d.length; i += 7) { const a = Math.abs(d[i]); if (a > pk) pk = a; } } fileBuf._pk = pk; FR.a = 0; FR.b = fileBuf.duration; FR.pk = pk; FR.env = null; $('fileName').textContent = f.name + '(' + fileBuf.duration.toFixed(1) + '秒)'; frApply(); if (S.playing && S.src === 'file') startSource(); }
    catch (err) { $('fileName').textContent = '読み込めなかった(対応していない形式かも)'; }
  };
  // ---------- ファイルの一部だけ使う ----------
  const FR = { a: 0, b: 0, pk: 1, t0: 0, env: null, drag: null }, fr = $('fileRange'), frc = $('frC');
  function frEnv() { const n = 400, d0 = fileBuf.getChannelData(0), d1 = fileBuf.numberOfChannels > 1 ? fileBuf.getChannelData(1) : d0, e = new Float32Array(n), per = Math.floor(d0.length / n); for (let i = 0; i < n; i++) { let m = 0; for (let k = i * per; k < (i + 1) * per; k += 5) { const a = Math.max(Math.abs(d0[k]), Math.abs(d1[k])); if (a > m) m = a; } e[i] = m; } return e; }
  function frPeak() { let pk = 0; const i0 = Math.floor(FR.a * fileBuf.sampleRate), i1 = Math.floor(FR.b * fileBuf.sampleRate); for (let c = 0; c < fileBuf.numberOfChannels; c++) { const d = fileBuf.getChannelData(c); for (let i = i0; i < i1; i += 7) { const a = Math.abs(d[i]); if (a > pk) pk = a; } } FR.pk = pk; if (src && src._n) src._n.gain.value = 1 / Math.max(0.05, pk); }
  function frApply() { if (src && src.loopEnd !== undefined) { src.loopStart = FR.a; src.loopEnd = FR.b; } $('frT').textContent = '使う区間 ' + FR.a.toFixed(1) + ' 〜 ' + FR.b.toFixed(1) + ' 秒(' + (FR.b - FR.a).toFixed(1) + '秒をくり返す)'; }
  function drawRange() {
    if (fr.hidden) return; const [x, w, h] = fit2(frc); const fg = cssv('--fg'), accent = cssv('--accent'), line = cssv('--line'), muted = cssv('--muted');
    x.clearRect(0, 0, w, h); x.strokeStyle = line; x.strokeRect(0.5, 0.5, w - 1, h - 1);
    if (!fileBuf) { x.fillStyle = muted; x.font = '12px sans-serif'; x.textAlign = 'center'; x.fillText('ファイルを読み込むと、ここに波形が出る', w / 2, h / 2 + 4); return; }
    if (!FR.env) FR.env = frEnv(); const D = fileBuf.duration, n = FR.env.length, X = (t) => t / D * w;
    x.fillStyle = muted; for (let i = 0; i < n; i++) { const a = Math.min(1, FR.env[i] / Math.max(0.01, FR.env.reduce((m, v) => Math.max(m, v), 0))); x.fillRect(i / n * w, h / 2 - a * h / 2 + 2, Math.max(1, w / n), Math.max(1, a * h - 4)); }
    x.fillStyle = accent; x.globalAlpha = 0.18; x.fillRect(X(FR.a), 0, X(FR.b) - X(FR.a), h); x.globalAlpha = 1;
    x.fillStyle = accent; x.fillRect(X(FR.a) - 1.5, 0, 3, h); x.fillRect(X(FR.b) - 1.5, 0, 3, h);
    x.beginPath(); x.arc(X(FR.a), h / 2, 7, 0, 7); x.arc(X(FR.b), h / 2, 7, 0, 7); x.fill();
    if (S.playing && S.src === 'file' && ctx) { const t = FR.a + ((ctx.currentTime - FR.t0) % Math.max(0.05, FR.b - FR.a)); x.fillStyle = fg; x.fillRect(X(t) - 1, 0, 2, h); }
  }
  frc.addEventListener('pointerdown', (e) => { if (!fileBuf) return; frc.setPointerCapture(e.pointerId); const r = frc.getBoundingClientRect(), t = (e.clientX - r.left) / r.width * fileBuf.duration; FR.drag = Math.abs(t - FR.a) < Math.abs(t - FR.b) ? 'a' : 'b'; frMove(e); });
  function frMove(e) { if (!FR.drag) return; const r = frc.getBoundingClientRect(), D = fileBuf.duration, t = Math.max(0, Math.min(D, (e.clientX - r.left) / r.width * D)), gap = Math.min(0.5, D); if (FR.drag === 'a') FR.a = Math.min(t, FR.b - gap); else FR.b = Math.max(t, FR.a + gap); frApply(); }
  frc.addEventListener('pointermove', frMove);
  const frUp = () => { if (FR.drag) { FR.drag = null; frPeak(); frApply(); } };
  frc.addEventListener('pointerup', frUp); frc.addEventListener('pointercancel', frUp);
  $('frAll').onclick = () => { if (!fileBuf) return; FR.a = 0; FR.b = fileBuf.duration; frPeak(); frApply(); };
  const restartSource = () => { if (ctx && S.playing) startSource(); };
  // ドラム&ベースのループ(レベル変化のある素材)
  // ---------- 生ドラム(VCSL, CC0の1発ずつの録音を、4小節のパターンに並べる) ----------
  let drumBufs = null;
  async function loadDrums() {
    if (drumBufs) return drumBufs; const o = {};
    await Promise.all(Object.keys(window.DRUM_B64 || {}).map(async (k) => { const bin = atob(window.DRUM_B64[k]), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); o[k] = await ctx.decodeAudioData(u.buffer); }));
    drumBufs = o; return o;
  }
  async function startReal() {
    const B = await loadDrums(); if (S.src !== 'real' || !S.playing) return; stopSource();
    const bpm = 92, sd = 60 / bpm / 4; let step = 0, next = ctx.currentTime + 0.1;
    const hit = (k, t, v, rate) => { const b = B[k]; if (!b) return; const s = ctx.createBufferSource(), gg = ctx.createGain(); s.buffer = b; if (rate) s.playbackRate.value = rate; gg.gain.value = v; s.connect(gg); gg.connect(srcGain); s.start(t); };
    const KICK = [[0, 1], [7, 0.7], [10, 0.9]], KICK2 = [[0, 1], [3, 0.6], [6, 0.8], [10, 0.9], [14, 0.6]];
    const pump = () => { while (next < ctx.currentTime + 0.15) {
      const s = step % 16, bar = Math.floor(step / 16) % 4, t = next;
      if (s === 0 && bar === 0) hit('crash', t, 0.7);
      (bar % 2 ? KICK2 : KICK).forEach(([k, v]) => { if (k === s && !(bar === 3 && s >= 12)) hit('kick', t, v); });
      if ((s === 4 || s === 12) && !(bar === 3 && s === 12)) hit('snare', t, 0.9); if (s === 15 && bar % 2 === 0) hit('snare', t, 0.25);
      if (bar === 3 && s >= 12) hit('tom', t, 0.85, [1.15, 0.95, 0.8, 0.65][s - 12]);
      if (s % 2 === 0 && !(bar === 3 && s >= 12)) { if (s === 14 && bar % 2) hit('hato', t, 0.45); else hit('hatc', t, s % 4 === 0 ? 0.55 : 0.32); }
      step++; next += sd; } };
    pump(); loopTimer = setInterval(pump, 25);
  }
  // ---------- はじいた音: 強く出て、ゆっくり減衰していく音。コンプ(+メイクアップ)をかけると、減衰の後半が持ち上がって「のび」(サスティーン)が長くなる ----------
  function startPluck() {
    const NOTES = [45, 52, 50, 47], mtof = (m) => 440 * Math.pow(2, (m - 69) / 12), per = 3.6; let n = 0, next = ctx.currentTime + 0.1;
    const note = (t, m) => { const f = mtof(m); [[1, 1, 2.6], [2, 0.5, 1.8], [3, 0.3, 1.3], [4, 0.15, 1.0], [5, 0.08, 0.8]].forEach(([k, a, d]) => { const o = ctx.createOscillator(), gg = ctx.createGain(); o.type = 'sine'; o.frequency.value = f * k; gg.gain.setValueAtTime(0.0001, t); gg.gain.linearRampToValueAtTime(0.7 * a, t + 0.004); gg.gain.setTargetAtTime(0.0001, t + 0.004, d / 4.6); o.connect(gg); gg.connect(srcGain); o.start(t); o.stop(t + d * 2.2); }); };
    const pump = () => { while (next < ctx.currentTime + 0.15) { note(next, NOTES[n % 4]); n++; next += per; } };
    pump(); loopTimer = setInterval(pump, 25);
  }
  // ---------- 低音ドン+小さい中高音: シングルだと低音のたびに中高音まで引っこむ(ポンピング)、マルチだと引っこまない ----------
  function startDuck() {
    const os = [], m = ctx.createGain(); m.gain.value = 0.05; m.connect(srcGain);
    [[1000, 1], [1500, 0.8], [2500, 0.7], [4000, 0.6]].forEach(([f, a]) => { const o = ctx.createOscillator(), gg = ctx.createGain(); o.type = 'sine'; o.frequency.value = f; gg.gain.value = a; o.connect(gg); gg.connect(m); o.start(); os.push(o); });
    const step = 0.6; let next = ctx.currentTime + 0.1;
    const hit = (t) => { const o = ctx.createOscillator(), gg = ctx.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(55, t + 0.15); gg.gain.setValueAtTime(0.0001, t); gg.gain.linearRampToValueAtTime(0.9, t + 0.005); gg.gain.exponentialRampToValueAtTime(0.01, t + 0.45); o.connect(gg); gg.connect(srcGain); o.start(t); o.stop(t + 0.5); };
    const pump = () => { while (next < ctx.currentTime + 0.15) { hit(next); next += step; } };
    pump(); loopTimer = setInterval(pump, 25);
    src = { stop() { os.forEach((o) => { try { o.stop(); } catch (e) { /* ok */ } }); }, disconnect() { try { m.disconnect(); } catch (e) { /* ok */ } } };
  }
  // ---------- アンサンブル(合成): 弦・チェロ・ピアノ風・フルート風・ティンパニ・シンバル ----------
  function startEnsemble() {
    const bpm = 72, sd = 60 / bpm / 2, mtof = (m) => 440 * Math.pow(2, (m - 69) / 12); let step = 0, next = ctx.currentTime + 0.1;
    const CH = [[57, 60, 64], [53, 57, 60], [60, 64, 67], [55, 59, 62]], ROOT = [45, 41, 36, 43], MEL = [[76, 72], [77, 72], [79, 76], [74, 71]];
    const voice = (type, f, t, dur, atk, rel, pk, lp, det) => { const o = ctx.createOscillator(), fl = ctx.createBiquadFilter(), gg = ctx.createGain(); o.type = type; o.frequency.value = f; if (det) o.detune.value = det; fl.type = 'lowpass'; fl.frequency.value = lp; gg.gain.setValueAtTime(0.0001, t); gg.gain.linearRampToValueAtTime(pk, t + atk); gg.gain.setValueAtTime(pk, t + dur); gg.gain.exponentialRampToValueAtTime(0.0005, t + dur + rel); o.connect(fl); fl.connect(gg); gg.connect(srcGain); o.start(t); o.stop(t + dur + rel + 0.05); return o; };
    const pluck = (f, t, pk) => { [[1, 1], [2, 0.35], [3, 0.15]].forEach(([k, a]) => { const o = ctx.createOscillator(), gg = ctx.createGain(); o.type = 'sine'; o.frequency.value = f * k; gg.gain.setValueAtTime(0.0001, t); gg.gain.linearRampToValueAtTime(pk * a, t + 0.004); gg.gain.exponentialRampToValueAtTime(0.0005, t + 1.1 / k); o.connect(gg); gg.connect(srcGain); o.start(t); o.stop(t + 1.2); }); };
    const noise = (t, dur, type, f, pk) => { const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), gg = ctx.createGain(); s.buffer = noiseBuf; fl.type = type; fl.frequency.value = f; gg.gain.setValueAtTime(0.0001, t); gg.gain.linearRampToValueAtTime(pk, t + 0.01); gg.gain.exponentialRampToValueAtTime(0.0005, t + dur); s.connect(fl); fl.connect(gg); gg.connect(srcGain); s.start(t, Math.random()); s.stop(t + dur + 0.05); };
    const pump = () => { while (next < ctx.currentTime + 0.15) {
      const s = step % 8, bar = Math.floor(step / 8) % 4, t = next, ch = CH[bar], bl = sd * 8;
      if (s === 0) {
        ch.forEach((m) => { voice('sawtooth', mtof(m), t, bl - 0.1, 0.45, 0.5, 0.05, 2200, -7); voice('sawtooth', mtof(m), t, bl - 0.1, 0.45, 0.5, 0.05, 2200, 7); });  // 弦(ゆっくり立ち上がって持続)
        voice('sawtooth', mtof(ROOT[bar]), t, bl - 0.1, 0.12, 0.4, 0.16, 650, 0);                                                                                          // チェロ/コントラバス
        osc2(t, bar);
      }
      if (s % 1 === 0) { const m = ch[(s * 5 + bar) % 3] + 12; if (s % 2 === 0 || s === 5) pluck(mtof(m), t, 0.11); }                                                         // ピアノ風のばらし
      if (MEL[bar]) { if (s === 0) voice('sine', mtof(MEL[bar][0]), t, sd * 5, 0.06, 0.25, 0.10, 6000, 0); if (s === 6) voice('sine', mtof(MEL[bar][1]), t, sd * 1.8, 0.05, 0.25, 0.09, 6000, 0); }   // フルート風
      step++; next += sd; } };
    const osc2 = (t, bar) => {
      if (bar % 2 === 0 || true) { const o = ctx.createOscillator(), gg = ctx.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(70, t + 0.5); gg.gain.setValueAtTime(0.6, t); gg.gain.exponentialRampToValueAtTime(0.0005, t + 1.4); o.connect(gg); gg.connect(srcGain); o.start(t); o.stop(t + 1.5); noise(t, 0.12, 'lowpass', 900, 0.25); }   // ティンパニ
      if (bar === 0) { noise(t, 3.2, 'highpass', 5500, 0.16); noise(t, 1.2, 'bandpass', 9000, 0.12); }                                                                      // シンバル(4小節に1回)
    };
    pump(); loopTimer = setInterval(pump, 25);
  }
  function startLoop() {
    const bpm = 96, sd = 60 / bpm / 4; let step = 0, next = ctx.currentTime + 0.1;
    const osc = (type, f0, f1, t, dur, pk) => { const o = ctx.createOscillator(), gg = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.8); gg.gain.setValueAtTime(0.0001, t); gg.gain.linearRampToValueAtTime(pk, t + 0.003); gg.gain.exponentialRampToValueAtTime(0.0005, t + dur); o.connect(gg); gg.connect(srcGain); o.start(t); o.stop(t + dur + 0.03); };
    const nz = (t, dur, f, pk) => { const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), gg = ctx.createGain(); s.buffer = noiseBuf; fl.type = 'highpass'; fl.frequency.value = f; gg.gain.setValueAtTime(pk, t); gg.gain.exponentialRampToValueAtTime(0.0005, t + dur); s.connect(fl); fl.connect(gg); gg.connect(srcGain); s.start(t, Math.random()); s.stop(t + dur + 0.03); };
    const KICK = [0, 6, 10], BASS = { 0: 0, 3: 0, 6: 7, 10: 5, 14: 7 };
    const pump = () => { while (next < ctx.currentTime + 0.15) { const s = step % 16; if (KICK.includes(s)) osc('sine', 150, 45, next, 0.22, 0.9); if (s === 4 || s === 12) { nz(next, 0.16, 1800, 0.55); osc('triangle', 200, 140, next, 0.09, 0.4); } if (s % 2 === 0) nz(next, 0.05, 7500, s % 4 === 0 ? 0.3 : 0.18); if (BASS[s] !== undefined) osc('sawtooth', 55 * Math.pow(2, BASS[s] / 12), 0, next, sd * 3.2, 0.5); next += sd; step++; } };
    pump(); loopTimer = setInterval(pump, 25);
  }
  S.playing = false;
  const setPlayLabel = () => { $('playBtn').textContent = $('playBtn2').textContent = S.playing ? '■ とめる' : '▶ なる'; };
  const playToggle = async () => {
    if (S.playing) { S.playing = false; stopSource(); hist.length = 0; setPlayLabel(); return; }
    await initAudio(); S.playing = true; startSource(); pushAudio(); setPlayLabel();
  };
  $('playBtn').onclick = playToggle; $('playBtn2').onclick = playToggle;
  // ---------- ループ ----------
  const wbuf = new Float32Array(1024), buf = new Float32Array(1024), gbar = $('grBar'), gro = $('grO');
  function frame() {
    let lv = LMIN;
    if (ctx && S.playing) { anIn.getFloatTimeDomainData(buf); let pk = 0; for (let i = 0; i < buf.length; i++) { const a = Math.abs(buf[i]); if (a > pk) pk = a; } lv = pk > 1e-5 ? 20 * Math.log10(pk) : LMIN; }
    live.L = lv > live.L ? lv : live.L - 0.6 * 1;                 // 下がるときは、ゆっくり
    if (S.src === 'sine' || S.src === 'sweep') live.L = LV();
    const gs = S.mb ? live.grs : [live.gr], gr = S.playing && S.compOn ? Math.min(0, ...gs) : 0; gbar.style.width = Math.min(100, -gr / 24 * 100) + '%'; gro.textContent = S.mb ? ['低', '中', '高'].map((n, b) => n + ' ' + (S.playing && S.compOn ? Math.min(0, gs[b]) : 0).toFixed(1)).join(' / ') + ' dB' : gr.toFixed(1) + ' dB';
    if (ctx && S.playing) { const t = performance.now(); if (!frame.t || t - frame.t > S.wstep) { frame.t = t; const an = S.wsrc === 'out' ? anOut : anIn; an.getFloatTimeDomainData(wbuf); const w = new Float32Array(WM); let pk = 0; for (let i = 0; i < WM; i++) { w[i] = wbuf[Math.floor(i * wbuf.length / WM)]; } for (let i = 0; i < wbuf.length; i++) { const a = Math.abs(wbuf[i]); if (a > pk) pk = a; } hist.unshift({ w, pk }); if (hist.length > WN) hist.length = WN; } }
    swOff = S.swell ? -15 * (1 - Math.cos(performance.now() / 6000 * 2 * Math.PI)) : 0; if (ctx && S.playing && srcGain) srcGain.gain.setTargetAtTime(Math.pow(10, LV() / 20), ctx.currentTime, 0.03);
    draw(); drawRange(); if (S.playing) drawSmall(); requestAnimationFrame(frame);
  }
  changed(); requestAnimationFrame(frame);
  window.__test = { bgLevel, V, gain, S, compOut, mbGain, eqDb, rebuildEq, changed };
})();
