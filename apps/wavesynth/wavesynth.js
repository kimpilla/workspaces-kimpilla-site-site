// なみシンセ: 画面の波を指で描くと、そのまま音になる。
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const N = 256;                       // 波の1しゅうきを、256この点で持つ
  const H = 64;                        // 音にする倍音の数
  const F0 = 130.81;                   // 倍音の表示に使う、基準の音(C3)
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  // ---------- 音の状態 ----------
  const p = {
    wave: new Float32Array(N), ghost: new Float32Array(N),
    cutoff: 1200, q: 4, a: 0.01, d: 0.3, s: 0.6, r: 0.25,
    osc2: 0.4, detune: 8, delay: 0.3, fb: 0.35, mix: 0, vol: 0.6,
  };

  // ---------- 波の作り方(形) ----------
  const shapes = {
    sine: (t) => Math.sin(2 * Math.PI * t),
    tri: (t) => (t < 0.5 ? -1 + 4 * t : 3 - 4 * t),
    saw: (t) => 2 * t - 1,
    square: (t) => (t < 0.5 ? 1 : -1),
    pulse: (t) => (t < 0.25 ? 1 : -1),
    bell: (t) => [1, 0, 0.35, 0, 0, 0.5, 0, 0.2].reduce((s, a, i) => s + a * Math.sin(2 * Math.PI * (i + 1) * t), 0),
  };
  function fillShape(name) {
    const f = shapes[name];
    for (let i = 0; i < N; i++) p.wave[i] = f(i / N);
    normalize(); p.ghost.set(p.wave);
  }
  function normalize() {
    let m = 0; for (let i = 0; i < N; i++) m = Math.max(m, Math.abs(p.wave[i]));
    if (m > 0) for (let i = 0; i < N; i++) p.wave[i] /= m;
  }
  function randomSteps() {
    const k = 12, v = []; for (let i = 0; i < k; i++) v.push(Math.random() * 2 - 1);
    for (let i = 0; i < N; i++) p.wave[i] = v[Math.floor(i / N * k)];
    normalize(); p.ghost.set(p.wave);
  }
  function smoothWave() {
    const w = p.wave, o = new Float32Array(N);
    for (let pass = 0; pass < 3; pass++) {
      for (let i = 0; i < N; i++) o[i] = (w[(i + N - 1) % N] + 2 * w[i] + w[(i + 1) % N]) / 4;
      w.set(o);
    }
  }

  // ---------- 波 → 音 ----------
  let ctx = null, out, dry, wet, delay, fb, master, analyser, pw = null;
  const voices = new Map();
  let harm = new Float32Array(H + 1);                 // 倍音の強さ(表示用)
  function analyzeWave() {
    const re = new Float32Array(H + 1), im = new Float32Array(H + 1);
    for (let k = 1; k <= H; k++) {
      let r = 0, s = 0;
      for (let n = 0; n < N; n++) { const a = 2 * Math.PI * k * n / N; r += p.wave[n] * Math.cos(a); s += p.wave[n] * Math.sin(a); }
      re[k] = 2 * r / N; im[k] = 2 * s / N; harm[k] = Math.hypot(re[k], im[k]);
    }
    return [re, im];
  }
  function rebuildWave() {
    const [re, im] = analyzeWave();
    if (!ctx) return;
    pw = ctx.createPeriodicWave(re, im);
    for (const v of voices.values()) { v.o1.setPeriodicWave(pw); v.o2.setPeriodicWave(pw); }
  }
  function ensureAudio() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    out = ctx.createGain(); out.gain.value = 0.35;
    dry = ctx.createGain(); wet = ctx.createGain();
    delay = ctx.createDelay(2); fb = ctx.createGain();
    master = ctx.createGain(); analyser = ctx.createAnalyser(); analyser.fftSize = 2048;
    const comp = ctx.createDynamicsCompressor();
    out.connect(dry); out.connect(delay); delay.connect(fb); fb.connect(delay); delay.connect(wet);
    dry.connect(master); wet.connect(master); master.connect(comp); comp.connect(analyser); analyser.connect(ctx.destination);
    applyGlobal(); rebuildWave();
  }
  function applyGlobal() {
    if (!ctx) return;
    const t = ctx.currentTime;
    master.gain.setTargetAtTime(p.vol, t, 0.02);
    delay.delayTime.setTargetAtTime(p.delay, t, 0.05);
    fb.gain.setTargetAtTime(p.fb, t, 0.02);
    dry.gain.setTargetAtTime(1 - p.mix * 0.5, t, 0.02);
    wet.gain.setTargetAtTime(p.mix, t, 0.02);
    for (const v of voices.values()) {
      v.filter.frequency.setTargetAtTime(p.cutoff, t, 0.02); v.filter.Q.setTargetAtTime(p.q, t, 0.02);
      v.o2.detune.setTargetAtTime(p.detune, t, 0.02);
      v.g1.gain.setTargetAtTime(1 / (1 + p.osc2), t, 0.02); v.g2.gain.setTargetAtTime(p.osc2 / (1 + p.osc2), t, 0.02);
    }
  }
  const midiHz = (n) => 440 * Math.pow(2, (n - 69) / 12);
  function noteOn(n) {
    ensureAudio();
    if (voices.has(n)) return;
    const t = ctx.currentTime, f = midiHz(n);
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), g1 = ctx.createGain(), g2 = ctx.createGain();
    const filter = ctx.createBiquadFilter(), amp = ctx.createGain();
    if (pw) { o1.setPeriodicWave(pw); o2.setPeriodicWave(pw); }
    o1.frequency.value = f; o2.frequency.value = f; o2.detune.value = p.detune;
    g1.gain.value = 1 / (1 + p.osc2); g2.gain.value = p.osc2 / (1 + p.osc2);
    filter.type = 'lowpass'; filter.frequency.value = p.cutoff; filter.Q.value = p.q;
    amp.gain.setValueAtTime(0, t);
    amp.gain.linearRampToValueAtTime(1, t + p.a);
    amp.gain.linearRampToValueAtTime(p.s, t + p.a + p.d);
    o1.connect(g1); o2.connect(g2); g1.connect(filter); g2.connect(filter); filter.connect(amp); amp.connect(out);
    o1.start(t); o2.start(t);
    voices.set(n, { o1, o2, g1, g2, filter, amp, t0: t, a: p.a, d: p.d, s: p.s });
  }
  function noteOff(n) {
    const v = voices.get(n); if (!v) return;
    voices.delete(n);
    const t = ctx.currentTime, e = t - v.t0;
    const lvl = e < v.a ? e / v.a : e < v.a + v.d ? 1 - (1 - v.s) * ((e - v.a) / v.d) : v.s;
    v.amp.gain.cancelScheduledValues(t); v.amp.gain.setValueAtTime(lvl, t);
    v.amp.gain.linearRampToValueAtTime(0, t + p.r);
    v.o1.stop(t + p.r + 0.05); v.o2.stop(t + p.r + 0.05);
    setTimeout(() => { try { v.amp.disconnect(); } catch (e2) { /* 済み */ } }, (p.r + 0.2) * 1000);
  }

  // ---------- 見た目: 画面(エディター) ----------
  const ed = $('ed'), eg = ed.getContext('2d');
  let mode = 'shape', W = 0, Hh = 0;
  function fit(c) {
    const d = window.devicePixelRatio || 1, w = c.clientWidth, h = c.clientHeight;
    if (c.width !== Math.round(w * d) || c.height !== Math.round(h * d)) { c.width = Math.round(w * d); c.height = Math.round(h * d); }
    const g = c.getContext('2d'); g.setTransform(d, 0, 0, d, 0, 0); return [w, h];
  }
  const lx = (f) => (Math.log(f) - Math.log(40)) / (Math.log(12000) - Math.log(40)) * W;
  const xl = (x) => Math.exp(Math.log(40) + clamp(x / W, 0, 1) * (Math.log(12000) - Math.log(40)));
  const filtDb = (f) => { const ql = Math.pow(10, p.q / 20), r = f / p.cutoff; return 10 * Math.log10(1 / ((1 - r * r) * (1 - r * r) + (r / ql) * (r / ql))); };
  const ENV_T = 4.5, ECHO_T = 3, MG = 18;           // MG=左右の余白(点が欠けないように)

  function grid() {
    eg.strokeStyle = '#12392a'; eg.lineWidth = 1; eg.beginPath();
    for (let i = 1; i < 8; i++) { const x = Math.round(W * i / 8) + 0.5; eg.moveTo(x, 0); eg.lineTo(x, Hh); }
    for (let i = 1; i < 4; i++) { const y = Math.round(Hh * i / 4) + 0.5; eg.moveTo(0, y); eg.lineTo(W, y); }
    eg.stroke();
  }
  function glow(color, w) { eg.strokeStyle = color; eg.lineWidth = w; eg.shadowColor = color; eg.shadowBlur = 8; eg.lineJoin = 'round'; }
  function nglow() { eg.shadowBlur = 0; }

  function drawShape() {
    const y = (v) => Hh / 2 - v * Hh * 0.4;
    eg.strokeStyle = '#1f7a52'; eg.beginPath(); eg.moveTo(0, Hh / 2); eg.lineTo(W, Hh / 2); eg.stroke();
    eg.setLineDash([6, 5]); glow('#ffb84d', 2); eg.beginPath();
    for (let i = 0; i < N; i++) { const x = i / (N - 1) * W; i ? eg.lineTo(x, y(p.ghost[i])) : eg.moveTo(x, y(p.ghost[i])); }
    eg.stroke(); eg.setLineDash([]);
    glow('#4dff9f', 3); eg.beginPath();
    for (let i = 0; i < N; i++) { const x = i / (N - 1) * W; i ? eg.lineTo(x, y(p.wave[i])) : eg.moveTo(x, y(p.wave[i])); }
    eg.stroke(); nglow();
  }
  function drawFilter() {
    // 倍音の棒(フィルターを通る前=細い線、通ったあと=太い棒)
    let mx = 0; for (let k = 1; k <= H; k++) mx = Math.max(mx, harm[k]); mx = mx || 1;
    for (let k = 1; k <= H; k++) {
      const f = F0 * k; if (f > 12000) break;
      const x = lx(f), a = harm[k] / mx, fa = a * Math.pow(10, filtDb(f) / 20);
      eg.strokeStyle = '#ffb84d66'; eg.lineWidth = 1; eg.beginPath(); eg.moveTo(x, Hh); eg.lineTo(x, Hh - a * Hh * 0.7); eg.stroke();
      glow('#4dff9f', 4); eg.beginPath(); eg.moveTo(x, Hh); eg.lineTo(x, Hh - Math.min(fa, 1.25) * Hh * 0.68); eg.stroke(); nglow();
    }
    // フィルターの形
    glow('#ffb84d', 2.5); eg.beginPath();
    for (let x = 0; x <= W; x += 3) { const db = clamp(filtDb(xl(x)), -48, 24), yy = Hh * (1 - (db + 48) / 72) * 0.92 + Hh * 0.04; x ? eg.lineTo(x, yy) : eg.moveTo(x, yy); }
    eg.stroke(); nglow();
    const hx = lx(p.cutoff), hy = Hh * (0.9 - 0.75 * p.q / 20);
    handle(hx, hy);
    eg.fillStyle = '#6fb596'; eg.font = '11px ui-monospace,monospace'; eg.textAlign = 'center';
    eg.fillText(Math.round(p.cutoff) + 'Hz  クセ ' + p.q.toFixed(1), clamp(hx, 70, W - 70), clamp(hy - 24, 44, Hh - 30));
  }
  function handle(x, y) {
    eg.fillStyle = '#ffb84d33'; eg.strokeStyle = '#ffb84d'; eg.lineWidth = 2; eg.beginPath(); eg.arc(x, y, 17, 0, 7); eg.fill(); eg.stroke();
    eg.fillStyle = '#ffb84d'; eg.beginPath(); eg.arc(x, y, 6, 0, 7); eg.fill();
  }
  const envPts = () => {
    const x = (t) => MG + t / ENV_T * (W - 2 * MG), y0 = Hh * 0.9, yy = (v) => y0 - v * Hh * 0.78, hold = 0.5;
    return [[0, y0], [x(p.a), yy(1)], [x(p.a + p.d), yy(p.s)], [x(p.a + p.d + hold), yy(p.s)], [x(p.a + p.d + hold + p.r), y0]];
  };
  function drawEnv() {
    const pts = envPts();
    eg.fillStyle = '#4dff9f22'; eg.beginPath(); pts.forEach((q, i) => (i ? eg.lineTo(q[0], q[1]) : eg.moveTo(q[0], q[1]))); eg.lineTo(pts[4][0], Hh * 0.9); eg.closePath(); eg.fill();
    glow('#4dff9f', 3); eg.beginPath(); pts.forEach((q, i) => (i ? eg.lineTo(q[0], q[1]) : eg.moveTo(q[0], q[1]))); eg.stroke(); nglow();
    eg.fillStyle = '#6fb596'; eg.font = '11px ui-monospace,monospace'; eg.textAlign = 'center';
    eg.fillText('A ' + p.a.toFixed(2) + '秒', clamp(pts[1][0], 36, W - 36), Hh - 8);
    eg.fillText('D ' + p.d.toFixed(2) + '秒  S ' + Math.round(p.s * 100) + '%', clamp((pts[1][0] + pts[2][0]) / 2 + 20, 100, W - 70), 44);
    eg.fillText('R ' + p.r.toFixed(2) + '秒', clamp(pts[4][0] - 10, 36, W - 36), Hh - 8);
    handle(pts[1][0], pts[1][1]); handle(pts[2][0], pts[2][1]); handle(pts[4][0], pts[4][1]);
  }
  function drawEcho() {
    const x = (t) => MG + t / ECHO_T * (W - 2 * MG), y0 = Hh * 0.88;
    const bar = (t, lvl, col) => { glow(col, 5); eg.beginPath(); eg.moveTo(x(t), y0); eg.lineTo(x(t), y0 - lvl * Hh * 0.7); eg.stroke(); nglow(); };
    bar(0, 1, '#ffb84d');
    for (let k = 1; k * p.delay < ECHO_T; k++) bar(k * p.delay, Math.max(0.02, (0.25 + p.mix * 0.75) * Math.pow(p.fb, k - 1)), '#4dff9f');
    handle(x(p.delay), Hh * (0.9 - 0.8 * p.fb / 0.85));
    eg.fillStyle = '#6fb596'; eg.font = '11px ui-monospace,monospace'; eg.textAlign = 'center';
    eg.fillText('間隔 ' + p.delay.toFixed(2) + '秒  フィードバック ' + Math.round(p.fb * 100) + '%', clamp(x(p.delay), 90, W - 90), Hh - 6);
  }
  function drawEditor() {
    [W, Hh] = fit(ed); eg.clearRect(0, 0, W, Hh); grid();
    ({ shape: drawShape, filter: drawFilter, env: drawEnv, echo: drawEcho })[mode]();
    drawSpectrum();
  }
  const sp = $('sp'), sg = sp.getContext('2d');
  function drawSpectrum() {
    const [w, h] = fit(sp); sg.clearRect(0, 0, w, h);
    const K = 32; let mx = 0; for (let k = 1; k <= H; k++) mx = Math.max(mx, harm[k]); mx = mx || 1;
    const bw = w / K;
    for (let k = 1; k <= K; k++) {
      let a = harm[k] / mx; if (mode === 'filter') a *= Math.pow(10, filtDb(F0 * k) / 20);
      a = Math.min(a, 1); sg.fillStyle = mode === 'filter' ? '#4dff9f' : '#1f7a52';
      sg.fillRect((k - 1) * bw + 1, h - a * (h - 4), bw - 2, a * (h - 4));
    }
  }

  // ---------- さわる(指で描く・動かす) ----------
  let drag = null;
  function pos(e) { const r = ed.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
  function setWaveAt(x, y, last) {
    const i = clamp(Math.round(x / W * (N - 1)), 0, N - 1), v = clamp((Hh / 2 - y) / (Hh * 0.4), -1, 1);
    if (last == null) { p.wave[i] = v; return i; }
    const a = Math.min(i, last), b = Math.max(i, last);
    for (let j = a; j <= b; j++) { const t = b === a ? 1 : (j - last) / (i - last); p.wave[j] = clamp(p.wave[last] * (1 - t) + v * t, -1, 1); }
    p.wave[i] = v; return i;
  }
  function onMove(e) {
    const [x, y] = pos(e);
    if (mode === 'shape') { drag.last = setWaveAt(x, y, drag.last); rebuildWave(); }
    else if (mode === 'filter') { p.cutoff = clamp(xl(x), 40, 12000); p.q = clamp((0.9 - y / Hh) / 0.75 * 20, 0, 20); applyGlobal(); }
    else if (mode === 'env') {
      const t = clamp((x - MG) / (W - 2 * MG), 0, 1) * ENV_T, y0 = Hh * 0.9, lvl = clamp((y0 - y) / (Hh * 0.78), 0, 1);
      if (drag.h === 1) p.a = clamp(t, 0.003, 1.2);
      else if (drag.h === 2) { p.d = clamp(t - p.a, 0.02, 1.5); p.s = lvl; }
      else if (drag.h === 4) p.r = clamp(t - (p.a + p.d + 0.5), 0.02, 2);
    } else if (mode === 'echo') { p.delay = clamp((x - MG) / (W - 2 * MG) * ECHO_T, 0.05, 1); p.fb = clamp((0.9 - y / Hh) / 0.8 * 0.85, 0, 0.85); applyGlobal(); }
    drawEditor(); updateCaps();
  }
  ed.addEventListener('pointerdown', (e) => {
    e.preventDefault(); ed.setPointerCapture(e.pointerId); ensureAudio();
    drag = { last: null, h: 0 };
    if (mode === 'env') {
      const [x, y] = pos(e), pts = envPts(); let best = 1e9;
      [1, 2, 4].forEach((i) => { const d = Math.hypot(pts[i][0] - x, pts[i][1] - y); if (d < best) { best = d; drag.h = i; } });
    }
    onMove(e);
  });
  ed.addEventListener('pointermove', (e) => { if (drag) onMove(e); });
  const endDrag = () => { drag = null; };
  ed.addEventListener('pointerup', endDrag); ed.addEventListener('pointercancel', endDrag);

  // ---------- ボタン類 ----------
  const MODE = {
    shape: ['指で波をなぞって描く。描いた形がそのまま音になる。', '1周期分の波(指で描き替える)', '緑=いまの音 / 橙=元の形'],
    filter: ['点を指で動かす。右ほど明るく、上ほど削る境目がとがる(クセが強い)。', 'フィルター(右=明るい / 上=クセが強い)', '橙=元の倍音 / 緑=通った倍音'],
    env: ['3つの点を動かす。1つ目=立ち上がり(A)、2つ目=落ち着く大きさ(D・S)、3つ目=余韻(R)。', 'エンベロープ(音量の変化)', '時間 →'],
    echo: ['点を指で動かす。右ほど間隔が長く、上ほど何度も返ってくる。', 'ディレイ(橙=原音 / 緑=返ってくる音)', ''],
  };
  function updateCaps() { $('cap').textContent = MODE[mode][1]; $('cap2').textContent = MODE[mode][2]; $('hint').textContent = MODE[mode][0]; $('splab').textContent = mode === 'filter' ? '↑ フィルターを通ったあとの倍音の強さ' : '↑ この波に含まれる倍音の強さ'; }
  function slider(label, key, min, max, step, fmt) {
    const l = document.createElement('label'), s = document.createElement('span'), i = document.createElement('input');
    i.type = 'range'; i.min = min; i.max = max; i.step = step; i.value = p[key]; s.textContent = label + ' ' + fmt(p[key]);
    i.addEventListener('input', () => { p[key] = parseFloat(i.value); s.textContent = label + ' ' + fmt(p[key]); applyGlobal(); drawEditor(); });
    l.append(s, i); return l;
  }
  function buildExtra() {
    const x = $('extra'); x.innerHTML = '';
    if (mode === 'shape') {
      const defs = [['なめらか', () => fillShape('sine')], ['三角', () => fillShape('tri')], ['のこぎり', () => fillShape('saw')], ['四角', () => fillShape('square')], ['ランダム', randomSteps], ['スムーズ', () => { smoothWave(); normalize(); }]];
      defs.forEach(([n, f]) => { const b = document.createElement('button'); b.textContent = n; b.addEventListener('click', () => { ensureAudio(); f(); rebuildWave(); drawEditor(); }); x.append(b); });
      const br = document.createElement('div'); br.style.cssText = 'flex-basis:100%;height:0'; x.append(br);
      x.append(slider('重ねる', 'osc2', 0, 1, 0.01, (v) => Math.round(v * 100) + '%'), slider('ずらし', 'detune', -50, 50, 1, (v) => v + 'セント'));
      const sv = document.createElement('button'); sv.textContent = 'この波を保存'; sv.addEventListener('click', saveMine); x.append(sv);
    } else if (mode === 'echo') {
      x.append(slider('量', 'mix', 0, 0.8, 0.01, (v) => Math.round(v / 0.8 * 100) + '%'));
    }
  }
  function setMode(m) {
    mode = m; document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.m === m));
    buildExtra(); updateCaps(); drawEditor();
  }
  document.querySelectorAll('#tabs button').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.m)));

  // ---------- プリセット ----------
  const PRE = [
    ['ベース', { shape: 'saw', cutoff: 600, q: 6, a: 0.005, d: 0.25, s: 0.5, r: 0.15, osc2: 0.5, detune: 8, mix: 0, delay: 0.3, fb: 0.3 }],
    ['リード', { shape: 'pulse', cutoff: 3500, q: 4, a: 0.01, d: 0.2, s: 0.7, r: 0.25, osc2: 0.4, detune: 10, mix: 0.25, delay: 0.3, fb: 0.35 }],
    ['ベル', { shape: 'bell', cutoff: 9000, q: 1, a: 0.003, d: 1.2, s: 0, r: 1.2, osc2: 0.2, detune: 6, mix: 0.35, delay: 0.4, fb: 0.5 }],
    ['パッド', { shape: 'tri', cutoff: 1400, q: 2, a: 0.8, d: 0.6, s: 0.8, r: 1.4, osc2: 0.8, detune: 14, mix: 0.4, delay: 0.45, fb: 0.5 }],
    ['ブォーン', { shape: 'saw', cutoff: 380, q: 14, a: 0.02, d: 0.6, s: 0.6, r: 0.3, osc2: 1, detune: 22, mix: 0.1, delay: 0.25, fb: 0.4 }],
  ];
  const preEl = $('pre');
  function applyPreset(o) {
    if (o.shape) fillShape(o.shape);
    ['cutoff', 'q', 'a', 'd', 's', 'r', 'osc2', 'detune', 'mix', 'delay', 'fb'].forEach((k) => { if (o[k] != null) p[k] = o[k]; });
    analyzeWave(); rebuildWave(); applyGlobal(); buildExtra(); drawEditor();
  }
  function addPre(name, o, mine) {
    const b = document.createElement('button'); b.textContent = name; b.dataset.mine = mine ? '1' : '';
    b.addEventListener('click', () => { ensureAudio(); preEl.querySelectorAll('button').forEach((x) => x.classList.remove('on')); b.classList.add('on'); applyPreset(o); });
    preEl.append(b); return b;
  }
  PRE.forEach(([n, o]) => addPre(n, o, false));
  const MINE = 'wavesynth.mine';
  function mineObj() { const o = {}; ['cutoff', 'q', 'a', 'd', 's', 'r', 'osc2', 'detune', 'mix', 'delay', 'fb'].forEach((k) => { o[k] = p[k]; }); o.wave = Array.from(p.wave); return o; }
  function applyMine(o) { p.wave.set(o.wave); p.ghost.set(o.wave); delete o.shape; applyPresetFromMine(o); }
  function applyPresetFromMine(o) { ['cutoff', 'q', 'a', 'd', 's', 'r', 'osc2', 'detune', 'mix', 'delay', 'fb'].forEach((k) => { if (o[k] != null) p[k] = o[k]; }); analyzeWave(); rebuildWave(); applyGlobal(); buildExtra(); drawEditor(); }
  function saveMine() {
    try { localStorage.setItem(MINE, JSON.stringify(mineObj())); } catch (e) { /* ほぞんできない */ }
    showMine(true);
  }
  function showMine(flash) {
    let o = null; try { o = JSON.parse(localStorage.getItem(MINE) || 'null'); } catch (e) { o = null; }
    const old = preEl.querySelector('[data-mine="1"]'); if (old) old.remove();
    if (!o || !o.wave || o.wave.length !== N) return;
    const b = addPre('MY WAVE', null, true);
    b.replaceWith(b.cloneNode(true)); const nb = preEl.querySelector('[data-mine="1"]');
    nb.addEventListener('click', () => { ensureAudio(); preEl.querySelectorAll('button').forEach((x) => x.classList.remove('on')); nb.classList.add('on'); applyMine(o); });
    if (flash) { nb.classList.add('on'); }
  }

  // ---------- 鍵盤 ----------
  const kb = $('kb'); let base = 48;                         // C3
  const WHITE = [0, 2, 4, 5, 7, 9, 11, 12], BLACK = [[1, 1], [3, 2], [6, 4], [8, 5], [10, 6]];
  const NAMES = { 0: 'C', 12: 'C' };
  function buildKeys() {
    kb.innerHTML = '';
    WHITE.forEach((o, i) => { const d = document.createElement('div'); d.className = 'wk'; d.dataset.n = base + o; d.style.left = i * 12.5 + '%'; d.style.width = '12.5%'; if (NAMES[o]) { const s = document.createElement('span'); s.textContent = 'C' + (Math.floor((base + o) / 12) - 1); d.append(s); } kb.append(d); });
    BLACK.forEach(([o, b]) => { const d = document.createElement('div'); d.className = 'bk'; d.dataset.n = base + o; d.style.left = (b * 12.5 - 4) + '%'; d.style.width = '8%'; kb.append(d); });
  }
  const down = new Map();                                    // pointerId → いまの音
  const keyAt = (x, y) => { const e = document.elementFromPoint(x, y); return e && e.dataset && e.dataset.n != null && kb.contains(e) ? e : null; };
  function press(id, el) {
    const cur = down.get(id), n = el ? +el.dataset.n : null;
    if (cur && cur.n === n) return;
    if (cur) { noteOff(cur.n); cur.el.classList.remove('dn'); down.delete(id); }
    if (el) { noteOn(n); el.classList.add('dn'); down.set(id, { n, el }); }
  }
  kb.addEventListener('pointerdown', (e) => { e.preventDefault(); kb.setPointerCapture(e.pointerId); press(e.pointerId, keyAt(e.clientX, e.clientY)); });
  kb.addEventListener('pointermove', (e) => { if (down.has(e.pointerId)) press(e.pointerId, keyAt(e.clientX, e.clientY)); });
  const up = (e) => press(e.pointerId, null);
  kb.addEventListener('pointerup', up); kb.addEventListener('pointercancel', up);
  const KEYMAP = { a: 0, w: 1, s: 2, e: 3, d: 4, f: 5, t: 6, g: 7, y: 8, h: 9, u: 10, j: 11, k: 12 };
  const held = new Set();
  window.addEventListener('keydown', (e) => {
    if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return; const o = KEYMAP[e.key.toLowerCase()]; if (o == null) return;
    const n = base + o; if (held.has(n)) return; held.add(n); noteOn(n);
    const el = kb.querySelector('[data-n="' + n + '"]'); if (el) el.classList.add('dn');
  });
  window.addEventListener('keyup', (e) => {
    const o = KEYMAP[e.key.toLowerCase()]; if (o == null) return; const n = base + o; if (!held.has(n)) return; held.delete(n); noteOff(n);
    const el = kb.querySelector('[data-n="' + n + '"]'); if (el) el.classList.remove('dn');
  });
  $('octdn').addEventListener('click', () => { base = Math.max(24, base - 12); buildKeys(); });
  $('octup').addEventListener('click', () => { base = Math.min(84, base + 12); buildKeys(); });
  $('vol').addEventListener('input', (e) => { p.vol = e.target.value / 100; applyGlobal(); });
  p.vol = $('vol').value / 100;

  // ---------- 出ている音の波(スコープ) ----------
  const sc = $('sc'), scg = sc.getContext('2d'); let buf = null;
  function scope() {
    const [w, h] = fit(sc); scg.clearRect(0, 0, w, h);
    scg.strokeStyle = '#4dff9f'; scg.lineWidth = 2; scg.shadowColor = '#4dff9f'; scg.shadowBlur = 6; scg.beginPath();
    if (analyser && voices.size) {
      if (!buf) buf = new Uint8Array(analyser.fftSize);
      analyser.getByteTimeDomainData(buf);
      let s0 = 0; for (let i = 1; i < buf.length / 2; i++) if (buf[i - 1] < 128 && buf[i] >= 128) { s0 = i; break; }
      for (let i = 0; i < 512; i++) { const x = i / 511 * w, y = (1 - buf[s0 + i] / 255) * h; i ? scg.lineTo(x, y) : scg.moveTo(x, y); }
    } else { scg.moveTo(0, h / 2); scg.lineTo(w, h / 2); }
    scg.stroke(); scg.shadowBlur = 0; requestAnimationFrame(scope);
  }

  // ---------- 液晶の表示 ----------
  function lcd() {
    $('lcdO').textContent = 'OCT C' + (Math.floor(base / 12) - 1);
    $('lcdV').textContent = 'VOL ' + Math.round(p.vol * 100) + '%';
    $('lcdP').textContent = 'VOICES ' + voices.size;
  }
  setInterval(lcd, 150);

  // ---------- はじめ ----------
  fillShape('saw'); applyPreset(PRE[0][1]);
  preEl.querySelector('button').classList.add('on');
  showMine(false); buildKeys(); setMode('shape'); scope();
  window.addEventListener('resize', drawEditor);
  window.__ws = { p, setMode, noteOn, noteOff, get mode() { return mode; } };
})();
