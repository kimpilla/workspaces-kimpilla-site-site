// コーラス重ね: 元の音 → [コーラス] × 段数(直列) → 音量 → リミッター → スピーカー
// 1段のコーラス = そのままの音 + (遅らせて、遅れをLFOで揺らした音)。遅れた音の一部を入り口へ戻す(フィードバック)。
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);

  const DEFAULTS = { stages: 8, delayMs: 8, depthMs: 3, rate: 0.8, spread: 0.5, spreadDepth: 0.5, spreadDelay: 0.3, spreadPhase: 1, feedback: 0.2, mix: 0.5, spreadAll: 0.5, tremDepth: 0, tremRate: 4, fxTime: 300, fxFb: 0.35, fxMix: 0, macro: 0.5, macroAuto: 0, macroPeriod: 4, ott: 0.4, comp: 0.5, volume: 0.4 };
  const p = Object.assign({}, DEFAULTS);
  const PCT = (v) => Math.round(v * 100) + '%';
  const KNOBS_MOD = [                  // ふだん使うつまみ(揺れに関するもの。右の図に動きが出る)
    ['delayMs', '遅れ', 3, 40, (v) => v.toFixed(1) + 'ミリ秒', true],
    ['depthMs', '揺れの深さ', 0, 20, (v) => v.toFixed(1) + 'ミリ秒'],
    ['rate', '揺れの速さ', 0.05, 60, (v) => v.toFixed(2) + '回/秒', true],
    ['spreadAll', 'ばらつき(段ごとの違い)', 0, 1, PCT],
  ];
  const KNOBS_FINE = [                 // 「もっと細かく」: ばらつきの内訳
    ['spread', '速さのばらつき', 0, 1, (v) => Math.round(v * 100) + '%'],
    ['spreadDepth', '深さのばらつき', 0, 1, (v) => Math.round(v * 100) + '%'],
    ['spreadDelay', '遅れのばらつき', 0, 1, (v) => Math.round(v * 100) + '%'],
    ['spreadPhase', '出だしのばらつき', 0, 1, (v) => Math.round(v * 100) + '%'],
  ];
  const KNOBS_MACRO = [                // マクロ: 全段の「速さ・深さ・遅れ」を、1本で同時に動かす
    ['macro', 'マクロ(全段をまとめて動かす)', 0, 1, PCT],
  ];
  const KNOBS_MACRO2 = [
    ['macroAuto', '自動で往復させる幅', 0, 1, (v) => v < 0.02 ? '止める' : Math.round(v * 100) + '%'],
    ['macroPeriod', '往復の周期', 0.5, 30, (v) => v.toFixed(1) + '秒', true],
  ];
  const KNOBS_OUT = [
    ['feedback', 'フィードバック', 0, 0.95, PCT],
    ['mix', '混ぜる量', 0, 1, PCT],
    ['volume', '音量', 0, 1, PCT],
  ];
  const KNOBS_FX = [                   // コーラスの後ろにつなぐ、ふつうのディレイ(エコー)
    ['fxMix', 'ディレイの量', 0, 1, (v) => v < 0.02 ? 'なし' : PCT(v)],
    ['fxTime', 'ディレイの間隔', 20, 1000, (v) => Math.round(v) + 'ミリ秒', true],
    ['fxFb', 'ディレイのくり返し', 0, 0.9, PCT],
  ];
  const KNOBS_TREM = [                 // 音量を、波のように大きく・小さくする(トレモロ)
    ['tremDepth', '音量の波の深さ', 0, 1, (v) => v < 0.02 ? 'なし' : PCT(v)],
    ['tremRate', '音量の波の速さ', 0.1, 40, (v) => v.toFixed(2) + '回/秒', true],
  ];
  const KNOBS_COMP = [
    ['ott', 'OTT風(3帯域の圧縮)', 0, 1, (v) => v < 0.02 ? 'なし' : PCT(v)],
    ['comp', 'コンプの強さ', 0, 1, (v) => v < 0.02 ? 'なし' : PCT(v)],
  ];
  const KNOBS = KNOBS_MOD.concat(KNOBS_FINE, KNOBS_MACRO, KNOBS_MACRO2, KNOBS_OUT, KNOBS_FX, KNOBS_TREM, KNOBS_COMP);
  const SOURCES = [['sine', 'サイン波(ひとつの高さ)'], ['file', '自分の音のファイル']];                 // 基本の2つ
  const OTHERS = [['chord', 'のこぎり波の和音'], ['pluck', 'ポロンと鳴るくり返し'], ['noise', 'ノイズ']];   // ほかの音(ドロップダウン)
  let source = 'sine', fileBuf = null;
  let seeds = [];                     // 段ごとの揺れの速さのばらつき(-1〜1)
  let seedsX = [];                    // 追加した波ごとの、段ごとのばらつき
  const MAXX = 6;                     // 追加できる波の数
  let seedsD = [], seedsL = [], seedsP = [];   // 段ごとの、深さ・遅れ・出だしのばらつき(-1〜1)。seedsP は波ごとにも持つ
  const rnd64 = () => Array.from({ length: 64 }, () => Math.random() * 2 - 1);
  const reseed = () => { seeds = rnd64(); seedsX = Array.from({ length: MAXX }, rnd64); seedsD = rnd64(); seedsL = rnd64(); seedsP = Array.from({ length: MAXX + 1 }, rnd64); };
  const extra = [];                   // 追加した波: { rate(回/秒), depth(ミリ秒) }
  const NEWWAVE = () => ({ rate: 0.2, depth: 4 });
  // s段めの設定(音も図も、これを使う)。DAWで、コーラスを1つずつ別の設定にして重ねた感じ:
  //   速さ=基本の速さ × 2^(ばらつき×2)、深さ・遅れ=基本 × 2^(ばらつき)、出だし=ばらつき100%で、波の位置が円1周ぶんばらばら
  //   揺れの深さが大きすぎて、遅れの時間が0より小さくならないように、その段の波を、同じ割合で小さくする
  // マクロ(0〜1。真ん中の50%=変えない)。全段の、速さ(×1/4〜×4)・深さ(×0〜×2)・遅れ(×1/2〜×2)を、同じ向きに、同時に動かす。
  // 「自動で往復」は、マクロの値を、周期ごとに、真ん中のまわりで往復させる(t=秒)
  const macroVal = (t) => Math.max(0, Math.min(1, p.macro + 0.5 * p.macroAuto * Math.sin(2 * Math.PI * t / p.macroPeriod)));
  function stageSet(s, m) {
    if (m === undefined) m = macroVal(performance.now() / 1000);
    const mr = Math.pow(2, (m - 0.5) * 4), md = m * 2, ml = Math.pow(2, (m - 0.5) * 2);
    const sd = Math.pow(2, seedsD[s] * p.spreadDepth) * md, delay = Math.max(1.5, Math.min(40, p.delayMs * ml * Math.pow(2, seedsL[s] * p.spreadDelay)));
    const waves = [{ rate: p.rate * mr * Math.pow(2, seeds[s] * p.spread * 2), depth: p.depthMs * sd, ph: seedsP[0][s] * Math.PI * p.spreadPhase }];
    extra.forEach((w, k) => waves.push({ rate: w.rate * mr * Math.pow(2, seedsX[k][s] * p.spread * 2), depth: w.depth * sd, ph: seedsP[k + 1][s] * Math.PI * p.spreadPhase }));
    const tot = waves.reduce((a, w) => a + w.depth, 0), lim = delay - 0.5, sc = tot > lim && tot > 0 ? lim / tot : 1;
    waves.forEach((w) => { w.depth *= sc; });
    return { delay, waves, sc };
  }
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
  function build(c, dest, t0, mt0) {
    if (mt0 === undefined) mt0 = performance.now() / 1000;
    const src = c.createBufferSource(); src.buffer = makeSource(c); src.loop = true;
    let node = src;
    const n = Math.round(p.stages);
    const keep = [], st = [], nWaves = extra.length;
    for (let s = 0; s < n; s++) {
      const input = c.createGain(), outG = c.createGain(), dry = c.createGain(), wet = c.createGain();
      const delay = c.createDelay(0.2), fb = c.createGain();
      const S = stageSet(s, macroVal(mt0)), ws = [];
      delay.delayTime.value = S.delay / 1000;
      S.waves.forEach((w) => {                               // 波ごとに、LFO(出だしの位置つき)を作って、遅れの時間に足す
        const o = c.createOscillator(), a = c.createGain();
        o.setPeriodicWave(c.createPeriodicWave(new Float32Array([0, Math.sin(w.ph)]), new Float32Array([0, Math.cos(w.ph)]), { disableNormalization: true }));
        o.frequency.value = w.rate; a.gain.value = w.depth / 1000;
        o.connect(a); a.connect(delay.delayTime); o.start(t0); keep.push(o); ws.push({ o, a });
      });
      st.push({ delay, fb, dry, wet, ws });
      dry.gain.value = 1 - p.mix; wet.gain.value = p.mix; fb.gain.value = p.feedback;
      node.connect(input);
      input.connect(dry); input.connect(delay);
      delay.connect(wet); delay.connect(fb); fb.connect(delay);
      dry.connect(outG); wet.connect(outG);
      node = outG;
    }
    // ディレイ(エコー): コーラスの後ろ。量0%で、音に影響しない
    const fxDry = c.createGain(), fxWet = c.createGain(), fxD = c.createDelay(1.2), fxFb = c.createGain(), fxOut = c.createGain();
    fxD.delayTime.value = p.fxTime / 1000; fxFb.gain.value = p.fxFb; fxDry.gain.value = 1; fxWet.gain.value = p.fxMix;
    node.connect(fxDry); node.connect(fxD); fxD.connect(fxWet); fxD.connect(fxFb); fxFb.connect(fxD);
    fxDry.connect(fxOut); fxWet.connect(fxOut); node = fxOut;
    // OTT風: 低・中・高の3帯域に分け、帯域ごとに強く圧縮して(小さい音も持ち上がる)、足し戻す
    const ottIn = c.createGain(), ottOut = c.createGain(), ottC = [];
    node.connect(ottIn);
    const lr = (type, f, from) => { const a = c.createBiquadFilter(), b = c.createBiquadFilter(); a.type = b.type = type; a.frequency.value = b.frequency.value = f; a.Q.value = b.Q.value = 0.7071; from.connect(a); a.connect(b); return b; };
    const low = lr('lowpass', 200, ottIn), mid = lr('lowpass', 2500, lr('highpass', 200, ottIn)), high = lr('highpass', 2500, ottIn);
    [low, mid, high].forEach((bandOut) => {
      const bc = c.createDynamicsCompressor(); bc.knee.value = 6; bc.attack.value = 0.003; bc.release.value = 0.1;
      bc.threshold.value = -p.ott * 45; bc.ratio.value = 1 + p.ott * 19;
      bandOut.connect(bc); bc.connect(ottOut); ottC.push(bc);
    });
    node = ottOut;
    // コンプ: 強さ1本で、しきい値・圧縮比をまとめて決める(0=なし、1=強い)
    const comp = c.createDynamicsCompressor();
    const thr = -p.comp * 40, ratio = 1 + p.comp * 11;
    comp.threshold.value = thr; comp.ratio.value = ratio; comp.knee.value = 12; comp.attack.value = 0.005; comp.release.value = 0.15;
    node.connect(comp); node = comp;                          // (ブラウザのコンプは、小さくなった分を自動で戻す)
    // 音量の波(トレモロ): 音量を、1 − 深さ/2 を中心に、深さ/2 だけ、波で上下させる(深さ0%で、変わらない)
    const tg = c.createGain(), to_ = c.createOscillator(), ta = c.createGain();
    tg.gain.value = 1 - p.tremDepth / 2; to_.frequency.value = p.tremRate; ta.gain.value = p.tremDepth / 2;
    to_.connect(ta); ta.connect(tg.gain); to_.start(t0); keep.push(to_);
    node.connect(tg); node = tg;
    const vol = c.createGain(); vol.gain.value = p.volume;
    const lim = c.createDynamicsCompressor();                 // 重ねて大きくなりすぎるのを抑える
    lim.threshold.value = -6; lim.ratio.value = 20; lim.attack.value = 0.002; lim.release.value = 0.1;
    node.connect(vol); vol.connect(lim); lim.connect(dest);
    src.start(t0);
    if (c instanceof OfflineAudioContext && p.macroAuto >= 0.02) {      // 書き出しでは、自動の往復を、0.02秒ごとの値として書き込む
      for (let t = 0; t < 10; t += 0.02) {
        const m = macroVal(mt0 + t);
        st.forEach((o, s) => {
          const S = stageSet(s, m);
          o.delay.delayTime.setValueAtTime(S.delay / 1000, t);
          S.waves.forEach((w, k) => { o.ws[k].o.frequency.setValueAtTime(w.rate, t); o.ws[k].a.gain.setValueAtTime(w.depth / 1000, t); });
        });
      }
    }
    // 鳴らしたまま、つまみの値だけを、なめらかに変える(音を鳴らし直さない)。段数や元の音を変えたときは使えない。
    const apply = () => {
      if (extra.length !== nWaves) return false;
      const now = c.currentTime, tc = 0.03, mnow = macroVal(performance.now() / 1000), to = (param, v) => param.setTargetAtTime(v, now, tc);
      st.forEach((o, s) => {
        const S = stageSet(s, mnow);
        to(o.delay.delayTime, S.delay / 1000);
        S.waves.forEach((w, k) => { to(o.ws[k].o.frequency, w.rate); to(o.ws[k].a.gain, w.depth / 1000); });
        to(o.fb.gain, p.feedback); to(o.dry.gain, 1 - p.mix); to(o.wet.gain, p.mix);
      });
      to(fxD.delayTime, p.fxTime / 1000); to(fxFb.gain, p.fxFb); to(fxWet.gain, p.fxMix);
      ottC.forEach((bc) => { to(bc.threshold, -p.ott * 45); to(bc.ratio, 1 + p.ott * 19); });
      to(comp.threshold, -p.comp * 40); to(comp.ratio, 1 + p.comp * 11);
      to(vol.gain, p.volume); to(tg.gain, 1 - p.tremDepth / 2); to(ta.gain, p.tremDepth / 2); to(to_.frequency, p.tremRate);
      return true;
    };
    return { comp, apply, stop: () => { try { src.stop(); keep.forEach((l) => l.stop()); } catch (e) {} vol.disconnect(); } };
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
  setInterval(() => { if (running && running.apply && p.macroAuto >= 0.02) running.apply(); }, 50);   // 自動の往復は、鳴らしたまま、少しずつ動かす
  const LIVE = new Set(['tremDepth', 'tremRate', 'fxMix', 'fxTime', 'fxFb', 'spreadAll', 'macro', 'macroAuto', 'macroPeriod', 'ott', 'delayMs', 'depthMs', 'rate', 'spread', 'spreadDepth', 'spreadDelay', 'feedback', 'mix', 'comp', 'volume', 'depth']);
  function liveChanged(key) {         // 値だけ変えられるつまみは、鳴らしたまま変える。それ以外は、組み直す
    if (running && LIVE.has(key) && running.apply && running.apply()) return;
    changed();
  }
  function changed() {                // 段数・元の音・波の数を変えたら、鳴っている音を組み直す
    if (!running) return;
    clearTimeout(rebuildTimer);
    rebuildTimer = setTimeout(play, 80);
  }

  async function save() {
    const rate = 44100, oc = new OfflineAudioContext(2, rate * 10, rate);
    $('status').textContent = '書き出し中…';
    build(oc, oc.destination, 0, 0);
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
      let minSc = 1;                                              // 実際の音と同じ計算(stageSet)
      const now = performance.now() / 1000, n = Math.round(p.stages), shown = Math.min(n, SHOW);
      g.strokeStyle = fg; g.lineWidth = 1.4 * dpr; g.lineJoin = 'round';
      const steps = Math.max(2, Math.floor((W - padL - padR) / (dpr * 0.5)));
      for (let s = 0; s < shown; s++) {
        const S = stageSet(s); minSc = Math.min(minSc, S.sc);
        g.globalAlpha = shown === 1 ? 1 : Math.max(0.28, 0.85 - s * 0.03);
        g.beginPath();
        for (let i = 0; i <= steps; i++) {
          const f = i / steps, t = now - (1 - f) * WIN;
          let d = S.delay; for (const w of S.waves) d += w.depth * Math.sin(2 * Math.PI * w.rate * t + w.ph);
          i ? g.lineTo(X(f), Y(d)) : g.moveTo(X(f), Y(d));
        }
        g.stroke();
      }
      g.globalAlpha = 1;
      $('lfoNote').textContent = '遅れの時間が、段ごとにどう揺れているか。' + (n > SHOW ? '(' + n + '段のうち、' + SHOW + '段を表示)' : '(' + n + '段)') + '線の数=段数、波の高さ=揺れの深さ、波の細かさ=揺れの速さ、線ごとの違い=ばらつき。' + (extra.length ? '追加した波は、足し算した形で出ている。' : '') + (minSc < 0.995 ? ' ※深さの合計が「遅れ」に収まらない段があるので、その段の波を、最大' + Math.round((1 - minSc) * 100) + '%小さくしている(遅れを大きくすると、小さくならない)。' : '');
      requestAnimationFrame(frame);
    })();
  }

  // ---- 画面 ----
  for (const [k, label] of SOURCES) {
    const l = document.createElement('label');
    l.innerHTML = '<input type="radio" name="src"> ' + label;
    const r = l.querySelector('input'); r.checked = source === k;
    r.onchange = () => { source = k; $('otherSrc').value = ''; $('filerow').hidden = k !== 'file'; if (k !== 'file' || fileBuf) changed(); };
    $('sources').appendChild(l);
  }
  for (const [k, label] of OTHERS) { const o = document.createElement('option'); o.value = k; o.textContent = label; $('otherSrc').appendChild(o); }
  $('otherSrc').onchange = (e) => {         // ほかの音を選んだら、上の2つの選択は外す
    if (!e.target.value) return;
    source = e.target.value; $('filerow').hidden = true;
    document.querySelectorAll('#sources input').forEach((r) => { r.checked = false; });
    changed();
  };
  $('file').onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    ensure();
    try {
      fileBuf = await ctx.decodeAudioData(await f.arrayBuffer());
      $('status').textContent = '読み込みました: ' + f.name;
      play();
    } catch (err) { $('status').textContent = '読めませんでした(' + f.name + ')'; }
  };
  let resyncFine = () => {};
  const modChanged = (key) => {                 // 「ばらつき」1本で、細かい4つを、まとめて決める
    if (key === 'spreadAll') {
      const m = p.spreadAll;
      p.spread = m; p.spreadDepth = m; p.spreadDelay = Math.min(1, m * 0.6); p.spreadPhase = Math.min(1, m * 2);
      resyncFine();
      return liveChanged('spread');
    }
    liveChanged(key);
  };
  const resyncMod = buildKnobs($('knobsMod'), KNOBS_MOD, p, modChanged);
  resyncFine = buildKnobs($('knobsFine'), KNOBS_FINE, p, liveChanged);
  const fineEdited = (key) => liveChanged(key);
  const resyncMacro = buildKnobs($('knobsMacro'), KNOBS_MACRO, p, liveChanged);
  const resyncMacro2 = buildKnobs($('knobsMacro2'), KNOBS_MACRO2, p, liveChanged);
  const resyncOut = buildKnobs($('knobs'), KNOBS_OUT, p, liveChanged);
  const resyncFx = buildKnobs($('knobsFx'), KNOBS_FX, p, liveChanged);
  const resyncTrem = buildKnobs($('knobsTrem'), KNOBS_TREM, p, liveChanged);
  const resyncComp = buildKnobs($('knobsComp'), KNOBS_COMP, p, liveChanged);
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
      buildKnobs(kb, WAVEKNOBS, w, liveChanged);
      row.append(head, kb); box.appendChild(row);
    });
    $('addWave').disabled = extra.length >= MAXX;
  }
  $('addWave').onclick = () => { if (extra.length < MAXX) { extra.push(NEWWAVE()); renderWaves(); changed(); } };
  const resync = () => { resyncMod(); resyncFine(); resyncMacro(); resyncMacro2(); resyncFx(); resyncTrem(); resyncComp(); resyncOut(); showStages(); renderWaves(); };
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
      if (key === 'volume' || key === 'comp' || key === 'ott' || key === 'macroAuto' || key === 'spreadAll' || key.startsWith('fx') || key.startsWith('trem')) continue;   // 音量とコンプは、でたらめにしない(安全のため、いまの設定のまま)
      const s = Math.random();
      p[key] = log ? min * Math.pow(max / min, s) : min + s * (max - min);
    }
    for (const w of extra) { w.rate = 0.02 * Math.pow(60 / 0.02, Math.random()); w.depth = Math.random() * 20; }
    p.stages = 1 + Math.floor(Math.random() * 64);
    p.spreadAll = p.spread;
    reseed(); resync(); play();
  };
  $('reset').onclick = () => { Object.assign(p, DEFAULTS); extra.length = 0; resync(); changed(); };
})();
