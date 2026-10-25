// ノイズドラム: ホワイトノイズ → フィルター(とスイープ) → 音量の減衰 → ゆがみ、に、高さの下がる胴鳴りを足す
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);

  const PRESETS = {
    'ザーッ(素のノイズ)': { ftype: 'none', cutoff: 2000, q: 1, sweep: 0, hold: 1.5, decay: 0.05, attack: 0.001, noise: 1.0, body: 0, bodyHz: 100, bodyDrop: 1, bodyDecay: 0.1, drive: 0, claps: 1, volume: 0.35 },
    'キック':      { ftype: 'lowpass',  cutoff: 300,  q: 1,   sweep: 0,    decay: 0.25, attack: 0.001, noise: 0.15, body: 1.0, bodyHz: 55,  bodyDrop: 6,  bodyDecay: 0.45, drive: 0.3, claps: 1, volume: 0.7 },
    'スネア':      { ftype: 'bandpass', cutoff: 1800, q: 0.8, sweep: 2,    decay: 0.18, attack: 0.001, noise: 0.9,  body: 0.5, bodyHz: 190, bodyDrop: 1.5,bodyDecay: 0.1,  drive: 0.2, claps: 1, volume: 0.7 },
    'ハイハット':  { ftype: 'highpass', cutoff: 7000, q: 1,   sweep: 0,    decay: 0.05, attack: 0.001, noise: 1.0,  body: 0,   bodyHz: 100, bodyDrop: 1,  bodyDecay: 0.1,  drive: 0,   claps: 1, volume: 0.6 },
    'オープンハット': { ftype: 'highpass', cutoff: 6000, q: 1.5, sweep: 0, decay: 0.45, attack: 0.001, noise: 1.0,  body: 0,   bodyHz: 100, bodyDrop: 1,  bodyDecay: 0.1,  drive: 0.1, claps: 1, volume: 0.5 },
    'クラップ':    { ftype: 'bandpass', cutoff: 1200, q: 1.5, sweep: 1,    decay: 0.2,  attack: 0.001, noise: 1.0,  body: 0,   bodyHz: 100, bodyDrop: 1,  bodyDecay: 0.1,  drive: 0.2, claps: 4, volume: 0.7 },
    'タム':        { ftype: 'lowpass',  cutoff: 900,  q: 2,   sweep: 1,    decay: 0.15, attack: 0.001, noise: 0.3,  body: 0.9, bodyHz: 120, bodyDrop: 2,  bodyDecay: 0.35, drive: 0.1, claps: 1, volume: 0.7 },
  };
  // 最初は、加工していない素のホワイトノイズ(ザーッ)から始める。ひな形はhold(持続)0
  for (const k of Object.keys(PRESETS)) if (PRESETS[k].hold === undefined) PRESETS[k].hold = 0;
  const p = Object.assign({}, PRESETS['ザーッ(素のノイズ)']);
  const KNOBS = [
    ['volume', '音量', 0, 1, (v) => Math.round(v * 100) + '%'],
    ['hold', '持続(ザーッと鳴り続ける長さ)', 0, 3, (v) => v.toFixed(2) + '秒'],
    ['decay', '減衰(消えるまで)', 0.01, 2, (v) => v.toFixed(2) + '秒', true],
    ['attack', '立ち上がり', 0.001, 0.1, (v) => (v * 1000).toFixed(0) + 'ミリ秒', true],
    ['cutoff', 'フィルターの高さ', 40, 20000, (v) => Math.round(v) + 'Hz', true],
    ['q', 'フィルターのクセ', 0.1, 20, (v) => v.toFixed(1), true],
    ['sweep', 'スイープ(開く量)', 0, 4, (v) => v.toFixed(1) + 'オクターブ'],
    ['noise', 'ノイズの量', 0, 1, (v) => Math.round(v * 100) + '%'],
    ['body', '胴鳴りの量', 0, 1, (v) => Math.round(v * 100) + '%'],
    ['bodyHz', '胴鳴りの高さ', 30, 800, (v) => Math.round(v) + 'Hz', true],
    ['bodyDrop', '胴鳴りの下がり方', 1, 12, (v) => '×' + v.toFixed(1)],
    ['bodyDecay', '胴鳴りの長さ', 0.02, 2, (v) => v.toFixed(2) + '秒', true],
    ['drive', 'ゆがみ', 0, 1, (v) => Math.round(v * 100) + '%'],
    ['claps', '連打の回数', 1, 6, (v) => Math.round(v) + '回'],
  ];

  let ctx = null, noiseBuf = null, analyser = null;
  function ensure() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      analyser = ctx.createAnalyser(); analyser.fftSize = 2048; analyser.connect(ctx.destination);
      noiseBuf = makeNoise(ctx);
    }
    if (ctx.state === 'suspended') ctx.resume();
  }
  function makeNoise(c) {
    const b = c.createBuffer(1, c.sampleRate * 3, c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }
  function curve(drive) {
    const k = drive * 60, n = 1024, c = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; c[i] = k ? Math.tanh(x * (1 + k)) / Math.tanh(1 + k) : x; }
    return c;
  }
  const len = () => Math.max(p.hold + p.decay, p.body > 0 ? p.bodyDecay : 0) + 0.01 * Math.round(p.claps) + 0.15;

  // 1回分の音を、c(ふつうのAudioContextでも、書き出し用のOfflineAudioContextでも)の dest へ流す
  function render(c, dest, t0, nbuf) {
    const shaper = c.createWaveShaper(); shaper.curve = curve(p.drive); shaper.oversample = '2x';
    const vol = c.createGain(); vol.gain.value = p.volume;
    shaper.connect(vol); vol.connect(dest);

    if (p.noise > 0) {
      const src = c.createBufferSource(); src.buffer = nbuf; src.loop = true;
      const f = c.createBiquadFilter(); f.type = p.ftype; f.Q.value = p.q;
      const top = Math.min(20000, p.cutoff * Math.pow(2, p.sweep));
      f.frequency.setValueAtTime(top, t0);
      f.frequency.exponentialRampToValueAtTime(Math.max(20, p.cutoff), t0 + Math.min(0.08, p.hold + p.decay));
      const env = c.createGain();
      const claps = Math.round(p.claps), gap = 0.011;
      env.gain.setValueAtTime(0, t0);
      for (let k = 0; k < claps; k++) {                       // 連打: 短いバーストを何回か
        const t = t0 + k * gap, last = k === claps - 1;
        env.gain.setValueAtTime(0, t);
        env.gain.linearRampToValueAtTime(p.noise, t + p.attack);
        if (last && p.hold > 0) env.gain.setValueAtTime(p.noise, t + p.attack + p.hold);   // 持続: しばらく同じ大きさのまま
        env.gain.exponentialRampToValueAtTime(0.001, t + (last ? p.attack + p.hold + p.decay : gap * 0.9));
      }
      if (p.ftype === 'none') src.connect(env); else { src.connect(f); f.connect(env); }   // フィルターなし: 素のノイズのまま
      env.connect(shaper);
      src.start(t0); src.stop(t0 + len());
    }
    if (p.body > 0) {
      const o = c.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(p.bodyHz * p.bodyDrop, t0);
      o.frequency.exponentialRampToValueAtTime(p.bodyHz, t0 + Math.min(0.12, p.bodyDecay));
      const e = c.createGain();
      e.gain.setValueAtTime(0, t0);
      e.gain.linearRampToValueAtTime(p.body, t0 + p.attack);
      e.gain.exponentialRampToValueAtTime(0.001, t0 + p.bodyDecay);
      o.connect(e); e.connect(shaper);
      o.start(t0); o.stop(t0 + len());
    }
  }

  function hit() { ensure(); render(ctx, analyser, ctx.currentTime + 0.005, noiseBuf); }

  async function save() {
    const rate = 44100, oc = new OfflineAudioContext(1, Math.ceil(len() * rate), rate);
    render(oc, oc.destination, 0, makeNoise(oc));
    const buf = await oc.startRendering();
    drawBuffer(buf);
    saveBlob(audioBufferToWav(buf), 'noisedrum_' + new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '') + '.wav', $('savenote'));
  }

  // 波形: 鳴らした直後は、書き出しと同じ音を描く
  function drawBuffer(buf) {
    const c = $('wave'), g = c.getContext('2d'), d = buf.getChannelData(0);
    c.width = c.clientWidth * devicePixelRatio; c.height = c.clientHeight * devicePixelRatio;
    g.clearRect(0, 0, c.width, c.height);
    g.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--fg').trim() || '#111';
    const step = d.length / c.width;
    for (let x = 0; x < c.width; x++) {
      let mn = 1, mx = -1;
      for (let i = Math.floor(x * step); i < Math.floor((x + 1) * step); i++) { if (d[i] < mn) mn = d[i]; if (d[i] > mx) mx = d[i]; }
      g.fillRect(x, (1 - mx) / 2 * c.height, 1, Math.max(1, (mx - mn) / 2 * c.height));
    }
  }
  let previewTimer = null;
  function preview() {           // つまみを動かすたびに、形だけ描き直す(音は鳴らさない)
    clearTimeout(previewTimer);
    previewTimer = setTimeout(async () => {
      const rate = 22050, oc = new OfflineAudioContext(1, Math.ceil(len() * rate), rate);
      render(oc, oc.destination, 0, makeNoise(oc));
      drawBuffer(await oc.startRendering());
    }, 60);
  }

  // ---- 画面 ----
  const FT = [['none', 'なし(素のノイズ)'], ['lowpass', 'ローパス(低い方を残す)'], ['bandpass', 'バンドパス(ある高さだけ)'], ['highpass', 'ハイパス(高い方を残す)']];
  function buildTypes() {
    $('ftype').innerHTML = '';
    for (const [t, label] of FT) {
      const l = document.createElement('label');
      l.innerHTML = '<input type="radio" name="ftype"> ' + label;
      const r = l.querySelector('input'); r.checked = p.ftype === t;
      r.onchange = () => { p.ftype = t; preview(); };
      $('ftype').appendChild(l);
    }
  }
  const resync = buildKnobs($('knobs'), KNOBS, p, preview);
  for (const name of Object.keys(PRESETS)) {
    const b = document.createElement('button'); b.textContent = name;
    b.onclick = () => { Object.assign(p, PRESETS[name]); resync(); buildTypes(); preview(); hit(); };
    $('presets').appendChild(b);
  }
  $('random').onclick = () => {
    for (const [key, , min, max, , log] of KNOBS) {
      if (key === 'volume') continue;
      const s = Math.random();
      p[key] = log ? min * Math.pow(max / min, s) : min + s * (max - min);
    }
    p.ftype = FT[1 + Math.floor(Math.random() * 3)][0];
    p.hold = Math.random() < 0.7 ? 0 : p.hold;   // でたらめでも、たいていはドラムらしい短さに
    resync(); buildTypes(); preview(); hit();
  };
  $('hit').addEventListener('pointerdown', (e) => { e.preventDefault(); hit(); });
  $('save').onclick = save;
  window.addEventListener('keydown', (e) => { if (e.code === 'Space' && !e.repeat) { e.preventDefault(); hit(); } });
  buildTypes(); preview();
})();
