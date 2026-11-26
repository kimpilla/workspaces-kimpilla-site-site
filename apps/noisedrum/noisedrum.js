// ノイズドラム: 音のもとはホワイトノイズだけ。フィルター(とスイープ) → 鳴り方(エンベロープ) → 歪み → EQ(山2つ) → コンプ。
// 元の考え: きりたんのDTM解説「ホワイトノイズを使って、自分だけのドラムを作ろう！」(ai-memory の 制作/技術メモ/DTM技術メモ.md)。2026-11-26、胴鳴り(サイン波)を外して作り直した
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);

  // ひな形の音量は、どれも同じくらいの大きさに聞こえるようにそろえた(短い区間の音の強さで約-20dB。ハイハットは少し小さめ。2026-11-26、本人「全体のバランスが悪い」)
  // ひな形は、動画の手順どおり(クラップ: 短く・歪み強め・1kHzの少し右に山 / スネア: もっと短く・フィルターを1kHzの少し左 /
  // ハイハット: フィルターを10kHzあたり / キック: 100Hzより下に大きい山と100Hzあたりになだらかな山・コンプでアタック)
  const BASE = { ftype: 'none', cutoff: 2000, q: 1, sweep: 0, attack: 0.001, hold: 0, decay: 0.05, claps: 1, drive: 0,
    eq1Hz: 1000, eq1Gain: 0, eq1Q: 1, eq2Hz: 100, eq2Gain: 0, eq2Q: 1, comp: 0, compAtk: 0.003, volume: 0.3,
    sine: 0, sineHz: 60, sineDrop: 4, sineDecay: 0.3 };   // サイン波は予備(ひな形ではどれも0。基本はノイズだけで作る。2026-11-26、本人)
  const PRESETS = {
    'ザーッ(素のノイズ)': { hold: 1.5, decay: 0.05, volume: 0.17 },
    'クラップ':   { decay: 0.18, claps: 4, drive: 0.6, eq1Hz: 1300, eq1Gain: 12, eq1Q: 1.5, volume: 0.1 },
    'スネア':     { ftype: 'bandpass', cutoff: 800, q: 0.8, decay: 0.12, drive: 0.2, eq1Hz: 900, eq1Gain: 6, eq1Q: 1, volume: 0.31 },
    'ハイハット': { ftype: 'highpass', cutoff: 8000, q: 1, decay: 0.06, drive: 0.3, eq1Hz: 10000, eq1Gain: 18, eq1Q: 0.7, volume: 0.1 },
    'キック':     { ftype: 'lowpass', cutoff: 300, q: 0.7, sweep: 3, decay: 0.18, eq1Hz: 55, eq1Gain: 24, eq1Q: 1.2, eq2Hz: 100, eq2Gain: 9, eq2Q: 0.5, comp: 0.9, compAtk: 0.03, volume: 0.165 },   // アタック: コンプのアタックを遅めにして頭を通し、フィルターを一瞬開く
  };
  for (const k of Object.keys(PRESETS)) PRESETS[k] = Object.assign({}, BASE, PRESETS[k]);
  // 最初は、加工していない素のホワイトノイズ(ザーッ)から始める
  const p = Object.assign({}, PRESETS['ザーッ(素のノイズ)']);
  const KNOBS = [
    ['volume', '音量', 0, 4, (v) => Math.round(v * 100) + '%'],
    ['attack', 'アタック(立ち上がり)', 0.001, 0.1, (v) => (v * 1000).toFixed(0) + 'ミリ秒', true],
    ['hold', 'ホールド(ザーッと鳴り続ける長さ)', 0, 3, (v) => v.toFixed(2) + '秒'],
    ['decay', 'ディケイ(消えるまで)', 0.01, 2, (v) => v.toFixed(2) + '秒', true],
    ['claps', 'リトリガー(連打の回数)', 1, 6, (v) => Math.round(v) + '回'],
    ['cutoff', 'カットオフ(高さ)', 40, 20000, (v) => Math.round(v) + 'Hz', true],
    ['q', 'レゾナンス(クセ)', 0.1, 20, (v) => v.toFixed(1), true],
    ['sweep', 'スイープ(開く量)', 0, 4, (v) => v.toFixed(1) + 'オクターブ'],
    ['drive', '歪み', 0, 1, (v) => Math.round(v * 100) + '%'],
    ['eq1Hz', '山1の高さ', 30, 16000, (v) => Math.round(v) + 'Hz', true],
    ['eq1Gain', '山1の量', -24, 24, (v) => (v > 0 ? '+' : '') + v.toFixed(1) + 'dB'],
    ['eq1Q', '山1の幅(小さいほど、なだらか)', 0.3, 10, (v) => 'Q ' + v.toFixed(1), true],
    ['eq2Hz', '山2の高さ', 30, 16000, (v) => Math.round(v) + 'Hz', true],
    ['eq2Gain', '山2の量', -24, 24, (v) => (v > 0 ? '+' : '') + v.toFixed(1) + 'dB'],
    ['eq2Q', '山2の幅(小さいほど、なだらか)', 0.3, 10, (v) => 'Q ' + v.toFixed(1), true],
    ['comp', 'コンプのかかり方', 0, 1, (v) => Math.round(v * 100) + '%'],
    ['compAtk', 'コンプのアタック', 0.001, 0.05, (v) => (v * 1000).toFixed(1) + 'ミリ秒', true],
    ['sine', 'サイン波の量', 0, 1, (v) => Math.round(v * 100) + '%'],
    ['sineHz', 'サイン波の高さ', 30, 800, (v) => Math.round(v) + 'Hz', true],
    ['sineDrop', 'サイン波の落ち幅(鳴った瞬間の高さ ÷ 最後の高さ)', 1, 12, (v) => '×' + v.toFixed(1)],
    ['sineDecay', 'サイン波のディケイ(消えるまで)', 0.02, 2, (v) => v.toFixed(2) + '秒', true],
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
  const len = () => Math.max(p.attack + p.hold + p.decay + 0.011 * Math.round(p.claps), p.sine > 0 ? p.sineDecay : 0) + 0.15;

  // 1回分の音を、c(ふつうのAudioContextでも、書き出し用のOfflineAudioContextでも)の dest へ流す
  function render(c, dest, t0, nbuf) {
    const src = c.createBufferSource(); src.buffer = nbuf; src.loop = true;
    // フィルター
    const f = c.createBiquadFilter(); f.type = p.ftype === 'none' ? 'allpass' : p.ftype; f.Q.value = p.q;
    const top = Math.min(20000, p.cutoff * Math.pow(2, p.sweep));
    f.frequency.setValueAtTime(top, t0);
    f.frequency.exponentialRampToValueAtTime(Math.max(20, p.cutoff), t0 + Math.min(0.08, p.hold + p.decay));
    // 鳴り方(エンベロープ)とリトリガー
    const env = c.createGain();
    const claps = Math.round(p.claps), gap = 0.011;
    env.gain.setValueAtTime(0, t0);
    for (let k = 0; k < claps; k++) {
      const t = t0 + k * gap, last = k === claps - 1;
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(1, t + p.attack);
      if (last && p.hold > 0) env.gain.setValueAtTime(1, t + p.attack + p.hold);
      env.gain.exponentialRampToValueAtTime(0.001, t + (last ? p.attack + p.hold + p.decay : gap * 0.9));
    }
    // 歪み
    const shaper = c.createWaveShaper(); shaper.curve = curve(p.drive); shaper.oversample = '2x';
    // EQ(山を2つ)
    const e1 = c.createBiquadFilter(); e1.type = 'peaking'; e1.frequency.value = p.eq1Hz; e1.gain.value = p.eq1Gain; e1.Q.value = p.eq1Q;
    const e2 = c.createBiquadFilter(); e2.type = 'peaking'; e2.frequency.value = p.eq2Hz; e2.gain.value = p.eq2Gain; e2.Q.value = p.eq2Q;
    // コンプ(かかり方0%なら素通し)
    const cp = c.createDynamicsCompressor();
    cp.threshold.value = -50 * p.comp; cp.ratio.value = 1 + 11 * p.comp; cp.knee.value = 6;
    cp.attack.value = p.compAtk; cp.release.value = 0.15;
    const vol = c.createGain(); vol.gain.value = p.volume;
    if (p.ftype === 'none') src.connect(env); else { src.connect(f); f.connect(env); }   // フィルターなし: 素のノイズのまま
    if (p.sine > 0) {   // 予備: 高さが下がっていくサイン波を、ノイズに足す
      const o = c.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(p.sineHz * p.sineDrop, t0);
      o.frequency.exponentialRampToValueAtTime(p.sineHz, t0 + Math.min(0.12, p.sineDecay));
      const g = c.createGain();
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(p.sine, t0 + p.attack);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + p.sineDecay);
      o.connect(g); g.connect(shaper); o.start(t0); o.stop(t0 + len());
    }
    env.connect(shaper); shaper.connect(e1); e1.connect(e2); e2.connect(cp); cp.connect(vol); vol.connect(dest);
    src.start(t0); src.stop(t0 + len());
  }

  const playing = new Set();   // 鳴っている音(止めるボタン用)
  function hit() {
    ensure();
    const gate = ctx.createGain(); gate.connect(analyser); playing.add(gate);
    render(ctx, gate, ctx.currentTime + 0.005, noiseBuf);
    setTimeout(() => { if (playing.delete(gate)) gate.disconnect(); }, (len() + 0.2) * 1000);
  }
  function stopAll() {
    if (!ctx) return;
    const t = ctx.currentTime;
    for (const g of playing) { g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(0, t + 0.03); setTimeout(() => g.disconnect(), 60); }
    playing.clear();
  }

  // 設定をテキストで(つまみ・フィルターの種類。{"v":1,"app":"noisedrum","p":{...}})
  function txtOut() {
    const q = {}; for (const [key] of KNOBS) q[key] = +(+p[key]).toPrecision(6); q.ftype = p.ftype;
    $('txtBox').value = JSON.stringify({ v: 1, app: 'noisedrum', p: q });
    $('txtNote').textContent = '書き出した。';
  }
  function txtIn() {
    let d; try { d = JSON.parse($('txtBox').value.trim()); } catch (e) { $('txtNote').textContent = '読み込めなかった(文字が途中で切れていないか確かめて)。'; return; }
    const src = d && d.p ? d.p : d;
    let n = 0;
    for (const [key, , min, max] of KNOBS) if (typeof src[key] === 'number' && isFinite(src[key])) { p[key] = Math.min(max, Math.max(min, src[key])); n++; }
    if (FT.some(([t]) => t === src.ftype)) p.ftype = src.ftype;
    resync(); buildTypes(); preview();
    $('txtNote').textContent = n ? '読み込んだ(' + n + 'こ)。' : '設定が見つからなかった。';
  }

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
      const rate = 44100, oc = new OfflineAudioContext(1, Math.ceil(len() * rate), rate);
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
  // つまみを項目ごとにまとめる(音の流れの順)。名前は見出しの言葉をくり返さない(2026-11-26)
  const GROUPS = [
    ['鳴り方', ['attack', 'hold', 'decay', 'claps']],
    ['フィルター(どの高さを残すか)', ['cutoff', 'q', 'sweep'], 'ftype'],
    ['歪み', ['drive']],
    ['EQ(山を2つ作る)', ['eq1Hz', 'eq1Gain', 'eq1Q', 'eq2Hz', 'eq2Gain', 'eq2Q']],
    ['コンプ', ['comp', 'compAtk']],
    ['音量', ['volume']],
    ['予備: サイン波を足す', ['sine', 'sineHz', 'sineDrop', 'sineDecay'], null, true],
  ];
  const syncs = [];
  for (const [title, keys, extra, fold] of GROUPS) {
    let host = $('knobs');
    if (fold) {   // 予備の項目は、たたんでおく(見出しを押すと開く)
      const d = document.createElement('details'); d.style.marginTop = '22px';
      const s = document.createElement('summary'); s.textContent = title + '(ふだんは使わない。ノイズだけで作れないときに)'; s.style.cursor = 'pointer';
      d.appendChild(s); host.appendChild(d); host = d;
    } else {
      const h = document.createElement('h3'); h.className = 'sub'; h.textContent = title; host.appendChild(h);
    }
    if (extra) host.appendChild($(extra));
    const box = document.createElement('div'); box.className = 'knobs'; host.appendChild(box);
    syncs.push(buildKnobs(box, keys.map((key) => KNOBS.find((k) => k[0] === key)), p, preview));
  }
  const resync = () => syncs.forEach((f) => f());
  for (const name of Object.keys(PRESETS)) {
    const b = document.createElement('button'); b.textContent = name;
    b.onclick = () => { Object.assign(p, PRESETS[name]); resync(); buildTypes(); preview(); hit(); };
    $('presets').appendChild(b);
  }
  { const b = document.createElement('button'); b.id = 'random'; b.textContent = 'でたらめにする'; $('presets').appendChild(b); }   // ひな形の並びの最後に(2026-11-26、本人)
  // 書き出しと同じ音を作って、鳴った直後のいちばん強いところ(50ミリ秒)を測り、ひな形と同じくらい(約-20dB)になるよう音量を決める
  async function level(target = -20) {
    p.volume = 1;
    let best = 0;
    for (let k = 0; k < 3; k++) {   // ノイズは毎回ちがうので、3回作って平均する
      const rate = 44100, oc = new OfflineAudioContext(1, Math.ceil(len() * rate), rate);   // 書き出しと同じ 44100(低いと高い音が測れない)
      render(oc, oc.destination, 0, makeNoise(oc));
      const d = (await oc.startRendering()).getChannelData(0), w = Math.round(rate * 0.05);
      let b = 0;
      for (let s = 0; s + w <= d.length; s += Math.floor(w / 2)) { let e = 0; for (let i = s; i < s + w; i++) e += d[i] * d[i]; b = Math.max(b, Math.sqrt(e / w)); }
      best += b / 3;
    }
    if (best > 0) p.volume = Math.min(4, Math.max(0.01, Math.pow(10, target / 20) / best));
  }
  $('random').onclick = async () => {
    stopAll();   // 前の音は止める(2026-11-26、本人)
    for (const [key, , min, max, , log] of KNOBS) {
      if (key === 'volume' || key === 'comp' || key === 'compAtk' || key.startsWith('sine')) continue;   // 音量・コンプ・サイン波(予備)は、でたらめでは変えない
      const s = Math.random();
      p[key] = log ? min * Math.pow(max / min, s) : min + s * (max - min);
    }
    p.ftype = FT[1 + Math.floor(Math.random() * 3)][0];
    p.hold = Math.random() < 0.7 ? 0 : p.hold;   // でたらめでも、たいていはドラムらしい短さに
    await level();   // 音量をそろえる(でたらめでも、極端に大きい・小さい音にならない。2026-11-26、本人)
    resync(); buildTypes(); preview(); hit();
  };
  $('hit').addEventListener('pointerdown', (e) => { e.preventDefault(); hit(); });
  $('save').onclick = save;
  $('stop').onclick = stopAll;
  $('txtOut').onclick = txtOut;
  $('txtIn').onclick = txtIn;
  $('txtCopy').onclick = async () => {
    if (!$('txtBox').value) txtOut();
    try { await navigator.clipboard.writeText($('txtBox').value); $('txtNote').textContent = 'コピーした。'; }
    catch (e) { $('txtBox').focus(); $('txtBox').select(); $('txtNote').textContent = '選んだので、長押しでコピー。'; }
  };
  window.addEventListener('keydown', (e) => { if (e.target && e.target.tagName === 'TEXTAREA') return; if (e.code === 'Space' && !e.repeat) { e.preventDefault(); hit(); } if (e.code === 'Escape') stopAll(); });
  buildTypes(); preview();
})();
