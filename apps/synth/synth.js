// シンセ(Web Audio API だけで作った、和音の弾ける小さなシンセサイザー)
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);

  const DEFAULTS = { wave: 'sawtooth', volume: 0.5, fmRatio: 2, fmDepth: 0, cutoff: 2400, q: 4, attack: 0.01, release: 0.4, delayTime: 0.35, feedback: 0.35, mix: 0.25 };
  const KNOBS = [
    ['volume', '音量', 0, 1, 0.01, (v) => Math.round(v * 100) + '%'],
    ['cutoff', 'フィルター(明るさ)', 80, 12000, 1, (v) => Math.round(v) + 'Hz', true],
    ['q', 'フィルターのクセ', 0.1, 25, 0.1, (v) => v.toFixed(1)],
    ['fmDepth', 'FMの深さ', 0, 2000, 1, (v) => Math.round(v)],
    ['fmRatio', 'FMの比率', 0.5, 8, 0.5, (v) => '×' + v],
    ['attack', '立ち上がり', 0.001, 2, 0.001, (v) => v.toFixed(2) + '秒', true],
    ['release', '余韻', 0.01, 4, 0.01, (v) => v.toFixed(2) + '秒', true],
    ['delayTime', 'エコーの間隔', 0.05, 1.2, 0.01, (v) => v.toFixed(2) + '秒'],
    ['feedback', 'エコーのくり返し', 0, 0.9, 0.01, (v) => Math.round(v * 100) + '%'],
    ['mix', 'エコーの量', 0, 1, 0.01, (v) => Math.round(v * 100) + '%'],
  ];
  const WAVES = [['sine', 'なめらか(sine)'], ['triangle', '三角(triangle)'], ['sawtooth', 'のこぎり(sawtooth)'], ['square', '四角(square)']];
  const p = Object.assign({}, DEFAULTS);

  // ---- 音の経路: 声(複数) → 出口 → [そのまま / エコー] → 音量 → スピーカー ----
  let ctx = null, out, dry, wet, delay, fb, master, analyser;
  function ensureAudio() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    out = ctx.createGain();
    dry = ctx.createGain(); wet = ctx.createGain();
    delay = ctx.createDelay(2); fb = ctx.createGain();
    master = ctx.createGain(); analyser = ctx.createAnalyser(); analyser.fftSize = 2048;
    const comp = ctx.createDynamicsCompressor();       // 和音で音が割れないように
    out.connect(dry); out.connect(delay);
    delay.connect(fb); fb.connect(delay); delay.connect(wet);
    dry.connect(master); wet.connect(master);
    master.connect(comp); comp.connect(analyser); analyser.connect(ctx.destination);
    applyGlobal();
    drawScope();
  }
  function applyGlobal() {
    if (!ctx) return;
    const t = ctx.currentTime;
    master.gain.setTargetAtTime(p.volume, t, 0.02);
    delay.delayTime.setTargetAtTime(p.delayTime, t, 0.05);
    fb.gain.setTargetAtTime(p.feedback, t, 0.02);
    dry.gain.setTargetAtTime(1 - p.mix * 0.5, t, 0.02);
    wet.gain.setTargetAtTime(p.mix, t, 0.02);
    for (const v of voices.values()) {
      v.filter.frequency.setTargetAtTime(p.cutoff, t, 0.02);
      v.filter.Q.setTargetAtTime(p.q, t, 0.02);
      v.modGain.gain.setTargetAtTime(p.fmDepth, t, 0.02);
      v.mod.frequency.setTargetAtTime(v.freq * p.fmRatio, t, 0.02);
      v.osc.type = p.wave;
    }
  }

  // ---- 声(1音) ----
  const voices = new Map();
  const midiToHz = (n) => 440 * Math.pow(2, (n - 69) / 12);
  function noteOn(n) {
    ensureAudio();
    if (voices.has(n)) return;
    const t = ctx.currentTime, freq = midiToHz(n);
    const osc = ctx.createOscillator(), mod = ctx.createOscillator(), modGain = ctx.createGain();
    const filter = ctx.createBiquadFilter(), amp = ctx.createGain();
    osc.type = p.wave; osc.frequency.value = freq;
    mod.frequency.value = freq * p.fmRatio; modGain.gain.value = p.fmDepth;
    mod.connect(modGain); modGain.connect(osc.frequency);
    filter.type = 'lowpass'; filter.frequency.value = p.cutoff; filter.Q.value = p.q;
    amp.gain.setValueAtTime(0, t);
    amp.gain.linearRampToValueAtTime(0.25, t + p.attack);
    osc.connect(filter); filter.connect(amp); amp.connect(out);
    osc.start(t); mod.start(t);
    voices.set(n, { osc, mod, modGain, filter, amp, freq });
    keyEl(n, true);
  }
  function noteOff(n) {
    const v = voices.get(n);
    if (!v) return;
    voices.delete(n);
    const t = ctx.currentTime;
    v.amp.gain.cancelScheduledValues(t);
    v.amp.gain.setValueAtTime(v.amp.gain.value, t);
    v.amp.gain.linearRampToValueAtTime(0, t + p.release);
    v.osc.stop(t + p.release + 0.05); v.mod.stop(t + p.release + 0.05);
    keyEl(n, false);
  }

  // ---- 鍵盤(2オクターブ) ----
  let base = 48; // C3
  const PC = 'zsxdcvgbhnjmq2w3er5t6y7u'; // 低い方から24音
  const WHITE = [0, 2, 4, 5, 7, 9, 11];
  function buildKeys() {
    const box = $('keys'); box.innerHTML = '';
    const whiteW = 100 / 14;
    let wi = 0;
    for (let i = 0; i < 24; i++) {
      const n = base + i, pc = i % 12, isWhite = WHITE.includes(pc);
      const k = document.createElement('div');
      k.className = 'key ' + (isWhite ? 'white' : 'black');
      k.dataset.note = n;
      if (isWhite) { k.style.left = (wi * whiteW) + '%'; k.style.width = whiteW + '%'; wi++; }
      else { k.style.left = (wi * whiteW - whiteW * 0.3) + '%'; k.style.width = (whiteW * 0.6) + '%'; }
      k.innerHTML = '<span>' + PC[i].toUpperCase() + '</span>';
      box.appendChild(k);
    }
    $('octlabel').textContent = 'いちばん左: C' + (base / 12 - 1);
  }
  function keyEl(n, on) {
    const k = document.querySelector('.key[data-note="' + n + '"]');
    if (k) k.classList.toggle('on', on);
  }
  const pointerNote = new Map();
  $('keys').addEventListener('pointerdown', (e) => {
    const k = e.target.closest('.key'); if (!k) return;
    e.preventDefault();
    $('keys').setPointerCapture(e.pointerId);
    pointerNote.set(e.pointerId, +k.dataset.note); noteOn(+k.dataset.note);
  });
  $('keys').addEventListener('pointermove', (e) => {   // 指をすべらせて弾ける
    if (!pointerNote.has(e.pointerId)) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const k = el && el.closest('.key'); if (!k) return;
    const n = +k.dataset.note, old = pointerNote.get(e.pointerId);
    if (n !== old) { noteOff(old); pointerNote.set(e.pointerId, n); noteOn(n); }
  });
  const up = (e) => { if (pointerNote.has(e.pointerId)) { noteOff(pointerNote.get(e.pointerId)); pointerNote.delete(e.pointerId); } };
  $('keys').addEventListener('pointerup', up);
  $('keys').addEventListener('pointercancel', up);

  const held = new Map();
  window.addEventListener('keydown', (e) => {
    if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target.tagName === 'INPUT' && e.target.type !== 'range' && e.target.type !== 'radio') return;
    const i = PC.indexOf(e.key.toLowerCase()); if (i < 0) return;
    held.set(e.key.toLowerCase(), base + i); noteOn(base + i);
  });
  window.addEventListener('keyup', (e) => {
    const k = e.key.toLowerCase();
    if (held.has(k)) { noteOff(held.get(k)); held.delete(k); }
  });
  window.addEventListener('blur', () => { for (const n of [...voices.keys()]) noteOff(n); held.clear(); });
  const shift = (d) => { for (const n of [...voices.keys()]) noteOff(n); base = Math.min(84, Math.max(24, base + d)); buildKeys(); };
  $('octdown').onclick = () => shift(-12);
  $('octup').onclick = () => shift(12);

  // ---- つまみ ----
  // 周波数・時間は、耳の感じ方に合わせて対数のつまみにする
  const toSlider = (v, min, max, log) => log ? Math.log(v / min) / Math.log(max / min) : (v - min) / (max - min);
  const fromSlider = (s, min, max, log) => log ? min * Math.pow(max / min, s) : min + s * (max - min);
  function buildControls() {
    $('waves').innerHTML = '';
    for (const [w, label] of WAVES) {
      const l = document.createElement('label');
      l.innerHTML = '<input type="radio" name="wave" value="' + w + '"> ' + label;
      const r = l.querySelector('input'); r.checked = p.wave === w;
      r.onchange = () => { p.wave = w; applyGlobal(); };
      $('waves').appendChild(l);
    }
    $('knobs').innerHTML = '';
    for (const [key, label, min, max, step, fmt, log] of KNOBS) {
      const l = document.createElement('label');
      l.textContent = label;
      const o = document.createElement('output');
      const r = document.createElement('input');
      r.type = 'range'; r.min = 0; r.max = 1000; r.step = 1;
      r.value = Math.round(toSlider(p[key], min, max, log) * 1000);
      const show = () => { o.textContent = fmt(p[key]); };
      r.oninput = () => {
        let v = fromSlider(r.value / 1000, min, max, log);
        if (!log) v = Math.round(v / step) * step;
        p[key] = v; show(); applyGlobal();
      };
      show();
      l.appendChild(o); l.appendChild(r);
      $('knobs').appendChild(l);
    }
  }
  $('reset').onclick = () => { Object.assign(p, DEFAULTS); buildControls(); applyGlobal(); };

  // ---- 波形の表示 ----
  function drawScope() {
    const c = $('scope'), g = c.getContext('2d'), buf = new Uint8Array(analyser.fftSize);
    const color = () => getComputedStyle(document.documentElement).getPropertyValue('--fg').trim() || '#111';
    (function frame() {
      c.width = c.clientWidth * devicePixelRatio; c.height = c.clientHeight * devicePixelRatio;
      analyser.getByteTimeDomainData(buf);
      g.clearRect(0, 0, c.width, c.height);
      g.strokeStyle = color(); g.lineWidth = 1.5 * devicePixelRatio; g.beginPath();
      let start = 0;                                     // 波の頭をそろえて、止まって見えるようにする
      for (let i = 1; i < buf.length / 2; i++) if (buf[i - 1] < 128 && buf[i] >= 128) { start = i; break; }
      const n = buf.length / 2;
      for (let i = 0; i < n; i++) {
        const x = i / (n - 1) * c.width, y = (1 - buf[start + i] / 255) * c.height;
        i ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      g.stroke();
      requestAnimationFrame(frame);
    })();
  }

  buildKeys();
  buildControls();
})();
