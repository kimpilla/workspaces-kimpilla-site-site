// コーラス重ね: 元の音 → [コーラス] × 段数(直列) → 音量 → リミッター → スピーカー
// 1段のコーラス = そのままの音 + (遅らせて、遅れをLFOで揺らした音)。遅れた音の一部を入り口へ戻す(フィードバック)。
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);

  const DEFAULTS = { stages: 8, delayMs: 8, depthMs: 3, rate: 0.8, spread: 0.5, feedback: 0.2, mix: 0.5, comp: 0.5, volume: 0.4 };
  const p = Object.assign({}, DEFAULTS);
  const KNOBS_MOD = [                  // 揺れに関するもの(右の図に、動きが出る)
    ['delayMs', '遅れ', 3, 40, (v) => v.toFixed(1) + 'ミリ秒', true],
    ['depthMs', '揺れの深さ', 0, 20, (v) => v.toFixed(1) + 'ミリ秒'],
    ['rate', '揺れの速さ', 0.05, 60, (v) => v.toFixed(2) + '回/秒', true],
    ['spread', '速さのばらつき', 0, 1, (v) => Math.round(v * 100) + '%'],
  ];
  const KNOBS_OUT = [
    ['feedback', 'フィードバック', 0, 0.95, (v) => Math.round(v * 100) + '%'],
    ['mix', '混ぜる量', 0, 1, (v) => Math.round(v * 100) + '%'],
    ['comp', 'コンプの強さ', 0, 1, (v) => v < 0.02 ? 'なし' : Math.round(v * 100) + '%'],
    ['volume', '音量', 0, 1, (v) => Math.round(v * 100) + '%'],
  ];
  const KNOBS = KNOBS_MOD.concat(KNOBS_OUT);
  const SOURCES = [['chord', 'のこぎり波の和音'], ['pluck', 'ポロンと鳴るくり返し'], ['noise', 'ノイズ'], ['sine', 'サイン波(ひとつの高さ)'], ['file', '自分の音のファイル']];
  let source = 'pluck', fileBuf = null;
  let seeds = [];                     // 段ごとの揺れの速さのばらつき(-1〜1)
  let seedsX = [];                    // 追加した波ごとの、段ごとのばらつき
  const MAXX = 6;                     // 追加できる波の数
  const reseed = () => { seeds = Array.from({ length: 64 }, () => Math.random() * 2 - 1); seedsX = Array.from({ length: MAXX }, () => Array.from({ length: 64 }, () => Math.random() * 2 - 1)); };
  const extra = [];                   // 追加した波: { rate(回/秒), depth(ミリ秒) }
  const NEWWAVE = () => ({ rate: 0.2, depth: 4 });
  // 揺れの深さが大きすぎて、遅れの時間が0より小さくならないように、全部の波を同じ割合で小さくする
  const depthScale = () => { const tot = p.depthMs + extra.reduce((a, w) => a + w.depth, 0), lim = p.delayMs - 0.5; return tot > lim && tot > 0 ? lim / tot : 1; };
  reseed();

  // ---- 元の音(ループする AudioBuffer を作る) ----
  function makeSource(c) {
    const rate = c.sampleRate;
    if (source === 'file' && fileBuf) return fileBuf;
    const secs = 4, b = c.createBuffer(2, rate * secs, rate);
    const L = b.getChannelData(0), R = b.getChannelData(1);
    for (let i = 0; i < L.length; i++) {
      const t = i / rate;
      let v = 0;
      if (source === 'chord') {
        for (const f of [130.81, 164.81, 196.0, 246.94]) v += ((t * f) % 1) * 2 - 1;
        v *= 0.18;
      } else if (source === 'pluck') {
        const notes = [220, 261.63, 329.63, 392, 329.63, 261.63, 196, 246.94];
        const step = 0.5, k = Math.floor(t / step), tt = t - k * step, f = notes[k % notes.length];
        v = (((tt * f) % 1) * 2 - 1) * Math.exp(-tt * 7) * 0.6;
      } else if (source === 'noise') {
        v = (Math.random() * 2 - 1) * 0.3;
      } else {
        v = Math.sin(2 * Math.PI * 440 * t) * 0.4;
      }
      L[i] = R[i] = v;
    }
    return b;
  }

  // ---- 音の経路を組む(AudioContext でも OfflineAudioContext でも同じ) ----
  function build(c, dest, t0) {
    const src = c.createBufferSource(); src.buffer = makeSource(c); src.loop = true;
    let node = src;
    const n = Math.round(p.stages);
    const keep = [];
    for (let s = 0; s < n; s++) {
      const input = c.createGain(), outG = c.createGain(), dry = c.createGain(), wet = c.createGain();
      const delay = c.createDelay(0.2), fb = c.createGain(), lfo = c.createOscillator(), lfoAmt = c.createGain();
      delay.delayTime.value = p.delayMs / 1000;
      const r = p.rate * Math.pow(2, seeds[s] * p.spread * 2);   // ばらつき100%で、±2オクターブ
      lfo.frequency.value = r;
      const sc = depthScale();
      lfoAmt.gain.value = p.depthMs * sc / 1000;
      lfo.connect(lfoAmt); lfoAmt.connect(delay.delayTime);
      extra.forEach((w, k) => {                              // 追加した波も、同じ遅れの時間に足す
        const o = c.createOscillator(), a = c.createGain();
        o.frequency.value = w.rate * Math.pow(2, seedsX[k][s] * p.spread * 2);
        a.gain.value = w.depth * sc / 1000;
        o.connect(a); a.connect(delay.delayTime); o.start(t0); keep.push(o);
      });
      dry.gain.value = 1 - p.mix; wet.gain.value = p.mix; fb.gain.value = p.feedback;
      node.connect(input);
      input.connect(dry); input.connect(delay);
      delay.connect(wet); delay.connect(fb); fb.connect(delay);
      dry.connect(outG); wet.connect(outG);
      lfo.start(t0);
      keep.push(lfo);
      node = outG;
    }
    // コンプ: 強さ1本で、しきい値・圧縮比をまとめて決める(0=なし、1=強い)
    const comp = c.createDynamicsCompressor();
    const thr = -p.comp * 40, ratio = 1 + p.comp * 11;
    comp.threshold.value = thr; comp.ratio.value = ratio; comp.knee.value = 12; comp.attack.value = 0.005; comp.release.value = 0.15;
    node.connect(comp); node = comp;                          // (ブラウザのコンプは、小さくなった分を自動で戻す)
    const vol = c.createGain(); vol.gain.value = p.volume;
    const lim = c.createDynamicsCompressor();                 // 重ねて大きくなりすぎるのを抑える
    lim.threshold.value = -6; lim.ratio.value = 20; lim.attack.value = 0.002; lim.release.value = 0.1;
    node.connect(vol); vol.connect(lim); lim.connect(dest);
    src.start(t0);
    return { comp, stop: () => { try { src.stop(); keep.forEach((l) => l.stop()); } catch (e) {} vol.disconnect(); } };
  }

  // ---- 再生 ----
  let ctx = null, analyser = null, running = null, rebuildTimer = null;
  function ensure() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      analyser = ctx.createAnalyser(); analyser.fftSize = 2048; analyser.connect(ctx.destination);
      scope();
    }
    if (ctx.state === 'suspended') ctx.resume();
  }
  function play() {
    ensure();
    if (running) running.stop();
    running = build(ctx, analyser, ctx.currentTime + 0.02);
    $('status').textContent = '再生中: ' + Math.round(p.stages) + '段';
    meterOn();
  }
  function stop() { if (running) { running.stop(); running = null; } $('status').textContent = ''; $('grOut').textContent = ''; }
  let meterT = null;
  function meterOn() {                 // コンプが、いま、どれだけ音を押さえているか
    if (meterT) return;
    meterT = setInterval(() => {
      if (!running) { clearInterval(meterT); meterT = null; return; }
      const r = running.comp.reduction;
      $('grOut').textContent = 'コンプが押さえている量: ' + (r < -0.05 ? r.toFixed(1) : '0.0') + ' dB';
    }, 120);
  }
  function changed() {                // つまみを動かしたら、鳴っている音を組み直す
    if (!running) return;
    clearTimeout(rebuildTimer);
    rebuildTimer = setTimeout(play, 80);
  }

  async function save() {
    const rate = 44100, oc = new OfflineAudioContext(2, rate * 10, rate);
    $('status').textContent = '書き出し中…';
    build(oc, oc.destination, 0);
    const buf = await oc.startRendering();
    $('status').textContent = '書き出しました(' + Math.round(p.stages) + '段、10秒)';
    saveBlob(audioBufferToWav(buf), 'chorus' + Math.round(p.stages) + '_' + new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '') + '.wav', $('status'));
  }

  function scope() {
    const c = $('scope'), g = c.getContext('2d'), buf = new Uint8Array(analyser.fftSize);
    (function frame() {
      c.width = c.clientWidth * devicePixelRatio; c.height = c.clientHeight * devicePixelRatio;
      analyser.getByteTimeDomainData(buf);
      g.clearRect(0, 0, c.width, c.height);
      g.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--fg').trim() || '#111';
      g.lineWidth = 1.5 * devicePixelRatio; g.beginPath();
      for (let i = 0; i < buf.length; i++) {
        const x = i / (buf.length - 1) * c.width, y = (1 - buf[i] / 255) * c.height;
        i ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      g.stroke();
      requestAnimationFrame(frame);
    })();
  }

  // ---- 揺れの見える化: 段ごとの「遅れの時間」が、いまどう動いているか(右端が「いま」。1秒ぶん) ----
  function lfoView() {
    const c = $('lfo'), g = c.getContext('2d');
    const MAXMS = 40, WIN = 1, SHOW = 16;
    (function frame() {
      const dpr = devicePixelRatio || 1;
      const W = c.clientWidth * dpr, H = c.clientHeight * dpr;
      if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
      const css = getComputedStyle(document.documentElement);
      const fg = css.getPropertyValue('--fg').trim() || '#111', muted = css.getPropertyValue('--muted').trim() || '#888', line = css.getPropertyValue('--line').trim() || '#ccc';
      g.clearRect(0, 0, W, H);
      const padL = 34 * dpr, padR = 6 * dpr, padT = 8 * dpr, padB = 16 * dpr;
      const X = (f) => padL + f * (W - padL - padR), Y = (ms) => padT + (1 - ms / MAXMS) * (H - padT - padB);
      g.font = (10 * dpr) + 'px sans-serif'; g.fillStyle = muted; g.strokeStyle = line; g.lineWidth = dpr;
      g.textBaseline = 'middle'; g.textAlign = 'right';
      for (const ms of [0, 10, 20, 30, 40]) {
        g.beginPath(); g.moveTo(X(0), Y(ms)); g.lineTo(X(1), Y(ms)); g.stroke();
        g.fillText(ms + 'ms', padL - 4 * dpr, Y(ms));
      }
      g.textAlign = 'left'; g.textBaseline = 'alphabetic';
      g.fillText('← 1秒前', X(0), H - 3 * dpr); g.textAlign = 'right'; g.fillText('いま →', X(1), H - 3 * dpr);
      const sc = depthScale(), depth = p.depthMs * sc, tot = (p.depthMs + extra.reduce((a, w) => a + w.depth, 0)) * sc;   // 実際の音と同じ計算
      g.fillStyle = fg; g.globalAlpha = 0.08;                       // 遅れが動く範囲
      g.fillRect(X(0), Y(p.delayMs + tot), X(1) - X(0), Y(p.delayMs - tot) - Y(p.delayMs + tot));
      g.globalAlpha = 1;
      const now = performance.now() / 1000, n = Math.round(p.stages), shown = Math.min(n, SHOW);
      g.strokeStyle = fg; g.lineWidth = 1.4 * dpr; g.lineJoin = 'round';
      const steps = Math.max(2, Math.floor((W - padL - padR) / (dpr * 0.5)));
      for (let s = 0; s < shown; s++) {
        const r = p.rate * Math.pow(2, seeds[s] * p.spread * 2);
        g.globalAlpha = shown === 1 ? 1 : Math.max(0.28, 0.85 - s * 0.03);
        g.beginPath();
        for (let i = 0; i <= steps; i++) {
          const f = i / steps, t = now - (1 - f) * WIN;
          let d = p.delayMs + depth * Math.sin(2 * Math.PI * r * t);
          for (let k = 0; k < extra.length; k++) d += extra[k].depth * sc * Math.sin(2 * Math.PI * extra[k].rate * Math.pow(2, seedsX[k][s] * p.spread * 2) * t);
          i ? g.lineTo(X(f), Y(d)) : g.moveTo(X(f), Y(d));
        }
        g.stroke();
      }
      g.globalAlpha = 1;
      $('lfoNote').textContent = '遅れの時間が、段ごとにどう揺れているか。' + (n > SHOW ? '(' + n + '段のうち、' + SHOW + '段を表示)' : '(' + n + '段)') + '線の数=段数、波の高さ=揺れの深さ、波の細かさ=揺れの速さ、線ごとの違い=ばらつき。' + (extra.length ? '追加した波は、足し算した形で出ている。' : '') + (sc < 0.995 ? ' ※深さの合計が「遅れ」に収まらないので、全部の波を' + Math.round(sc * 100) + '%に小さくしている(遅れを大きくすると、小さくならない)。' : '');
      requestAnimationFrame(frame);
    })();
  }

  // ---- 画面 ----
  for (const [k, label] of SOURCES) {
    const l = document.createElement('label');
    l.innerHTML = '<input type="radio" name="src"> ' + label;
    const r = l.querySelector('input'); r.checked = source === k;
    r.onchange = () => { source = k; $('filerow').hidden = k !== 'file'; if (k !== 'file' || fileBuf) changed(); };
    $('sources').appendChild(l);
  }
  $('file').onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    ensure();
    try {
      fileBuf = await ctx.decodeAudioData(await f.arrayBuffer());
      $('status').textContent = '読み込みました: ' + f.name;
      play();
    } catch (err) { $('status').textContent = '読めませんでした(' + f.name + ')'; }
  };
  const resyncMod = buildKnobs($('knobsMod'), KNOBS_MOD, p, changed);
  const resyncOut = buildKnobs($('knobs'), KNOBS_OUT, p, changed);
  const showStages = () => { $('stOut').textContent = Math.round(p.stages) + '段'; };
  // 追加した波の行(速さ・深さ・消すボタン)
  const WAVEKNOBS = [
    ['rate', '速さ', 0.02, 60, (v) => v.toFixed(2) + '回/秒', true],
    ['depth', '深さ', 0, 20, (v) => v.toFixed(1) + 'ミリ秒'],
  ];
  function renderWaves() {
    const box = $('waves'); box.innerHTML = '';
    extra.forEach((w, i) => {
      const row = document.createElement('div'); row.className = 'waverow';
      const head = document.createElement('div'); head.className = 'wavehead';
      const t = document.createElement('b'); t.textContent = '波' + (i + 2);
      const x = document.createElement('button'); x.textContent = '消す'; x.setAttribute('aria-label', '波' + (i + 2) + 'を消す');
      x.onclick = () => { extra.splice(i, 1); renderWaves(); changed(); };
      head.append(t, x);
      const kb = document.createElement('div'); kb.className = 'knobs';
      buildKnobs(kb, WAVEKNOBS, w, changed);
      row.append(head, kb); box.appendChild(row);
    });
    $('addWave').disabled = extra.length >= MAXX;
  }
  $('addWave').onclick = () => { if (extra.length < MAXX) { extra.push(NEWWAVE()); renderWaves(); changed(); } };
  const resync = () => { resyncMod(); resyncOut(); showStages(); renderWaves(); };
  function setStages(n) { p.stages = Math.max(1, Math.min(64, Math.round(n))); showStages(); changed(); }
  function holdButton(btn, delta) {      // 押し続けると、くり返し変わる
    let t1 = null, t2 = null;
    const stopHold = () => { clearTimeout(t1); clearInterval(t2); t1 = t2 = null; };
    btn.onpointerdown = (e) => { e.preventDefault(); setStages(Math.round(p.stages) + delta); t1 = setTimeout(() => { t2 = setInterval(() => setStages(Math.round(p.stages) + delta), 90); }, 400); };
    btn.onpointerup = btn.onpointerleave = btn.onpointercancel = stopHold;
    btn.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setStages(Math.round(p.stages) + delta); } };
  }
  holdButton($('stDown'), -1); holdButton($('stUp'), 1);
  showStages(); renderWaves();
  lfoView();
  $('play').onclick = play;
  $('stop').onclick = stop;
  $('save').onclick = save;
  $('reshuffle').onclick = () => { reseed(); changed(); };
  $('random').onclick = () => {
    for (const [key, , min, max, , log] of KNOBS) {
      if (key === 'volume' || key === 'comp') continue;   // 音量とコンプは、でたらめにしない(安全のため、いまの設定のまま)
      const s = Math.random();
      p[key] = log ? min * Math.pow(max / min, s) : min + s * (max - min);
    }
    for (const w of extra) { w.rate = 0.02 * Math.pow(60 / 0.02, Math.random()); w.depth = Math.random() * 20; }
    p.stages = 1 + Math.floor(Math.random() * 64);
    reseed(); resync(); play();
  };
  $('reset').onclick = () => { Object.assign(p, DEFAULTS); extra.length = 0; resync(); changed(); };
})();
