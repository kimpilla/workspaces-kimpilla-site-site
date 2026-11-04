// シンセ(Web Audio API だけで作った、和音の弾ける小さなシンセサイザー)
// 宇宙船シンセ(いまのシンセと同じ音の仕組みで、見た目だけを宇宙船の操作盤にした別ページ)
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);

  const DEFAULTS = { wave: 'sawtooth', volume: 0.5, fmRatio: 2, fmDepth: 0, cutoff: 2400, q: 4, attack: 0.01, decay: 1, sustain: 1, fEnv: 0, fDecay: 0.4, wave2: 'sawtooth', osc2: 0, detune: 12, sub: 0, release: 0.4, delayTime: 0.35, feedback: 0.35, mix: 0.25 };
  const KNOBS = [
    ['volume', '音量', 0, 1, 0.01, (v) => Math.round(v * 100) + '%'],
    ['cutoff', 'フィルター(明るさ)', 80, 12000, 1, (v) => Math.round(v) + 'Hz', true],
    ['q', 'フィルターのクセ', 0.1, 25, 0.1, (v) => v.toFixed(1)],
    ['fmDepth', 'FMの深さ', 0, 2000, 1, (v) => Math.round(v)],
    ['fmRatio', 'FMの比率', 0.5, 8, 0.5, (v) => '×' + v],
    ['attack', '立ち上がり', 0.001, 2, 0.001, (v) => v.toFixed(2) + '秒', true],
    ['decay', 'ディケイ(減っていく時間)', 0.01, 3, 0.01, (v) => v.toFixed(2) + '秒', true],
    ['sustain', 'サスティン(押している間の大きさ)', 0, 1, 0.01, (v) => Math.round(v * 100) + '%'],
    ['fEnv', 'フィルターの開き(押した瞬間)', 0, 6, 0.1, (v) => v < 0.05 ? 'なし' : '+' + v.toFixed(1) + '段'],
    ['fDecay', 'フィルターが閉じる時間', 0.02, 3, 0.01, (v) => v.toFixed(2) + '秒', true],
    ['osc2', 'オシレーター2の量', 0, 1, 0.01, (v) => v < 0.02 ? 'なし' : Math.round(v * 100) + '%'],
    ['detune', 'オシレーター2のずらし(デチューン)', 0, 50, 0.5, (v) => v.toFixed(1) + 'セント'],
    ['sub', 'サブ(1オクターブ下の音)', 0, 1, 0.01, (v) => v < 0.02 ? 'なし' : Math.round(v * 100) + '%'],
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
      v.osc.type = p.wave; v.osc2.type = p.wave2; v.osc2.detune.setTargetAtTime(p.detune, t, 0.02);
      const g = mixGains(); v.g1.gain.setTargetAtTime(g[0], t, 0.02); v.g2.gain.setTargetAtTime(g[1], t, 0.02); v.gs.gain.setTargetAtTime(g[2], t, 0.02);
    }
  }
  const mixGains = () => { const s = 1 + p.osc2 + p.sub; return [1 / s, p.osc2 / s, p.sub / s]; };   // 重ねても、全体の大きさが変わらないように

  // ---- 声(1音) ----
  const voices = new Map();
  const midiToHz = (n) => 440 * Math.pow(2, (n - 69) / 12);
  function noteOn(n) {
    ensureAudio();
    if (voices.has(n)) return;
    const t = ctx.currentTime, freq = midiToHz(n);
    const osc = ctx.createOscillator(), mod = ctx.createOscillator(), modGain = ctx.createGain();
    const osc2 = ctx.createOscillator(), sub = ctx.createOscillator(), g1 = ctx.createGain(), g2 = ctx.createGain(), gs = ctx.createGain();
    const filter = ctx.createBiquadFilter(), amp = ctx.createGain();
    osc.type = p.wave; osc.frequency.value = freq;
    osc2.type = p.wave2; osc2.frequency.value = freq; osc2.detune.value = p.detune;      // オシレーター2: 少しずらして重ねる
    sub.type = 'sine'; sub.frequency.value = freq / 2;                                      // サブ: 1オクターブ下
    const mg = mixGains(); g1.gain.value = mg[0]; g2.gain.value = mg[1]; gs.gain.value = mg[2];
    mod.frequency.value = freq * p.fmRatio; modGain.gain.value = p.fmDepth;
    mod.connect(modGain); modGain.connect(osc.frequency);
    filter.type = 'lowpass'; filter.frequency.value = p.cutoff; filter.Q.value = p.q;
    // 音の大きさの形: 0 → (アタック)→ 最大 → (ディケイ)→ サスティン
    amp.gain.setValueAtTime(0, t);
    amp.gain.linearRampToValueAtTime(0.25, t + p.attack);
    amp.gain.setTargetAtTime(0.25 * p.sustain, t + p.attack, p.decay / 3);
    // フィルターの形: 押した瞬間に、fEnv段(オクターブ)ぶん開いて、フィルターが閉じる時間かけて、もとの明るさに戻る
    if (p.fEnv > 0.05) {
      const peak = Math.min(20000, p.cutoff * Math.pow(2, p.fEnv));
      filter.frequency.setValueAtTime(p.cutoff, t);
      filter.frequency.linearRampToValueAtTime(peak, t + p.attack + 0.005);
      filter.frequency.setTargetAtTime(p.cutoff, t + p.attack + 0.005, p.fDecay / 3);
    }
    osc.connect(g1); osc2.connect(g2); sub.connect(gs); g1.connect(filter); g2.connect(filter); gs.connect(filter);
    filter.connect(amp); amp.connect(out);
    osc.start(t); osc2.start(t); sub.start(t); mod.start(t);
    voices.set(n, { osc, osc2, sub, g1, g2, gs, mod, modGain, filter, amp, freq });
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
    v.osc.stop(t + p.release + 0.05); v.osc2.stop(t + p.release + 0.05); v.sub.stop(t + p.release + 0.05); v.mod.stop(t + p.release + 0.05);
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

  // ---- つまみ(宇宙船の操作盤) ----
  const toSlider = (v, min, max, log) => log ? Math.log(v / min) / Math.log(max / min) : (v - min) / (max - min);
  const fromSlider = (s, min, max, log) => log ? min * Math.pow(max / min, s) : min + s * (max - min);
  const SHORT = { volume: ['ボリューム', 'VOL'], cutoff: ['明るさ', 'CUTOFF'], q: ['クセ', 'RES'], fmDepth: ['深さ', 'DEPTH'], fmRatio: ['比率', 'RATIO'], attack: ['立ち上がり', 'ATTACK'], decay: ['ディケイ', 'DECAY'], sustain: ['サスティン', 'SUSTAIN'], fEnv: ['開き', 'F.ENV'], fDecay: ['閉じる', 'F.DECAY'], osc2: ['OSC2の量', 'OSC2'], detune: ['ずらし', 'DETUNE'], sub: ['サブ', 'SUB'], release: ['余韻', 'RELEASE'], delayTime: ['間隔', 'TIME'], feedback: ['くり返し', 'FEEDBACK'], mix: ['量', 'MIX'] };
  const GROUPS = [
    ['ジェネレーター', 'OSC', ['wave', 'wave2', 'osc2', 'detune', 'sub']],
    ['ワープドライブ', 'FM', ['fmDepth', 'fmRatio']],
    ['レーダー・フィルター', 'FILTER', ['cutoff', 'q', 'fEnv', 'fDecay']],
    ['スラスター', 'ENV', ['attack', 'decay', 'sustain', 'release']],
    ['エコー通信', 'DELAY', ['delayTime', 'feedback', 'mix']],
    ['メイン出力', 'OUT', ['volume']],
  ];
  const ICON = { sine: 'M2 10 Q9 -4 16 10 T30 10', triangle: 'M2 17 L9 3 L23 17 L30 3', sawtooth: 'M2 17 L16 3 L16 17 L30 3', square: 'M2 17 L2 3 L16 3 L16 17 L30 17 L30 3' };
  function waveSel(title, key) {
    const w = document.createElement('div'); w.className = 'wsel';
    w.innerHTML = '<b>' + title + '</b><div></div>';
    for (const [id, label] of WAVES) {
      const bt = document.createElement('button'); bt.title = label; bt.setAttribute('aria-label', label);
      bt.innerHTML = '<svg viewBox="0 0 32 20"><path d="' + ICON[id] + '"/></svg>';
      bt.classList.toggle('on', p[key] === id);
      bt.onclick = () => { p[key] = id; w.querySelectorAll('button').forEach((x) => x.classList.remove('on')); bt.classList.add('on'); applyGlobal(); };
      w.lastChild.appendChild(bt);
    }
    return w;
  }
  function dial(key) {
    const [, , min, max, step, fmt, log] = KNOBS.find((k) => k[0] === key);
    const el = document.createElement('div'); el.className = 'dial'; el.tabIndex = 0; el.setAttribute('role', 'slider');
    el.innerHTML = '<div class="ring"><div class="knob"></div></div><b>' + SHORT[key][0] + '</b><em>' + SHORT[key][1] + '</em><output></output>';
    const ring = el.querySelector('.ring'), out2 = el.querySelector('output');
    let s = toSlider(p[key], min, max, log);
    const set = (ns) => {
      s = Math.min(1, Math.max(0, ns));
      let v = fromSlider(s, min, max, log); if (!log) v = Math.round(v / step) * step;
      p[key] = v; ring.style.setProperty('--s', s); ring.style.setProperty('--a', (-135 + s * 270) + 'deg');
      el.querySelector('.knob').style.setProperty('--a', (-135 + s * 270) + 'deg');
      out2.textContent = fmt(v); el.setAttribute('aria-valuenow', v); el.setAttribute('aria-valuetext', fmt(v)); applyGlobal();
    };
    set(s);
    let y0 = null, s0 = 0;
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); el.setPointerCapture(e.pointerId); y0 = e.clientY; s0 = s; el.focus(); });
    el.addEventListener('pointermove', (e) => { if (y0 != null) set(s0 + (y0 - e.clientY) / 160); });
    const end = () => { y0 = null; };
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
    el.addEventListener('keydown', (e) => { if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { set(s + 0.02); e.preventDefault(); } if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { set(s - 0.02); e.preventDefault(); } });
    return el;
  }
  function buildControls() {
    const box = $('panels'); box.innerHTML = '';
    for (const [title, en, keys] of GROUPS) {
      const pn = document.createElement('section'); pn.className = 'panel';
      pn.innerHTML = '<h3>' + title + '<small>' + en + '</small></h3>';
      if (keys.includes('wave')) { pn.appendChild(waveSel('OSC1 の波', 'wave')); pn.appendChild(waveSel('OSC2 の波', 'wave2')); }
      const d = document.createElement('div'); d.className = 'dials';
      keys.filter((k) => KNOBS.some((x) => x[0] === k)).forEach((k) => d.appendChild(dial(k)));
      pn.appendChild(d); box.appendChild(pn);
    }
  }
  $('reset').onclick = () => { Object.assign(p, DEFAULTS); buildControls(); applyGlobal(); };
  const lamps = () => { const n = voices.size; document.querySelectorAll('#lamps u').forEach((u, i) => u.classList.toggle('on', i < n)); };
  setInterval(lamps, 100);

  // ---- 波形の表示 ----
  function drawScope() {
    const c = $('scope'), g = c.getContext('2d'), buf = new Uint8Array(analyser.fftSize);
    const color = () => '#5cf0ff';
    (function frame() {
      c.width = c.clientWidth * devicePixelRatio; c.height = c.clientHeight * devicePixelRatio;
      analyser.getByteTimeDomainData(buf);
      g.clearRect(0, 0, c.width, c.height);
      g.strokeStyle = color(); g.lineWidth = 2 * devicePixelRatio; g.shadowColor = '#5cf0ff'; g.shadowBlur = 8 * devicePixelRatio; g.beginPath();
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
