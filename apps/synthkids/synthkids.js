// おとあそびシンセ: こども向けの、さわって遊ぶシンセ(Web Audio API だけ)
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);

  const DEFAULTS = { char: 'furarin', volume: 0.35, cutoff: 4500, echo: 0.35, vib: 30, distAmt: 0.5, chAmt: 0.5, attack: 0.03, decay: 0.5, sustain: 0.7, release: 0.5, osc2: 0, detune: 8, sub: 0 };
  const p = Object.assign({}, DEFAULTS);
  p.fx = { dist: false, chorus: false, vib: false, echo: false };      // エフェクターの、入り・切り
  let mode = 'safe', base = 60;                       // base = 一番左のド(MIDI 60 = 真ん中のド)

  // ---- キャラクター(このサイトのオリジナル)。波の形 → 見た目 ----
  const WAVEPATH = {                                    // おなかに描く、波の形(幅40×高さ16)
    sine: 'M0 8 C6 -4 14 -4 20 8 S34 20 40 8',
    sawtooth: 'M0 14 L18 2 L18 14 L40 2',
    square: 'M0 14 V2 H13 V14 H27 V2 H40',
    triangle: 'M0 14 L10 2 L30 14 L40 2',
  };
  const CHARS = [
    { id: 'furarin', wave: 'sine', name: 'ふわりん', color: '#ff8fb1', tip: 'ふわりん: まあるい やさしい こえ',
      body: '<ellipse cx="50" cy="56" rx="40" ry="35" fill="#ff8fb1"/>', ey: 50, my: 66, wy: 72, ex: 17 },
    { id: 'gizako', wave: 'sawtooth', name: 'ギザっこ', color: '#ffc93c', tip: 'ギザっこ: ギザギザで ビリビリの こえ',
      body: '', ey: 52, my: 68, wy: 74, ex: 16 },
    { id: 'kakuzo', wave: 'square', name: 'カクゾー', color: '#5bb6ff', tip: 'カクゾー: しかくくて ロボットみたいな こえ',
      body: '<rect x="12" y="18" width="76" height="74" rx="8" fill="#5bb6ff"/>', ey: 48, my: 64, wy: 72, ex: 18 },
    { id: 'pyonta', wave: 'triangle', name: 'ピョンタ', color: '#6bd68c', tip: 'ピョンタ: とがった おだやかな こえ',
      body: '<path d="M50 12 L90 88 L10 88 Z" fill="#6bd68c" stroke="#6bd68c" stroke-width="8" stroke-linejoin="round"/>', ey: 58, my: 74, wy: 80, ex: 12 },
  ];
  function starBody(cx, cy, r1, r2, n, fill) {         // ギザっこの、トゲトゲの体
    let d = '';
    for (let i = 0; i < n * 2; i++) {
      const a = Math.PI * i / n - Math.PI / 2, r = i % 2 ? r2 : r1;
      d += (i ? 'L' : 'M') + (cx + r * Math.cos(a)).toFixed(1) + ' ' + (cy + r * Math.sin(a)).toFixed(1);
    }
    return '<path d="' + d + 'Z" fill="' + fill + '" stroke="' + fill + '" stroke-width="4" stroke-linejoin="round"/>';
  }
  CHARS[1].body = starBody(50, 54, 44, 34, 11, '#ffc93c');
  function charSvg(c) {
    return '<svg viewBox="0 0 100 100" aria-hidden="true">' + c.body +
      '<circle cx="' + (50 - c.ex) + '" cy="' + c.ey + '" r="6.5" fill="#fff"/><circle cx="' + (50 + c.ex) + '" cy="' + c.ey + '" r="6.5" fill="#fff"/>' +
      '<circle cx="' + (50 - c.ex) + '" cy="' + (c.ey + 1) + '" r="3" fill="#2b2150"/><circle cx="' + (50 + c.ex) + '" cy="' + (c.ey + 1) + '" r="3" fill="#2b2150"/>' +
      '<ellipse class="mouth" cx="50" cy="' + c.my + '" rx="6" ry="2.6" fill="#7a2b3b"/>' +
      '<g transform="translate(30 ' + c.wy + ')"><path d="' + (c.wavePath || WAVEPATH[c.wave]) + '" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" transform="scale(1 0.9)"/></g>' +
      '</svg>';
  }
  const byId = (id) => CHARS.find((c) => c.id === id) || CHARS[0];
  const cur = () => byId(p.char);

  // ---- 2体をまぜる: 2つの波の「倍音の並び」を、まぜぐあいの分だけ混ぜて、新しい波を作る ----
  // 各波は、サイン波(1倍、2倍、3倍…の音)の足し算。n倍音の強さ:
  const HARM = 48;
  const coef = (wave, n) => {
    if (wave === 'sine') return n === 1 ? 1 : 0;
    if (wave === 'sawtooth') return (n % 2 ? 1 : -1) / n * 2 / Math.PI;
    if (wave === 'square') return n % 2 ? 4 / (Math.PI * n) : 0;
    return n % 2 ? 8 / (Math.PI * Math.PI * n * n) * (((n - 1) / 2) % 2 ? -1 : 1) : 0;   // triangle
  };
  let mixOn = false, mixA = 'furarin', mixB = 'gizako', mixAmt = 0.5, mixSlot = 0;
  const mixCoefs = () => { const a = byId(mixA).wave, b = byId(mixB).wave; return Array.from({ length: HARM }, (_, i) => (1 - mixAmt) * coef(a, i + 1) + mixAmt * coef(b, i + 1)); };
  const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  const mixColor = () => { const a = hex(byId(mixA).color), b = hex(byId(mixB).color); return '#' + a.map((x, i) => Math.round(x * (1 - mixAmt) + b[i] * mixAmt).toString(16).padStart(2, '0')).join(''); };
  // 体の形: 4体の形を、中心から見た「半径」(72方向)にして、まぜぐあいの分だけ、混ぜる
  const SHAPES = (() => {
    const ell = []; for (let i = 0; i < 64; i++) { const a = 2 * Math.PI * i / 64; ell.push([50 + 40 * Math.cos(a), 56 + 35 * Math.sin(a)]); }
    const star = []; for (let i = 0; i < 22; i++) { const a = Math.PI * i / 11 - Math.PI / 2, r = i % 2 ? 34 : 44; star.push([50 + r * Math.cos(a), 54 + r * Math.sin(a)]); }
    return { sine: ell, sawtooth: star, square: [[12, 18], [88, 18], [88, 92], [12, 92]], triangle: [[50, 12], [90, 88], [10, 88]] };
  })();
  const NANG = 72, RAD = {};
  for (const [w, poly] of Object.entries(SHAPES)) {
    RAD[w] = [];
    for (let k = 0; k < NANG; k++) {
      const a = 2 * Math.PI * k / NANG, dx = Math.cos(a), dy = Math.sin(a); let best = 0;
      for (let i = 0; i < poly.length; i++) {
        const P = poly[i], Q = poly[(i + 1) % poly.length], ex = Q[0] - P[0], ey = Q[1] - P[1], den = dx * ey - dy * ex;
        if (Math.abs(den) < 1e-9) continue;
        const t = ((P[0] - 50) * ey - (P[1] - 55) * ex) / den, s = ((P[0] - 50) * dy - (P[1] - 55) * dx) / den;
        if (t > 0 && s >= 0 && s <= 1) best = Math.max(best, t);
      }
      RAD[w].push(best);
    }
  }
  function mixBody(color) {
    const a = byId(mixA).wave, b = byId(mixB).wave; let d = '';
    for (let k = 0; k < NANG; k++) {
      const ang = 2 * Math.PI * k / NANG, r = (1 - mixAmt) * RAD[a][k] + mixAmt * RAD[b][k];
      d += (k ? 'L' : 'M') + (50 + r * Math.cos(ang)).toFixed(1) + ' ' + (55 + r * Math.sin(ang)).toFixed(1);
    }
    return '<path d="' + d + 'Z" fill="' + color + '" stroke="' + color + '" stroke-width="5" stroke-linejoin="round"/>';
  }
  function mixChar() {                                  // まぜた結果の、新しいキャラクター(おなかの線は、まぜた波そのもの。体の形も、2体を まぜた形)
    const co = mixCoefs(); let pts = [], mx = 1e-9;
    for (let i = 0; i <= 40; i++) { let v = 0; co.forEach((c, k) => { v += c * Math.sin(2 * Math.PI * (k + 1) * i / 40); }); pts.push(v); mx = Math.max(mx, Math.abs(v)); }
    const path = pts.map((v, i) => (i ? 'L' : 'M') + i + ' ' + (8 - 7 * v / mx).toFixed(1)).join('');
    const A = byId(mixA), B = byId(mixB), L = (x, y) => (1 - mixAmt) * x + mixAmt * y;
    return { wave: 'sine', wavePath: path, color: mixColor(), ey: L(A.ey, B.ey), my: L(A.my, B.my), wy: L(A.wy, B.wy), ex: L(A.ex, B.ex), body: mixBody(mixColor()) };
  }
  let mixWave = null;
  function setOscWave(osc) {
    if (mixOn) { if (!mixWave && ctx) mixWave = ctx.createPeriodicWave(new Float32Array(HARM + 1), Float32Array.from([0].concat(mixCoefs()))); if (mixWave) osc.setPeriodicWave(mixWave); }
    else osc.type = cur().wave;
  }
  const faceChar = () => mixOn ? mixChar() : cur();

  // ---- 音の経路: 声 → 出口 → [そのまま / やまびこ] → 音量 → スピーカー ----
  let ctx = null, out, dry, wet, delay, fb, master, analyser, dist, cho;
  function fxBlock() {                                    // 1つのエフェクターの箱: そのまま(dry)と、かけた音(wet)を、入り・切りで切り替える
    const b = { in: ctx.createGain(), out: ctx.createGain(), dry: ctx.createGain(), wet: ctx.createGain() };
    b.in.connect(b.dry); b.dry.connect(b.out); b.wet.connect(b.out);
    return b;
  }
  function ensureAudio() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    out = ctx.createGain(); dry = ctx.createGain(); wet = ctx.createGain();
    delay = ctx.createDelay(2); fb = ctx.createGain();
    master = ctx.createGain(); analyser = ctx.createAnalyser(); analyser.fftSize = 2048;
    const comp = ctx.createDynamicsCompressor();
    delay.delayTime.value = 0.32; fb.gain.value = 0.4;
    // エフェクター(ふむ): 声 → ひずみ → コーラス → やまびこ → 音量
    dist = fxBlock(); const ws = ctx.createWaveShaper(), pre = ctx.createGain(), post = ctx.createGain(), curve = new Float32Array(2048);
    for (let i = 0; i < 2048; i++) { const x = i / 1024 - 1; curve[i] = Math.tanh(3 * x); }
    ws.curve = curve; ws.oversample = '2x'; dist.pre = pre; dist.post = post;
    dist.in.connect(pre); pre.connect(ws); ws.connect(post); post.connect(dist.wet);
    cho = fxBlock(); const cd = ctx.createDelay(0.1), lfo = ctx.createOscillator(), lg = ctx.createGain();
    cd.delayTime.value = 0.02; lfo.frequency.value = 0.8; lfo.connect(lg); lg.connect(cd.delayTime); lfo.start();
    cho.in.connect(cd); cd.connect(cho.wet); cho.lfo = lfo; cho.lg = lg;
    out.connect(dist.in); dist.out.connect(cho.in); cho.out.connect(dry); cho.out.connect(delay); delay.connect(fb); fb.connect(delay); delay.connect(wet);
    dry.connect(master); wet.connect(master); master.connect(comp); comp.connect(analyser); analyser.connect(ctx.destination);
    applyGlobal();
  }
  function applyGlobal() {
    table = null;
    if (!ctx) return;
    const t = ctx.currentTime;
    master.gain.setTargetAtTime(p.volume, t, 0.02);
    const ew = p.fx.echo ? p.echo : 0;
    dry.gain.setTargetAtTime(1 - ew * 0.5, t, 0.02); wet.gain.setTargetAtTime(ew, t, 0.02);
    dist.dry.gain.setTargetAtTime(p.fx.dist ? 0 : 1, t, 0.01); dist.wet.gain.setTargetAtTime(p.fx.dist ? 1 : 0, t, 0.01);
    dist.pre.gain.setTargetAtTime(1 + p.distAmt * 20, t, 0.02); dist.post.gain.setTargetAtTime(0.5 / (1 + p.distAmt * 1.5), t, 0.02);
    cho.wet.gain.setTargetAtTime(p.fx.chorus ? 0.7 : 0, t, 0.02); cho.lg.gain.setTargetAtTime(0.001 + p.chAmt * 0.008, t, 0.02); cho.lfo.frequency.setTargetAtTime(0.5 + p.chAmt * 1.5, t, 0.05);
    for (const v of voices.values()) {
      v.filter.frequency.setTargetAtTime(p.cutoff, t, 0.02);
      v.vibGain.gain.setTargetAtTime(p.fx.vib ? p.vib : 0, t, 0.05);
      setOscWave(v.osc); setOscWave(v.osc2); v.osc2.detune.setTargetAtTime(p.detune, t, 0.02);
      const g = mixGains(); v.g1.gain.setTargetAtTime(g[0], t, 0.02); v.g2.gain.setTargetAtTime(g[1], t, 0.02); v.gs.gain.setTargetAtTime(g[2], t, 0.02);
    }
  }
  // 波の形で、音の大きさ(実効値=RMS)がちがう(四角い波は大きく、のこぎり・三角は小さい)。同じ大きさに聞こえるよう、波ごとに、ゲインを決める
  let tableRms = null;
  function waveGain() {
    if (!table) { table = waveTable(); tableRms = null; }
    if (tableRms == null) { let s = 0; for (let i = 0; i < table.length; i++) s += table[i] * table[i]; tableRms = Math.sqrt(s / table.length); }
    return Math.max(0.4, Math.min(2, 0.62 / Math.max(0.1, tableRms)));       // 目標のRMS = 0.62(サイン波の0.707より、少し小さめ)
  }
  const mixGains = () => { const s = 1 + p.osc2 + p.sub, wg = waveGain(); return [wg / s, p.osc2 * wg / s, p.sub / s]; };   // 重ねても、全体の大きさが変わらないように

  // ---- 声(1音) ----
  const voices = new Map();
  // 画面に出す「音の大きさ」: 実際の音と同じ形(アタック→ディケイ→サスティン→余韻)を、時刻から計算する
  const ghosts = [];                                      // 離したあと、消えるまでの声
  const envAt = (tn) => tn < p.attack ? tn / p.attack : p.sustain + (1 - p.sustain) * Math.exp(-(tn - p.attack) / (p.decay / 3));
  function levelOf(v, now) {
    if (v.tOff == null) return envAt((now - v.t0) / 1000);
    const tr = (now - v.tOff) / 1000; return Math.max(0, v.L0 * (1 - tr / v.R));
  }
  const midiToHz = (n) => 440 * Math.pow(2, (n - 69) / 12);
  function noteOn(n) {
    ensureAudio();
    if (voices.has(n)) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator(), filter = ctx.createBiquadFilter(), amp = ctx.createGain();
    const osc2 = ctx.createOscillator(), sub = ctx.createOscillator(), g1 = ctx.createGain(), g2 = ctx.createGain(), gs = ctx.createGain();
    const lfo = ctx.createOscillator(), vibGain = ctx.createGain();   // ゆらゆら(ビブラート): 音の高さを、cent単位で揺らす
    setOscWave(osc); osc.frequency.value = midiToHz(n);
    setOscWave(osc2); osc2.frequency.value = midiToHz(n); osc2.detune.value = p.detune;      // ぶんしん: 少しずらして重ねる
    sub.type = 'sine'; sub.frequency.value = midiToHz(n) / 2;                                // おおきなおにいさん: 1オクターブ下
    const mg = mixGains(); g1.gain.value = mg[0]; g2.gain.value = mg[1]; gs.gain.value = mg[2];
    lfo.frequency.value = 5.5; vibGain.gain.value = p.fx.vib ? p.vib : 0;
    lfo.connect(vibGain); vibGain.connect(osc.detune);
    filter.type = 'lowpass'; filter.frequency.value = p.cutoff; filter.Q.value = 1;
    amp.gain.setValueAtTime(0, t); amp.gain.linearRampToValueAtTime(0.25, t + p.attack);                 // 0 → さいだい(アタック)
    amp.gain.setTargetAtTime(0.25 * p.sustain, t + p.attack, p.decay / 3);                               // → サスティン(ディケイ)
    osc.connect(g1); osc2.connect(g2); sub.connect(gs); g1.connect(filter); g2.connect(filter); gs.connect(filter);
    filter.connect(amp); amp.connect(out);
    osc.start(t); osc2.start(t); sub.start(t); lfo.start(t);
    voices.set(n, { osc, osc2, sub, g1, g2, gs, lfo, vibGain, filter, amp, t0: performance.now(), tOff: null });
    keyEl(n, true); sing(); singerTo(n);
  }
  function noteOff(n) {
    const v = voices.get(n);
    if (!v) return;
    voices.delete(n);
    ghosts.push({ t0: v.t0, tOff: performance.now(), L0: levelOf(v, performance.now()), R: p.release });
    const t = ctx.currentTime;
    v.amp.gain.cancelScheduledValues(t);
    v.amp.gain.setValueAtTime(v.amp.gain.value, t);
    v.amp.gain.linearRampToValueAtTime(0, t + p.release);
    v.osc.stop(t + p.release + 0.05); v.osc2.stop(t + p.release + 0.05); v.sub.stop(t + p.release + 0.05); v.lfo.stop(t + p.release + 0.05);
    keyEl(n, false); sing();
  }
  function sing() {                                      // 鳴っているあいだ、キャラクターが歌う
    document.querySelectorAll('.char.sel, .mixchar, #singer').forEach((el) => el.classList.toggle('sing', voices.size > 0));
  }

  // ---- 鍵盤(8つの大きなキー) ----
  const STEPS = { safe: [0, 2, 4, 7, 9, 12, 14, 16], all: [0, 2, 4, 5, 7, 9, 11, 12] };
  const NAMES = { 0: 'ど', 2: 'れ', 4: 'み', 5: 'ふぁ', 7: 'そ', 9: 'ら', 11: 'し', 12: 'ど', 14: 'れ', 16: 'み' };
  const COLORS = ['#ff6b6b', '#ff9f43', '#ffc93c', '#6bd68c', '#3fc1c9', '#5b8def', '#9b6bff', '#ff6bb5'];
  const KEYCODES = 'asdfghjk';
  let notes = [];
  function buildKeys() {
    for (const n of [...voices.keys()]) noteOff(n); arpHeld.clear();
    const box = $('keys'); box.innerHTML = ''; notes = [];
    STEPS[mode].forEach((s, i) => {
      const n = base + s; notes.push(n);
      const k = document.createElement('div');
      k.className = 'key'; k.dataset.note = n; k.style.background = COLORS[i];
      k.textContent = NAMES[s];
      box.appendChild(k);
    });
    if (typeof singerTo === 'function' && $('singer')) singerTo(notes[0]);
  }
  function keyEl(n, on, cls) { const k = document.querySelector('.key[data-note="' + n + '"]'); if (k) k.classList.toggle(cls || 'on', on); }
  // ---- ロボット(アルペジエーター): おさえた おとを、じゅんばんに ひとつずつ ならす ----
  let arpOn = false, arpHeld = new Set(), arpIdx = 0, arpTimer = null, arpBpm = 120;
  // ロボットのときは、キーを タッチするたびに「えらぶ ⇔ はずす」。ゆびを はなしても、えらんだ おとは そのまま くりかえす
  const press = (n, slide) => {
    if (!arpOn) { noteOn(n); return; }
    if (arpHeld.has(n)) { if (!slide) { arpHeld.delete(n); keyEl(n, false, 'held'); } }
    else { arpHeld.add(n); keyEl(n, true, 'held'); }
  };
  const release = (n) => { if (!arpOn) noteOff(n); };
  function arpStep() {
    const list = [...arpHeld].sort((a, b) => a - b);
    if (!list.length) { robotTo(null); return; }
    const seq = list.length < 3 ? list : list.concat(list.slice(1, -1).reverse());    // のぼって、くだる
    const n = seq[arpIdx % seq.length]; arpIdx++;
    const dur = 60 / arpBpm / 2;                                                       // 8ぶおんぷ
    noteOn(n); robotTo(n); setTimeout(() => noteOff(n), dur * 800);
  }
  function arpSet(on) {
    arpOn = on; clearInterval(arpTimer); arpTimer = null; arpIdx = 0;
    for (const n of [...voices.keys()]) noteOff(n);
    arpHeld.forEach((n) => keyEl(n, false, 'held')); arpHeld.clear();
    $('arpBtn').textContent = on ? '🤖 じぶんで' : '🤖 ロボット';
    $('arpSpeedRow').hidden = !on; $('arpTip').hidden = !on; $('robot').hidden = !on;
    $('keywrap').classList.toggle('arp', on);
    if (on) {                                                                            // はじめから、ド・ミ・ソを えらんでおく(おすと すぐ うごきだす)
      ensureAudio();
      (mode === 'safe' ? [0, 2, 3] : [0, 2, 4]).forEach((i) => { if (notes[i]) { arpHeld.add(notes[i]); keyEl(notes[i], true, 'held'); } });
      arpTimer = setInterval(arpStep, 60000 / arpBpm / 2);
    }
  }
  $('arpClear').onclick = () => { arpHeld.forEach((n) => keyEl(n, false, 'held')); arpHeld.clear(); arpIdx = 0; };
  function robotTo(n) {                                                                  // ロボットを、ならしている キーの うえへ
    const r = $('robot');
    if (n == null) { r.classList.remove('hop'); return; }
    const k = document.querySelector('.key[data-note="' + n + '"]'); if (!k) return;
    r.style.left = (k.offsetLeft + k.offsetWidth / 2 - r.offsetWidth / 2) + 'px';
    r.classList.remove('hop'); void r.offsetWidth; r.classList.add('hop');
  }
  $('arpBtn').onclick = () => arpSet(!arpOn);
  $('arpSpeed').oninput = () => { arpBpm = 60 + Math.round($('arpSpeed').value / 1000 * 180); $('arpSpeedOut').textContent = arpBpm; if (arpOn) { clearInterval(arpTimer); arpTimer = setInterval(arpStep, 60000 / arpBpm / 2); } };
  const pointerNote = new Map();
  $('keys').addEventListener('pointerdown', (e) => {
    const k = e.target.closest('.key'); if (!k) return;
    e.preventDefault(); $('keys').setPointerCapture(e.pointerId);
    pointerNote.set(e.pointerId, +k.dataset.note); press(+k.dataset.note);
  });
  $('keys').addEventListener('pointermove', (e) => {    // 指をすべらせて、ならせる
    if (!pointerNote.has(e.pointerId)) return;
    const el = document.elementFromPoint(e.clientX, e.clientY), k = el && el.closest('.key'); if (!k) return;
    const n = +k.dataset.note, old = pointerNote.get(e.pointerId);
    if (n !== old) { release(old); pointerNote.set(e.pointerId, n); press(n, true); }
  });
  const up = (e) => { if (pointerNote.has(e.pointerId)) { release(pointerNote.get(e.pointerId)); pointerNote.delete(e.pointerId); } };
  $('keys').addEventListener('pointerup', up); $('keys').addEventListener('pointercancel', up);
  const held = new Map();
  window.addEventListener('keydown', (e) => {
    if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
    const i = KEYCODES.indexOf(e.key.toLowerCase()); if (i < 0 || !notes[i]) return;
    held.set(e.key.toLowerCase(), notes[i]); press(notes[i]);
  });
  window.addEventListener('keyup', (e) => { const k = e.key.toLowerCase(); if (held.has(k)) { release(held.get(k)); held.delete(k); } });
  window.addEventListener('blur', () => { for (const n of [...voices.keys()]) noteOff(n); held.clear(); arpHeld.clear(); document.querySelectorAll('.key.held').forEach((k) => k.classList.remove('held')); });
  const octave = (d) => { base = Math.min(72, Math.max(36, base + d)); buildKeys(); };
  $('low').onclick = () => octave(-12); $('high').onclick = () => octave(12);
  // きらきら = ド・レ・ミ・ソ・ラ(5つ。メジャーペンタトニック)。ドレミ = ドレミファソラシド(7つ。メジャースケール)
  function setMode(m) {
    mode = m;
    $('modeBtn').textContent = m === 'safe' ? '🎹 ドレミに' : '🌟 きらきらに';
    $('modeNow').textContent = m === 'safe' ? 'いまは 🌟きらきら(どれを ひいても きれい)' : 'いまは 🎹ドレミ(ぜんぶの おと)';
    buildKeys();
  }
  $('modeBtn').onclick = () => setMode(mode === 'safe' ? 'all' : 'safe');

  // ---- キャラクターを選ぶ ----
  function buildChars() {
    const box = $('chars'); box.innerHTML = '';
    for (const c of CHARS) {
      const b = document.createElement('button'); b.type = 'button';
      const isA = mixOn && c.id === mixA, isB = mixOn && c.id === mixB;
      b.className = 'char' + (!mixOn && c.id === p.char || isA || isB ? ' sel' : '') + (isA ? ' selA' : '') + (isB && !isA ? ' selB' : ''); b.setAttribute('aria-label', c.name);
      b.innerHTML = charSvg(c) + '<div>' + c.name + '</div>';
      b.onclick = () => {
        if (mixOn) { if (mixSlot === 0) mixA = c.id; else mixB = c.id; mixSlot = 1 - mixSlot; mixWave = null; }
        else p.char = c.id;
        buildChars(); applyGlobal(); ensureAudio(); noteOn(notes[0]); setTimeout(() => noteOff(notes[0]), 250);
      };
      box.appendChild(b);
    }
    $('charTip').textContent = mixOn ? 'キャラを 2たい タッチ。①と②に なるよ(3たいめからは、①から やりなおし)' : cur().tip;
    buildMix(); buildFace(); if ($('gum').firstChild) buildGum(); if ($('singer')) buildSinger();
  }
  // ---- まぜる画面 ----
  function buildMix() {
    $('mixPanel').hidden = !mixOn; $('mixBtn').classList.toggle('sel', mixOn);
    $('mixBtn').textContent = mixOn ? '☝ ひとりに もどす' : '🧪 がったい!';
    if (!mixOn) return;
    const item = (c) => charSvg(c) + '<div>' + (c.name || 'がったい') + '</div>';
    $('mixA').innerHTML = item(byId(mixA)); $('mixB').innerHTML = item(byId(mixB));
    $('mixOut').innerHTML = item(Object.assign(mixChar(), { name: 'がったい' }));
    $('mixAmt').value = Math.round(mixAmt * 1000);
  }
  const preview = () => { ensureAudio(); noteOn(notes[0]); setTimeout(() => noteOff(notes[0]), 300); };
  $('mixOut').onclick = preview;
  $('mixOut').addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); preview(); } });
  $('mixBtn').onclick = () => { mixOn = !mixOn; mixSlot = 0; mixWave = null; buildChars(); applyGlobal(); };
  $('mixAmt').oninput = () => { mixAmt = $('mixAmt').value / 1000; mixWave = null; buildMix(); buildFace(); applyGlobal(); };
  // ---- おくち: ドラッグで あかるさ(フィルター)を動かす。口が大きく開くほど、明るい ----
  function updateMouth() {
    const m = $('face').querySelector('.mouth'); if (m) m.style.transform = 'scaleY(' + (1 + 3.5 * toS('cutoff', p.cutoff)).toFixed(2) + ')';
  }
  function buildFace() { $('face').innerHTML = charSvg(faceChar()); updateMouth(); }
  const faceMove = (e) => {
    const r = $('face').getBoundingClientRect(), s = Math.max(0, Math.min(1, 1 - (e.clientY - r.top) / r.height));
    p.cutoff = fromS('cutoff', s); syncSliders(); applyGlobal();
  };
  $('face').addEventListener('pointerdown', (e) => { e.preventDefault(); $('face').setPointerCapture(e.pointerId); $('face').dragging = true; faceMove(e); });
  $('face').addEventListener('pointermove', (e) => { if ($('face').dragging) faceMove(e); });
  const faceUp = () => { $('face').dragging = false; };
  $('face').addEventListener('pointerup', faceUp); $('face').addEventListener('pointercancel', faceUp);

  // ---- つまみ(0〜1000のスライダー。対数にするものは、耳の感じ方に合わせる) ----
  const MAP = {
    volume: { lin: [0, 1] }, cutoff: { log: [300, 12000] }, echo: { lin: [0, 0.7] }, vib: { lin: [0, 80] }, distAmt: { lin: [0, 1] }, chAmt: { lin: [0, 1] }, osc2: { lin: [0, 1] }, detune: { lin: [0, 40] }, sub: { lin: [0, 1] },
  };
  const toS = (k, v) => { const m = MAP[k]; if (m.log) return Math.log(v / m.log[0]) / Math.log(m.log[1] / m.log[0]); return (v - m.lin[0]) / (m.lin[1] - m.lin[0]); };
  const fromS = (k, s) => { const m = MAP[k]; if (m.log) return m.log[0] * Math.pow(m.log[1] / m.log[0], s); return m.lin[0] + s * (m.lin[1] - m.lin[0]); };
  function syncSliders() { for (const k of Object.keys(MAP)) $(k).value = Math.round(toS(k, p[k]) * 1000); updateMouth(); }
  for (const k of Object.keys(MAP)) $(k).oninput = () => { p[k] = fromS(k, $(k).value / 1000); updateMouth(); applyGlobal(); };
  $('reset').onclick = () => { Object.assign(p, DEFAULTS); p.fx = { dist: false, chorus: false, vib: false, echo: false }; mixOn = false; setMode('safe'); syncSliders(); syncPedals(); buildChars(); applyGlobal(); };

  // ---- 波の表示(虹色)と、波の上で歌うキャラクター ----
  const FLAT = new Uint8Array(2048).fill(128);
  function scopeFrame() {
    const c = $('scope'), g = c.getContext('2d'), dpr = devicePixelRatio || 1, W = c.clientWidth, H = c.clientHeight;
    if (c.width !== W * dpr || c.height !== H * dpr) { c.width = W * dpr; c.height = H * dpr; }
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    let buf = FLAT; if (analyser) { buf = new Uint8Array(analyser.fftSize); analyser.getByteTimeDomainData(buf); }
    const grad = g.createLinearGradient(0, 0, W, 0);
    ['#ff6b6b', '#ffc93c', '#6bd68c', '#5b8def', '#ff6bb5'].forEach((col, i) => grad.addColorStop(i / 4, col));
    g.strokeStyle = grad; g.lineWidth = 4; g.lineJoin = 'round'; g.beginPath();
    let start = 0;
    for (let i = 1; i < buf.length / 2; i++) if (buf[i - 1] < 128 && buf[i] >= 128) { start = i; break; }
    const n = buf.length / 2, ys = [];
    for (let i = 0; i < n; i++) { const x = i / (n - 1) * W, y = (1 - buf[start + i] / 255) * H; ys.push(y); i ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.stroke();
    // キャラクターは、波の真ん中の上に立って、波の高さに合わせて上下し、音の大きさに合わせて口を開けて、ふくらむ
    let pk = 0; for (let i = 0; i < buf.length; i += 4) pk = Math.max(pk, Math.abs(buf[i] - 128));
    const level = Math.min(1, pk / 70), el = $('singer');
    el.style.transform = 'scale(' + (1 + 0.25 * level).toFixed(3) + ')';
    const m = el.querySelector('.mouth'); if (m) m.style.transform = 'scaleY(' + (1 + 3 * level).toFixed(2) + ')';
  }
  function buildSinger() { $('singer').innerHTML = charSvg(faceChar()); }
  function singerTo(n) {                                   // キャラクターは、いちばん さいごに ならした キーの うえで うたう
    const k = document.querySelector('.key[data-note="' + n + '"]'), s = $('singer'); if (!k) return;
    s.style.left = (k.offsetLeft + k.offsetWidth / 2 - s.offsetWidth / 2) + 'px';
  }

  // ---- 「おとの おおきさ」のコース(ジェットコースター)と、ガムの顔 ----
  // 3つの点をドラッグして、山の形を変える: ●① 立ち上がり(横) ●② 減っていく時間(横)と、押している間の大きさ(縦) ●③ 消えるまでの時間(横)
  const CO = { pad: 16, wA: 0.22, wD: 0.28, wH: 0.16, wR: 0.28, tA: 1, tD: 2, tR: 2 };   // 各区間の幅の割合、時間の最大(秒)
  const frac = (t, tmax) => Math.sqrt(Math.max(0, Math.min(1, t / tmax)));               // 時間は、短いほうを細かく動かせるように、平方根で配置
  function coGeom() {
    const c = $('coaster'), W = c.clientWidth, H = c.clientHeight, pad = CO.pad, av = W - 2 * pad;
    const wA = av * CO.wA, wD = av * CO.wD, wH = av * CO.wH, wR = av * CO.wR;
    const x1 = pad + wA * frac(p.attack, CO.tA), x2 = x1 + wD * frac(p.decay, CO.tD), xh = x2 + wH, x3 = xh + wR * frac(p.release, CO.tR);
    const yTop = pad, yBot = H - pad, yS = yTop + (1 - p.sustain) * (yBot - yTop);
    return { W, H, pad, wA, wD, wH, wR, x0: pad, x1, x2, xh, x3, yTop, yBot, yS };
  }
  function drawCoaster() {
    const c = $('coaster'), g = c.getContext('2d'), dpr = devicePixelRatio || 1, G = coGeom();
    if (c.width !== G.W * dpr || c.height !== G.H * dpr) { c.width = G.W * dpr; c.height = G.H * dpr; }
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, G.W, G.H);
    g.beginPath(); g.moveTo(G.x0, G.yBot); g.lineTo(G.x1, G.yTop); g.lineTo(G.x2, G.yS); g.lineTo(G.xh, G.yS); g.lineTo(G.x3, G.yBot); g.closePath();
    g.fillStyle = 'rgba(255,122,61,.18)'; g.fill();
    g.strokeStyle = '#ff7a3d'; g.lineWidth = 5; g.lineJoin = 'round'; g.lineCap = 'round'; g.stroke();
    [[G.x1, G.yTop, '①'], [G.x2, G.yS, '②'], [G.x3, G.yBot, '③']].forEach(([x, y, t]) => {
      g.beginPath(); g.arc(x, y, 12, 0, 7); g.fillStyle = '#fff'; g.fill(); g.strokeStyle = '#ff7a3d'; g.lineWidth = 3; g.stroke();
      g.fillStyle = '#7a4b00'; g.font = 'bold 13px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t, x, y + 1);
    });
  }
  let drag = null;
  $('coaster').addEventListener('pointerdown', (e) => {
    const r = $('coaster').getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top, G = coGeom();
    const pts = [['A', G.x1, G.yTop], ['D', G.x2, G.yS], ['R', G.x3, G.yBot]];
    let best = null, bd = 1e9;
    for (const [k, x, y] of pts) { const d = Math.hypot(px - x, py - y); if (d < bd) { bd = d; best = k; } }
    if (bd > 34) return;
    e.preventDefault(); drag = best; $('coaster').setPointerCapture(e.pointerId); coMove(e);
  });
  function coMove(e) {
    if (!drag) return;
    const r = $('coaster').getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top, G = coGeom(), cl = (x) => Math.max(0, Math.min(1, x));
    if (drag === 'A') p.attack = Math.max(0.005, CO.tA * Math.pow(cl((px - G.x0) / G.wA), 2));
    else if (drag === 'D') { p.decay = Math.max(0.03, CO.tD * Math.pow(cl((px - G.x1) / G.wD), 2)); p.sustain = cl(1 - (py - G.yTop) / (G.yBot - G.yTop)); }
    else p.release = Math.max(0.03, CO.tR * Math.pow(cl((px - G.xh) / G.wR), 2));
  }
  $('coaster').addEventListener('pointermove', coMove);
  const coUp = () => { drag = null; };
  $('coaster').addEventListener('pointerup', coUp); $('coaster').addEventListener('pointercancel', coUp);
  // ガムをふくらませる顔: ふくらみ = いまの音の大きさ
  function buildGum() {
    $('gum').innerHTML = '<svg viewBox="0 0 140 100" aria-hidden="true"><circle id="gumBubble" cx="60" cy="64" r="3" fill="#ff9ec7" stroke="#e0689d" stroke-width="2.5"/><circle id="gumShine" cx="58" cy="62" r="1" fill="#fff" opacity=".7"/>' +
      '<circle cx="34" cy="60" r="28" id="gumHead" fill="' + cur().color + '"/>' +
      '<ellipse id="gumEyeL" cx="26" cy="52" rx="4.5" ry="4" fill="#2b2150"/><ellipse id="gumEyeR" cx="44" cy="52" rx="4.5" ry="4" fill="#2b2150"/>' +
      '<ellipse cx="57" cy="66" rx="3.4" ry="3" fill="#7a2b3b"/></svg>';
  }
  function updateGum() {
    const now = performance.now();
    for (let i = ghosts.length - 1; i >= 0; i--) if ((now - ghosts[i].tOff) / 1000 > ghosts[i].R) ghosts.splice(i, 1);
    let lv = 0;
    for (const v of voices.values()) lv = Math.max(lv, levelOf(v, now));
    for (const v of ghosts) lv = Math.max(lv, levelOf(v, now));
    const r = 3 + 34 * Math.pow(Math.min(1, lv), 0.8), b = $('gumBubble'); if (!b) return;
    b.setAttribute('r', r.toFixed(1)); b.setAttribute('cx', (58 + 0.85 * r).toFixed(1)); b.setAttribute('cy', (66 - 0.25 * r).toFixed(1));
    const s = $('gumShine'); s.setAttribute('r', (r * 0.18).toFixed(1)); s.setAttribute('cx', (58 + 0.85 * r - r * 0.4).toFixed(1)); s.setAttribute('cy', (66 - 0.25 * r - r * 0.45).toFixed(1));
    const ry = (4 - 2.8 * Math.min(1, lv)).toFixed(2); $('gumEyeL').setAttribute('ry', ry); $('gumEyeR').setAttribute('ry', ry);
  }
  // ---- 「ぶんしん」の見える化: 本体の波・ぶんしんの波・かさねた波(ゆっくり動かして、ずれの「うなり」を見せる) ----
  let table = null;                                       // 1周ぶんの波の形(あらかじめ計算)
  function waveTable() {
    const co = mixOn ? mixCoefs() : Array.from({ length: HARM }, (_, i) => coef(cur().wave, i + 1)), N = 256, t = new Float32Array(N); let mx = 1e-9;
    for (let i = 0; i < N; i++) { let v = 0; for (let k = 0; k < co.length; k++) if (co[k]) v += co[k] * Math.sin(2 * Math.PI * (k + 1) * i / N); t[i] = v; mx = Math.max(mx, Math.abs(v)); }
    for (let i = 0; i < N; i++) t[i] /= mx;
    return t;
  }
  const wv = (tb, x) => { const N = tb.length, f = ((x % 1) + 1) % 1 * N, i = Math.floor(f), a = f - i; return tb[i % N] * (1 - a) + tb[(i + 1) % N] * a; };
  function drawBeat() {
    const c = $('beat'), g = c.getContext('2d'), dpr = devicePixelRatio || 1, W = c.clientWidth, H = c.clientHeight;
    if (c.width !== W * dpr || c.height !== H * dpr) { c.width = W * dpr; c.height = H * dpr; }
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    if (!table) table = waveTable();
    const now = performance.now() / 1000, drift = now * p.detune * 0.05, rows = 3, rh = H / rows, cyc = 3;
    const names = ['もとの こえ', 'ぶんしん(すこし ずれる)', 'かさねた こえ'];
    for (let r = 0; r < rows; r++) {
      const cy = rh * (r + 0.5), amp = rh * 0.36;
      g.strokeStyle = 'rgba(122,75,0,.15)'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, cy); g.lineTo(W, cy); g.stroke();
      g.strokeStyle = ['#5b8def', '#ff6bb5', '#ff7a3d'][r]; g.lineWidth = r === 2 ? 4 : 3; g.lineJoin = 'round'; g.beginPath();
      for (let x = 0; x <= W; x += 2) {
        const ph = x / W * cyc, a = wv(table, ph), b = wv(table, ph + drift) * (p.osc2 || 0);
        const v = r === 0 ? a : r === 1 ? wv(table, ph + drift) : (a + b) / (1 + (p.osc2 || 0));
        const y = cy - v * amp; x ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      g.globalAlpha = r === 1 && p.osc2 < 0.02 ? 0.35 : 1; g.stroke(); g.globalAlpha = 1;
      g.fillStyle = '#8a6a3a'; g.font = '11px sans-serif'; g.textAlign = 'left'; g.textBaseline = 'top'; g.fillText(names[r], 4, rh * r + 2);
    }
  }
  // ---- エフェクター(ふむ): ボタンを押すたびに、入り・切りが かわる ----
  function syncPedals() {
    document.querySelectorAll('.pedal').forEach((el) => {
      const on = !!p.fx[el.dataset.fx];
      el.classList.toggle('on', on); el.querySelector('.stomp').setAttribute('aria-pressed', on);
    });
  }
  document.querySelectorAll('.pedal').forEach((el) => {
    el.querySelector('.stomp').onclick = () => { p.fx[el.dataset.fx] = !p.fx[el.dataset.fx]; ensureAudio(); syncPedals(); applyGlobal(); };
    el.querySelector('.gear').onclick = () => { const k = el.querySelector('.pk'); k.hidden = !k.hidden; };
  });
  (function anim() { drawCoaster(); updateGum(); drawBeat(); scopeFrame(); requestAnimationFrame(anim); })();
  setMode('safe'); buildChars(); syncSliders(); syncPedals(); buildKeys(); buildGum(); buildSinger();
})();
