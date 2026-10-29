// EQとコンプの立体: EQ=平面(周波数)、コンプ=奥行き(入力の大きさ)。高さ=かかるゲイン(dB)
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const FS = 48000, FMIN = 20, FMAX = 20000, LMIN = -60, LMAX = 0, NX = 56, NZ = 26, GR_RANGE = 18;
  // ---------- 状態 ----------
  const GF = [31.25, 62.5, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];       // 1オクターブごと
  const S = { eq: GF.map((f) => ({ type: 'peaking', f, g: 0, q: 1.4 })), eqOn: true, comp: { thr: -24, ratio: 4, knee: 6, att: 10, rel: 150, mk: 0 }, compOn: true, order: 'eqc', src: 'noise', lvl: -14, sf: 400, mode: 'surf', wsrc: 'out', wstep: 60, wstyle: 'thick', contour: false };
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
  function compOut(x) {                                         // 入力x(dB) → 出力(dB)。ソフトニー
    const { thr: T, ratio: R, knee: K } = S.comp; const d = x - T;
    if (2 * d < -K) return x; if (2 * Math.abs(d) <= K) return x + (1 / R - 1) * Math.pow(d + K / 2, 2) / (2 * K); return T + d / R;
  }
  const compGain = (x) => (S.compOn ? compOut(x) - x + S.comp.mk : 0);
  const gain = (f, L, eq) => { const e = eq === undefined ? eqDb(f) : eq; return S.order === 'eqc' ? e + compGain(L + e) : e + compGain(L); };
  const fAt = (u) => FMIN * Math.pow(FMAX / FMIN, u), lAt = (v) => LMIN + (LMAX - LMIN) * v;   // u,v: 0..1
  const uOf = (f) => Math.log(f / FMIN) / Math.log(FMAX / FMIN);

  // ---------- 3D 描画 ----------
  const cv = $('c3'), g = cv.getContext('2d');
  const V = { yaw: -0.55, pitch: 0.5, dist: 3.1, zoom: 1, target: null };
  const VIEWS_SURF = [['ななめ', -0.55, 0.5, null, 3.1, 1], ['正面', 0, 0.02, null, 3.1, 1.5], ['真横', Math.PI / 2, 0.02, null, 3.1, 1.3], ['真上', 0, 1.5, null, 3.1, 1]];
  const VIEWS_WAVE = [['斜め上', 0, 0.62, 'thick', 4.0, 1], ['真横', Math.PI / 2, 0.02, 'thick', 14, 1.25], ['正面(波形の線)', 0, 0.02, 'wave', 14, 1.7]];
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
  const live = { L: LMIN, gr: 0 };
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
    // いまの音: 太い線(その大きさでの周波数特性)、またはサインの点
    const L = Math.max(LMIN, Math.min(LMAX, live.L)), v = (L - LMIN) / (LMAX - LMIN);
    if (S.src === 'sweep') {                                      // スイープが通る道すじ(その大きさでの周波数特性)を、薄い線で
      g.strokeStyle = accent; g.globalAlpha = 0.45; g.lineWidth = 2; g.beginPath(); const zz = wz((S.lvl - LMIN) / (LMAX - LMIN));
      for (let i = 0; i <= NX; i++) { const p = proj(wx(i / NX), wy(gain(fAt(i / NX), S.lvl)) + 0.004, zz); i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]); } g.stroke(); g.globalAlpha = 1;
    }
    if (S.src === 'sine' || S.src === 'sweep') {
      const f = S.src === 'sweep' ? sweepF() : S.sf, gz = gain(f, S.lvl), p0 = proj(wx(uOf(f)), 0, wz((S.lvl - LMIN) / (LMAX - LMIN))), p1 = proj(wx(uOf(f)), wy(gz), wz((S.lvl - LMIN) / (LMAX - LMIN)));
      g.strokeStyle = accent; g.lineWidth = 2; g.beginPath(); g.moveTo(p0[0], p0[1]); g.lineTo(p1[0], p1[1]); g.stroke(); g.fillStyle = accent; g.beginPath(); g.arc(p1[0], p1[1], 6, 0, 7); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.stroke();
    } else if (S.playing) {
      g.strokeStyle = accent; g.lineWidth = 3; g.beginPath();
      for (let i = 0; i <= NX; i++) { const f = fAt(i / NX), p = proj(wx(i / NX), wy(gain(f, L)) + 0.004, wz(v)); i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]); } g.stroke();
    }
    g.textAlign = 'left'; g.fillStyle = muted; g.fillText('ドラッグで回す', 6, H - 6);
  }
  // ---------- 波形の奥行き(平面=波形、奥=時間) ----------
  const WN = 48, WM = 112, ZW = 3.6, hist = [];                           // hist[0]=最新
  function drawWave() {
    if (V.target) { V.yaw += (V.target.yaw - V.yaw) * 0.18; V.pitch += (V.target.pitch - V.pitch) * 0.18; if (V.target.dist) V.dist += (V.target.dist - V.dist) * 0.18; if (V.target.zoom) V.zoom += (V.target.zoom - V.zoom) * 0.18; if (Math.abs(V.target.yaw - V.yaw) < 0.002 && Math.abs(V.target.pitch - V.pitch) < 0.002 && (!V.target.dist || Math.abs(V.target.dist - V.dist) < 0.05) && (!V.target.zoom || Math.abs(V.target.zoom - V.zoom) < 0.01)) V.target = null; }
    const fg = cssv('--fg'), muted = cssv('--muted'), accent = cssv('--accent'), bg = cssv('--bg');
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    const Y = (a) => Math.max(-1, Math.min(1, a * 4)) * 0.8, Zw = (k) => -ZW / 2 + ZW * k / (WN - 1);
    const fl = [[-1, -ZW / 2], [1, -ZW / 2], [1, ZW / 2], [-1, ZW / 2]].map(([x, z]) => proj(x, 0, z)); g.strokeStyle = muted; g.lineWidth = 1; g.beginPath(); fl.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); g.stroke();
    if (S.wstyle === 'thick') {                                   // 厚み: 各瞬間の波の大きさ(包絡)を、上下に膨らんだ立体にする
      const n = Math.min(hist.length, WN), C = 56, cols = [], tmp = [];
      for (let k = 0; k < n; k++) { const s = hist[k].w, row = new Float32Array(C); for (let c = 0; c < C; c++) { let m = 0; const a = Math.floor(c * WM / C), b = Math.min(WM, a + Math.ceil(WM / C) + 4); for (let i = a; i < b; i++) { const v = Math.abs(s[i]); if (v > m) m = v; } row[c] = m; } cols.push(row); }
      let mxA = 0.08; cols.forEach((row) => row.forEach((v) => { if (v > mxA) mxA = v; }));
      const E = (a) => Math.min(1, a * 5) * 1.0, quads = [];
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
    for (let k = Math.min(hist.length, WN) - 1; k >= 0; k--) {   // 奥(古い)から手前へ
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
    g.textAlign = 'left'; g.fillText('手前=いま(太線) / 奥=過去 / 波形を線で重ねる', 6, 14); g.textAlign = 'center';
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
  const outAt = (l) => (S.compOn ? compOut(l) + S.comp.mk : l);
  function handles(w, h) {
    const { thr: T, knee: K, mk } = S.comp, kx = Math.min(0, T + Math.max(K, 4) / 2);
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
    if (S.playing) { const l = Math.max(LMIN, Math.min(LMAX, live.L)); x.fillStyle = fg; x.beginPath(); x.arc(cX(l, w), Math.max(PAD.t, Math.min(h - PAD.b, cY(outAt(l), h))), 4, 0, 7); x.fill(); }
    if (S.compOn) handles(w, h).forEach((p) => { x.fillStyle = bg; x.strokeStyle = accent; x.lineWidth = 2.5; x.beginPath(); x.arc(p.x, p.y, 9, 0, 7); x.fill(); x.stroke(); x.fillStyle = fg; x.textAlign = p.id === 'mk' ? 'left' : p.id === 'ratio' ? 'right' : 'center'; x.fillText(p.n, p.id === 'mk' ? p.x + 12 : p.id === 'ratio' ? p.x - 12 : p.x, p.id === 'mk' ? p.y - 8 : p.id === 'ratio' ? p.y - 8 : p.id === 'knee' ? p.y - 14 : p.y + 24); });
    else { x.fillStyle = muted; x.textAlign = 'center'; x.fillText('コンプはオフ(プリセットで「やさしく」などを選ぶとオン)', w / 2, PAD.t + 14); }
    x.textAlign = 'left';
  }
  let cDrag = null;
  function compMove(e) {
    const r = cc.getBoundingClientRect(), w = r.width, h = r.height, px = e.clientX - r.left, py = e.clientY - r.top, C = S.comp;
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
    cCtl.push(() => { inp.value = S.comp[k]; out.textContent = (+S.comp[k]).toFixed(st < 1 ? 1 : 0) + u; }); inp.oninput = () => { S.comp[k] = +inp.value; changed(); };
  });
  function chips(el, list, getOn, onClick) { list.forEach(([label, val]) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.onclick = () => { onClick(val); changed(); }; b._on = () => getOn(val); el.appendChild(b); }); }
  chips($('modeChips'), [['EQ×コンプ(効きかた)', 'surf'], ['波形の奥行き(時間)', 'wave']], (v) => S.mode === v, (v) => { S.mode = v; if (v === 'wave') S.wstyle = 'thick'; V.target = v === 'wave' ? { yaw: 0, pitch: 0.62, dist: 4.0, zoom: 1 } : { yaw: -0.55, pitch: 0.5, dist: 3.1, zoom: 1 }; buildViews(); });
  chips($('modeChips'), [['入力', 'in'], ['出力', 'out']], (v) => S.wsrc === v, (v) => { S.wsrc = v; hist.length = 0; });
  chips($('modeChips'), [['厚み', 'thick'], ['波形の線', 'wave']], (v) => S.wstyle === v, (v) => { S.wstyle = v; });
  chips($('srcChips'), [['ピンクノイズ', 'noise'], ['ドラム&ベース', 'loop'], ['サイン波', 'sine'], ['サイン波スイープ', 'sweep'], ['ファイル', 'file']], (v) => S.src === v, (v) => { S.src = v; if (S.playing) restartSource(); });
  chips($('ordChips'), [['EQ → コンプ', 'eqc'], ['コンプ → EQ', 'ceq']], (v) => S.order === v, (v) => { S.order = v; rewire(); });
  chips($('eqPre'), [['フラット', 0], ['ドンシャリ', 1], ['かまぼこ', 2], ['前に出す', 3], ['こもらせる', 4], ['電話', 5]], () => false, (i) => {
    const P = [[0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [6, 5, 3, 0, -2, -3, -1, 2, 5, 6], [-9, -7, -3, 1, 3, 3, 2, -3, -7, -10], [-3, -2, 0, 0, 1, 3, 5, 5, 3, 1], [2, 2, 1, 0, -1, -3, -5, -7, -9, -11], [-12, -12, -12, -8, 0, 6, 7, 3, -8, -12]][i]; S.eq.forEach((b, k) => { b.g = P[k]; }); S.eqOn = true;
  });
  chips($('cPre'), [['オフ', 0], ['やさしく', 1], ['ガッツリ', 2], ['リミッター', 3]], () => false, (i) => {
    if (i === 0) { S.compOn = false; return; } S.compOn = true; S.comp = [null, { thr: -20, ratio: 2.5, knee: 12, att: 20, rel: 200, mk: 3 }, { thr: -34, ratio: 8, knee: 4, att: 3, rel: 120, mk: 10 }, { thr: -10, ratio: 20, knee: 0, att: 1, rel: 80, mk: 0 }][i];
  });
  const onoff = (id, label, key) => { const el = $(id); const b = document.createElement('button'); b.type = 'button'; b.onclick = () => { S[key] = !S[key]; changed(); }; b._on = () => S[key]; b._txt = () => label + ': ' + (S[key] ? 'あり' : 'なし'); el.appendChild(b); };
  onoff('modeChips', '等高線', 'contour'); onoff('eqPre', 'EQ', 'eqOn'); onoff('cPre', 'コンプ', 'compOn');
  $('wstep').oninput = (e) => { S.wstep = +e.target.value; hist.length = 0; changed(); };
  $('lvl').oninput = (e) => { S.lvl = +e.target.value; changed(); }; $('sf').oninput = (e) => { S.sf = Math.round(lgSlider(30, 16000).from(+e.target.value)); changed(); };
  buildViews();
  function changed() {
    rebuildEq(); dirty = true; bandCtl.forEach((f) => f()); cCtl.forEach((f) => f());
    $('lvlo').textContent = S.lvl + ' dB'; $('sfo').textContent = fmtF(S.sf); $('sf').value = lgSlider(30, 16000).to(S.sf); $('rwF').hidden = S.src !== 'sine'; $('fileRow').hidden = S.src !== 'file'; $('lgSurf').hidden = $('lgSurf2').hidden = S.mode === 'wave'; $('rwStep').hidden = S.mode !== 'wave'; $('wso').textContent = (S.wstep * 40 / 1000).toFixed(1) + ' 秒'; $('lgWave').hidden = S.mode !== 'wave'; [...$('modeChips').querySelectorAll('button')].forEach((b) => { if (/^(入力|出力|厚み|波形の線|等高線)/.test(b.textContent)) b.hidden = S.mode !== 'wave'; }); $('views').hidden = false;
    document.querySelectorAll('.chips button').forEach((b) => { if (b._on) b.classList.toggle('on', !!b._on()); if (b._txt) b.textContent = b._txt(); });
    pushAudio(); drawSmall();
  }

  // ---------- 音 ----------
  const SWF0 = 30, SWF1 = 16000, SWP = 8; let sweepT0 = 0;
  const sweepF = () => { if (!ctx) return SWF0; const ph = ((ctx.currentTime - sweepT0) % SWP + SWP) % SWP / SWP; return SWF0 * Math.pow(SWF1 / SWF0, Math.max(0, Math.min(1, ph))); };
  let anOut = null, fileBuf = null, ctx = null, comp = null, src = null, srcGain = null, eqNodes = [], eqIn = null, eqOut = null, master = null, anIn = null, loopTimer = null, noiseBuf = null, workletOk = false;
  const WORKLET = `class C extends AudioWorkletProcessor{constructor(){super();this.p={thr:-24,ratio:4,knee:6,att:10,rel:150,mk:0,on:true};this.g=0;this.n=0;this.port.onmessage=e=>Object.assign(this.p,e.data)}
process(ins,outs){const i=ins[0],o=outs[0];if(!i||!i.length)return true;const p=this.p,len=i[0].length,aa=Math.exp(-1/(p.att/1000*sampleRate)),ar=Math.exp(-1/(p.rel/1000*sampleRate));
for(let k=0;k<len;k++){let pk=0;for(let c=0;c<i.length;c++){const a=Math.abs(i[c][k]);if(a>pk)pk=a}
let gr=0;if(p.on){const x=20*Math.log10(Math.max(pk,1e-6)),d=x-p.thr,K=p.knee;let y;if(2*d<-K)y=x;else if(2*Math.abs(d)<=K)y=x+(1/p.ratio-1)*Math.pow(d+K/2,2)/(2*K);else y=p.thr+d/p.ratio;gr=y-x}
const a=gr<this.g?aa:ar;this.g=a*this.g+(1-a)*gr;const m=Math.pow(10,((p.on?this.g+p.mk:0))/20);for(let c=0;c<o.length;c++)o[c][k]=(i[Math.min(c,i.length-1)][k])*m}
this.n+=len;if(this.n>=2400){this.n=0;this.port.postMessage(this.g)}return true}}registerProcessor('comp',C);`;
  async function initAudio() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0.7; master.connect(ctx.destination); anOut = ctx.createAnalyser(); anOut.fftSize = 1024; master.connect(anOut);
    srcGain = ctx.createGain(); anIn = ctx.createAnalyser(); anIn.fftSize = 1024; srcGain.connect(anIn);
    eqIn = ctx.createGain(); eqOut = ctx.createGain(); let prev = eqIn;
    S.eq.forEach((b) => { const f = ctx.createBiquadFilter(); f.type = b.type; prev.connect(f); prev = f; eqNodes.push(f); }); prev.connect(eqOut);
    try { await ctx.audioWorklet.addModule(URL.createObjectURL(new Blob([WORKLET], { type: 'application/javascript' }))); comp = new AudioWorkletNode(ctx, 'comp', { outputChannelCount: [2] }); comp.port.onmessage = (e) => { live.gr = e.data; }; workletOk = true; }
    catch (e) { console.warn('worklet', e && e.message); workletOk = false; comp = ctx.createGain(); $('audioNote').textContent = 'このブラウザは AudioWorklet に対応していないので、コンプは音に効かない(表示だけ)。'; }
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate); const d = noiseBuf.getChannelData(0); let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, pk = 0;
    for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852; b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898; const v = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362; b6 = w * 0.115926; d[i] = v; if (Math.abs(v) > pk) pk = Math.abs(v); }
    for (let i = 0; i < d.length; i++) d[i] /= pk;               // ピーク1.0に
    rewire(); pushAudio();
  }
  function rewire() {
    if (!ctx) return;
    [srcGain, eqOut, comp].forEach((n) => { try { n.disconnect(); } catch (e) { /* 未接続 */ } }); try { srcGain.connect(anIn); } catch (e) { /* ok */ }
    try { srcGain.connect(S.order === 'eqc' ? eqIn : comp); } catch (e) { /* ok */ }
    if (S.order === 'eqc') { eqOut.connect(comp); comp.connect(master); } else { comp.connect(eqIn); eqOut.connect(master); }
  }
  function pushAudio() {
    if (!ctx) return;
    S.eq.forEach((b, i) => { const n = eqNodes[i]; n.frequency.value = b.f; n.gain.value = S.eqOn ? b.g : 0; n.Q.value = b.q; });
    if (workletOk) comp.port.postMessage({ thr: S.comp.thr, ratio: S.comp.ratio, knee: S.comp.knee, att: S.comp.att, rel: S.comp.rel, mk: S.comp.mk, on: S.compOn });
    srcGain.gain.value = Math.pow(10, S.lvl / 20);
    if (S.src === 'sine' && src && src.frequency) src.frequency.value = S.sf;
  }
  function startSource() {
    stopSource();
    if (S.src === 'noise') { const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; s.connect(srcGain); s.start(); src = s; }
    else if (S.src === 'sweep') { const o = ctx.createOscillator(), t0 = ctx.currentTime + 0.05; o.type = 'sine'; sweepT0 = t0; o.frequency.setValueAtTime(SWF0, t0); for (let c = 0; c < 200; c++) { o.frequency.exponentialRampToValueAtTime(SWF1, t0 + (c + 1) * SWP); o.frequency.setValueAtTime(SWF0, t0 + (c + 1) * SWP); } o.connect(srcGain); o.start(); src = o; }
    else if (S.src === 'sine') { const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = S.sf; o.connect(srcGain); o.start(); src = o; }
    else if (S.src === 'file') { if (!fileBuf) { src = null; return; } const s = ctx.createBufferSource(); s.buffer = fileBuf; s.loop = true; const n = ctx.createGain(); n.gain.value = 1 / Math.max(0.05, fileBuf._pk || 1); s.connect(n); n.connect(srcGain); s.start(); src = s; src._n = n; }
    else { src = null; startLoop(); }
  }
  function stopSource() { if (src) { try { src.stop(); } catch (e) { /* ok */ } try { src.disconnect(); } catch (e) { /* ok */ } src = null; } clearInterval(loopTimer); loopTimer = null; }
  $('fileIn').onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return; await initAudio();
    try { const ab = await f.arrayBuffer(); fileBuf = await ctx.decodeAudioData(ab); let pk = 0; for (let c = 0; c < fileBuf.numberOfChannels; c++) { const d = fileBuf.getChannelData(c); for (let i = 0; i < d.length; i += 7) { const a = Math.abs(d[i]); if (a > pk) pk = a; } } fileBuf._pk = pk; $('fileName').textContent = f.name + '(' + fileBuf.duration.toFixed(1) + '秒)'; if (S.playing && S.src === 'file') startSource(); }
    catch (err) { $('fileName').textContent = '読み込めなかった(対応していない形式かも)'; }
  };
  const restartSource = () => { if (ctx && S.playing) startSource(); };
  // ドラム&ベースのループ(レベル変化のある素材)
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
    if (S.src === 'sine' || S.src === 'sweep') live.L = S.lvl;
    const gr = S.playing && S.compOn ? Math.min(0, live.gr) : 0; gbar.style.width = Math.min(100, -gr / 24 * 100) + '%'; gro.textContent = (gr).toFixed(1) + ' dB';
    if (ctx && S.playing) { const t = performance.now(); if (!frame.t || t - frame.t > S.wstep) { frame.t = t; const an = S.wsrc === 'out' ? anOut : anIn; an.getFloatTimeDomainData(wbuf); const w = new Float32Array(WM); let pk = 0; for (let i = 0; i < WM; i++) { w[i] = wbuf[Math.floor(i * wbuf.length / WM)]; } for (let i = 0; i < wbuf.length; i++) { const a = Math.abs(wbuf[i]); if (a > pk) pk = a; } hist.unshift({ w, pk }); if (hist.length > WN) hist.length = WN; } }
    draw(); if (S.playing) drawSmall(); requestAnimationFrame(frame);
  }
  changed(); requestAnimationFrame(frame);
  window.__test = { V, gain, S, compOut, eqDb, rebuildEq, changed };
})();
