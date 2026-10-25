// コーラス重ね: 元の音 → [コーラス] × 段数(直列) → 音量 → リミッター → スピーカー
// 1段のコーラス = そのままの音 + (遅らせて、遅れをLFOで揺らした音)。遅れた音の一部を入り口へ戻す(フィードバック)。
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);

  const DEFAULTS = { stages: 8, delayMs: 8, depthMs: 3, rate: 0.8, spread: 0.5, feedback: 0.2, mix: 0.5, volume: 0.4 };
  const p = Object.assign({}, DEFAULTS);
  const KNOBS = [
    ['volume', '音量', 0, 1, (v) => Math.round(v * 100) + '%'],
    ['stages', '段数', 1, 64, (v) => Math.round(v) + '段'],
    ['delayMs', '遅れ', 3, 40, (v) => v.toFixed(1) + 'ミリ秒', true],
    ['depthMs', '揺れの深さ', 0, 20, (v) => v.toFixed(1) + 'ミリ秒'],
    ['rate', '揺れの速さ', 0.05, 60, (v) => v.toFixed(2) + '回/秒', true],
    ['spread', '速さのばらつき', 0, 1, (v) => Math.round(v * 100) + '%'],
    ['feedback', 'フィードバック', 0, 0.95, (v) => Math.round(v * 100) + '%'],
    ['mix', '混ぜる量', 0, 1, (v) => Math.round(v * 100) + '%'],
  ];
  const SOURCES = [['chord', 'のこぎり波の和音'], ['pluck', 'ポロンと鳴るくり返し'], ['noise', 'ノイズ'], ['sine', 'サイン波(ひとつの高さ)'], ['file', '自分の音のファイル']];
  let source = 'pluck', fileBuf = null;
  let seeds = [];                     // 段ごとの揺れの速さのばらつき(-1〜1)
  const reseed = () => { seeds = Array.from({ length: 64 }, () => Math.random() * 2 - 1); };
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
      lfoAmt.gain.value = Math.min(p.depthMs, p.delayMs - 0.5) / 1000;
      lfo.connect(lfoAmt); lfoAmt.connect(delay.delayTime);
      dry.gain.value = 1 - p.mix; wet.gain.value = p.mix; fb.gain.value = p.feedback;
      node.connect(input);
      input.connect(dry); input.connect(delay);
      delay.connect(wet); delay.connect(fb); fb.connect(delay);
      dry.connect(outG); wet.connect(outG);
      lfo.start(t0);
      keep.push(lfo);
      node = outG;
    }
    const vol = c.createGain(); vol.gain.value = p.volume;
    const lim = c.createDynamicsCompressor();                 // 重ねて大きくなりすぎるのを抑える
    lim.threshold.value = -6; lim.ratio.value = 20; lim.attack.value = 0.002; lim.release.value = 0.1;
    node.connect(vol); vol.connect(lim); lim.connect(dest);
    src.start(t0);
    return { stop: () => { try { src.stop(); keep.forEach((l) => l.stop()); } catch (e) {} vol.disconnect(); } };
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
  }
  function stop() { if (running) { running.stop(); running = null; } $('status').textContent = ''; }
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
  const resync = buildKnobs($('knobs'), KNOBS, p, changed);
  $('play').onclick = play;
  $('stop').onclick = stop;
  $('save').onclick = save;
  $('reshuffle').onclick = () => { reseed(); changed(); };
  $('random').onclick = () => {
    for (const [key, , min, max, , log] of KNOBS) {
      if (key === 'volume') continue;
      const s = Math.random();
      p[key] = log ? min * Math.pow(max / min, s) : min + s * (max - min);
    }
    reseed(); resync(); play();
  };
  $('reset').onclick = () => { Object.assign(p, DEFAULTS); resync(); changed(); };
})();
