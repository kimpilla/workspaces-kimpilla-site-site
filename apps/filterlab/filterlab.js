// フィルターの ひみつ: 声(波)を、ローパスフィルターに通して、カーブ・なみ・たかい おとの ぼうで みせる
(() => {
  const $ = (id) => document.getElementById(id);
  // キャラクター(おとあそびシンセと おなじ 4にん + ノイズの ザーッ)
  function starBody(cx, cy, r1, r2, n, fill) {
    let d = '';
    for (let i = 0; i < n * 2; i++) { const a = Math.PI * i / n - Math.PI / 2, r = i % 2 ? r2 : r1; d += (i ? 'L' : 'M') + (cx + r * Math.cos(a)).toFixed(1) + ' ' + (cy + r * Math.sin(a)).toFixed(1); }
    return '<path d="' + d + 'Z" fill="' + fill + '" stroke="' + fill + '" stroke-width="4" stroke-linejoin="round"/>';
  }
  const WP = { sine: 'M0 8 C6 -4 14 -4 20 8 S34 20 40 8', sawtooth: 'M0 14 L18 2 L18 14 L40 2', square: 'M0 14 V2 H13 V14 H27 V2 H40', triangle: 'M0 14 L10 2 L30 14 L40 2', noise: 'M0 8 L4 2 L7 14 L11 5 L15 12 L19 3 L23 13 L27 6 L31 12 L35 4 L40 8' };
  const CHARS = [
    { w: 'sine', name: 'ふわりん', sub: 'サイン波', color: '#ff8fb1', body: '<ellipse cx="50" cy="56" rx="40" ry="35" fill="#ff8fb1"/>', ey: 50, my: 66, wy: 72, ex: 17 },
    { w: 'sawtooth', name: 'ギザっこ', sub: 'のこぎり波', color: '#ffc93c', body: starBody(50, 54, 44, 34, 11, '#ffc93c'), ey: 52, my: 68, wy: 74, ex: 16 },
    { w: 'square', name: 'カクゾー', sub: 'しかく波', color: '#5bb6ff', body: '<rect x="12" y="18" width="76" height="74" rx="8" fill="#5bb6ff"/>', ey: 48, my: 64, wy: 72, ex: 18 },
    { w: 'triangle', name: 'ピョンタ', sub: 'さんかく波', color: '#6bd68c', body: '<path d="M50 12 L90 88 L10 88 Z" fill="#6bd68c" stroke="#6bd68c" stroke-width="8" stroke-linejoin="round"/>', ey: 58, my: 74, wy: 80, ex: 12 },
    { w: 'noise', name: 'ザーッ', sub: 'ノイズ', color: '#a9b4d6', body: starBody(50, 54, 44, 39, 18, '#a9b4d6'), ey: 50, my: 68, wy: 74, ex: 16 },
  ];
  const cOf = (w) => CHARS.find((c) => c.w === w);
  const PROF = {                                                   // プロフィール: せつめいと、倍音の ならび
    sine: ['やさしくて まるい こえ。', 'たかい おと(倍音)は、1つも ない。1ぽんの ぼうだけ。', '倍音: なし'],
    sawtooth: ['ギザギザで ビリビリの あかるい こえ。', '1ばい、2ばい、3ばい…と、ぜんぶの 倍音が ある。たかい ほど、ちいさくなる。', '倍音: ぜんぶ'],
    square: ['しかくくて ロボットみたいな こえ。', '1ばい、3ばい、5ばい…の、きすう(1つとび)の 倍音だけ。2ばい、4ばいは ない。', '倍音: 1つとびだけ'],
    triangle: ['とがってるけど おだやかな こえ。', 'しかくと おなじ 1つとびの 倍音。でも、とても ちいさいので、まるい おとに ちかい。', '倍音: 1つとび(とても ちいさい)'],
    noise: ['ザーッと いう、あめの おとみたいな こえ。', 'ぜんぶの たかさの おとが、おなじ つよさで まざっている。きまった たかさが ない。', '倍音: ぜんぶ おなじ つよさ'],
  };
  function profBars(w) {                                           // 16ほんの ぼう(1ばい〜16ばい)を、SVGで
    const n = 16, W = 320, H = 54, bw = W / n; let mx = 1e-9; for (let k = 1; k <= n; k++) mx = Math.max(mx, Math.abs(coef(w, k)));
    let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" aria-hidden="true"><line x1="0" y1="' + (H - 12) + '" x2="' + W + '" y2="' + (H - 12) + '" stroke="#e4d3a6"/>';
    for (let k = 1; k <= n; k++) {
      const a = Math.abs(coef(w, k)) / mx, h = Math.sqrt(a) * (H - 18), x = (k - 1) * bw + 3;
      if (a > 0.001) s += '<rect x="' + x + '" y="' + (H - 12 - h) + '" width="' + (bw - 6) + '" height="' + h + '" rx="2" fill="#ff7a3d"/>';
      else s += '<rect x="' + x + '" y="' + (H - 15) + '" width="' + (bw - 6) + '" height="3" rx="1.5" fill="#e4d3a6"/>';
      if (k === 1 || k % 4 === 0) s += '<text x="' + (x + (bw - 6) / 2) + '" y="' + (H - 1) + '" font-size="9" text-anchor="middle" fill="#8a6a3a">' + k + '</text>';
    }
    return s + '</svg>';
  }
  const charSvg = (c) => '<svg viewBox="0 0 100 100" aria-hidden="true">' + c.body +
    '<circle cx="' + (50 - c.ex) + '" cy="' + c.ey + '" r="6.5" fill="#fff"/><circle cx="' + (50 + c.ex) + '" cy="' + c.ey + '" r="6.5" fill="#fff"/>' +
    '<circle cx="' + (50 - c.ex) + '" cy="' + (c.ey + 1) + '" r="3" fill="#2b2150"/><circle cx="' + (50 + c.ex) + '" cy="' + (c.ey + 1) + '" r="3" fill="#2b2150"/>' +
    '<polygon class="lid" data-s="l" data-x="' + (50 - c.ex) + '" data-y="' + c.ey + '" points="0,0 0,0 0,0" fill="' + c.color + '"/><polygon class="lid" data-s="r" data-x="' + (50 + c.ex) + '" data-y="' + c.ey + '" points="0,0 0,0 0,0" fill="' + c.color + '"/>' +
    '<ellipse class="mouth" cx="50" cy="' + c.my + '" rx="6" ry="2.6" fill="#7a2b3b"/>' +
    '<g transform="translate(30 ' + c.wy + ')"><path d="' + WP[c.w] + '" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" transform="scale(1 0.9)"/></g></svg>';
  function faceLook(root, bright, sharp) {                         // 口 = あかるさ、目の まぶた = とがり
    const m = root.querySelector('.mouth'); if (m) m.style.transform = 'scaleY(' + (1 + 3.5 * bright).toFixed(2) + ')';
    root.querySelectorAll('.lid').forEach((l) => {
      const x = +l.dataset.x, y = +l.dataset.y, L = l.dataset.s === 'l', top = y - 9, inner = top + 8 * sharp, outer = top + sharp;
      l.setAttribute('points', (x - 9) + ',' + (top - 1) + ' ' + (x + 9) + ',' + (top - 1) + ' ' + (L ? (x + 9) + ',' + inner + ' ' + (x - 9) + ',' + outer : (x + 9) + ',' + outer + ' ' + (x - 9) + ',' + inner));
      l.style.opacity = sharp < 0.04 ? 0 : 1;
    });
  }
  const PITCHES = [['ひくい', 130.8], ['ふつう', 261.6], ['たかい', 523.3]];
  const N = 24;                                                   // たかい おとの ぼうの かず
  const st = { wave: 'sawtooth', pitch: 1, cut: 700, res: 0, wah: false, playing: false };
  const cutHz = () => 80 * Math.pow(12000 / 80, st.cut / 1000);   // あかるさ: 80〜12000Hz(たいすう)
  const qVal = () => 0.7 + (st.res / 1000) * 15.3;                // とがり: Q 0.7〜16
  const f0 = () => PITCHES[st.pitch][1];
  const coef = (w, n) => {                                        // n ばいおん の つよさ
    if (w === 'sine') return n === 1 ? 1 : 0;
    if (w === 'sawtooth') return (n % 2 ? 1 : -1) / n * 2 / Math.PI;
    if (w === 'square') return n % 2 ? 4 / (Math.PI * n) : 0;
    if (w === 'triangle') return n % 2 ? 8 / (Math.PI * Math.PI * n * n) * (((n - 1) / 2) % 2 ? -1 : 1) : 0;
    return 1;                                                      // ノイズ: どの たかさも おなじ
  };

  // ---- おんせい ----
  let ctx = null, filt = null, out = null, src = null, noiseBuf = null;
  function ensure() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    filt = ctx.createBiquadFilter(); filt.type = 'lowpass';
    out = ctx.createGain(); out.gain.value = 0.22;
    filt.connect(out); out.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  function stopSound() { if (src) { try { src.stop(); } catch (e) { /* もう とまっている */ } src.disconnect(); src = null; } }
  function startSound() {
    ensure(); if (ctx.state === 'suspended') ctx.resume();
    stopSound();
    if (st.wave === 'noise') { src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true; }
    else { src = ctx.createOscillator(); src.type = st.wave; src.frequency.value = f0(); }
    src.connect(filt); src.start();
  }
  function applySound(fc) {
    if (!ctx) return;
    const t = ctx.currentTime;
    filt.frequency.setTargetAtTime(fc, t, 0.015); filt.Q.setTargetAtTime(qVal(), t, 0.015);
    if (src && src.frequency) src.frequency.setTargetAtTime(f0(), t, 0.01);
  }

  // ---- ずを かくための ぶんせき用フィルター(おとと おなじ けいさん) ----
  let aCtx = null, aF = null;
  function analysis() {
    if (ctx) return ctx;
    if (!aCtx) aCtx = new (window.AudioContext || window.webkitAudioContext)();
    return aCtx;
  }
  const FN = 220, FMIN = 40, FMAX = 16000;
  const curveF = new Float32Array(FN).map((_, i) => FMIN * Math.pow(FMAX / FMIN, i / (FN - 1)));
  const curveM = new Float32Array(FN), curveP = new Float32Array(FN);
  const hF = new Float32Array(N), hM = new Float32Array(N), hP = new Float32Array(N);
  function responses(fc) {
    const c = analysis(); if (!aF || aF.context !== c) { aF = c.createBiquadFilter(); aF.type = 'lowpass'; }
    aF.frequency.value = Math.min(fc, c.sampleRate / 2 - 100); aF.Q.value = qVal();
    aF.getFrequencyResponse(curveF, curveM, curveP);
    for (let k = 0; k < N; k++) hF[k] = (k + 1) * f0();
    aF.getFrequencyResponse(hF, hM, hP);
  }

  // ---- え ----
  function setup(c) { const dpr = devicePixelRatio || 1, W = c.clientWidth, H = c.clientHeight; if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); } const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H); return [g, W, H]; }
  const label = (g, t, x, y, color, align, base) => { g.fillStyle = color || '#8a6a3a'; g.font = '11px sans-serif'; g.textAlign = align || 'left'; g.textBaseline = base || 'top'; g.fillText(t, x, y); };
  const DBMIN = -42, DBMAX = 24;
  const xOf = (f, W) => (Math.log(f / FMIN) / Math.log(FMAX / FMIN)) * (W - 16) + 8;
  const yOf = (db, H) => 10 + (1 - (Math.max(DBMIN, Math.min(DBMAX, db)) - DBMIN) / (DBMAX - DBMIN)) * (H - 36);

  function drawCurve(fc) { drawCurveOn('cvCurve', fc); drawCurveOn('cvCurve2', fc); }
  function drawCurveOn(id, fc) {
    const [g, W, H] = setup($(id));
    g.strokeStyle = 'rgba(122,75,0,.15)'; g.lineWidth = 1;
    [-36, -24, -12, 0, 12].forEach((db) => { const y = yOf(db, H); g.beginPath(); g.moveTo(8, y); g.lineTo(W - 8, y); g.stroke(); if (db === 0) label(g, '0', 10, y - 12, '#b39a6a'); });
    [100, 1000, 10000].forEach((f) => { const x = xOf(f, W); g.beginPath(); g.moveTo(x, 8); g.lineTo(x, H - 38); g.stroke(); label(g, (f >= 1000 ? (f / 1000) + 'k' : f) + 'Hz', x, H - 36, '#b39a6a', 'center'); });
    g.fillStyle = 'rgba(91,141,239,.18)'; g.strokeStyle = '#5b8def'; g.lineWidth = 3; g.lineJoin = 'round'; g.beginPath();
    for (let i = 0; i < FN; i++) { const x = xOf(curveF[i], W), y = yOf(20 * Math.log10(Math.max(1e-6, curveM[i])), H); i ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.stroke(); g.lineTo(xOf(FMAX, W), H - 26); g.lineTo(xOf(FMIN, W), H - 26); g.closePath(); g.fill();
    const xc = xOf(Math.min(fc, FMAX), W);                                     // おれる いち
    g.setLineDash([4, 3]); g.strokeStyle = '#3b82f6'; g.lineWidth = 2; g.beginPath(); g.moveTo(xc, 8); g.lineTo(xc, H - 26); g.stroke(); g.setLineDash([]);
    label(g, 'おれる ところ ' + Math.round(fc) + 'Hz', Math.min(W - 6, Math.max(6, xc + (xc > W - 120 ? -6 : 6))), 10, '#3b82f6', xc > W - 120 ? 'right' : 'left');
    if (st.wave !== 'noise') for (let k = 0; k < N; k++) {                     // いまの こえの おとの いち
      const a = Math.abs(coef(st.wave, k + 1)); if (a < 0.002) continue;
      const m = Math.max(1e-6, hM[k]), x = xOf(hF[k], W), y = yOf(20 * Math.log10(m), H);
      g.fillStyle = '#ff7a3d'; g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.beginPath(); g.arc(x, y, 3 + 5 * Math.sqrt(a / (st.wave === 'sine' ? 1 : 0.64)) , 0, Math.PI * 2); g.fill(); g.stroke();
    }
    label(g, '← ひくい おと', 10, H - 6, '#b39a6a', 'left', 'bottom'); label(g, 'たかい おと →', W - 10, H - 6, '#b39a6a', 'right', 'bottom');
  }

  function drawWave() {
    const [g, W, H] = setup($('cvWave'));
    if (st.wave === 'noise') { label(g, 'ノイズは ふぞろいな なみなので、かたちは かけないよ(⑥の ぼうで みよう)', 8, H / 2 - 6, '#8a6a3a'); return; }
    const rows = 2, rh = H / rows, cyc = 3, K = N;
    let mx = 1e-9;
    for (let i = 0; i <= 200; i++) { let v = 0; for (let k = 0; k < K; k++) v += coef(st.wave, k + 1) * Math.sin(2 * Math.PI * (k + 1) * cyc * i / 200); mx = Math.max(mx, Math.abs(v)); }
    for (let r = 0; r < rows; r++) {
      const cy = rh * (r + 0.5), amp = rh * 0.38 / mx;
      g.strokeStyle = 'rgba(122,75,0,.15)'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, cy); g.lineTo(W, cy); g.stroke();
      g.strokeStyle = r ? '#ff7a3d' : '#5b8def'; g.lineWidth = 3; g.lineJoin = 'round'; g.beginPath();
      for (let x = 0; x <= W; x += 2) {
        const ph = x / W * cyc; let v = 0;
        for (let k = 0; k < K; k++) { const a = coef(st.wave, k + 1); if (!a) continue; v += r ? a * hM[k] * Math.sin(2 * Math.PI * (k + 1) * ph + hP[k]) : a * Math.sin(2 * Math.PI * (k + 1) * ph); }
        const y = cy - v * amp; x ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      g.stroke();
      label(g, r ? 'あと' : 'まえ', 6, rh * r + 3, r ? '#ff7a3d' : '#5b8def');
    }
  }

  function drawBars() {
    const [g, W, H] = setup($('cvBars'));
    const top = 6, base = H - 22, bh = base - top, bw = (W - 12) / N, noise = st.wave === 'noise';
    let mx = 1e-9; for (let k = 0; k < N; k++) mx = Math.max(mx, Math.abs(coef(st.wave, k + 1)));
    g.strokeStyle = 'rgba(122,75,0,.25)'; g.lineWidth = 1; g.beginPath(); g.moveTo(6, base + 0.5); g.lineTo(W - 6, base + 0.5); g.stroke();
    for (let k = 0; k < N; k++) {
      const a = Math.abs(coef(st.wave, k + 1)) / mx, after = Math.min(1, a * hM[k]), x = 6 + k * bw + 2, sq = (v) => Math.sqrt(v) * bh;
      g.strokeStyle = 'rgba(122,75,0,.5)'; g.lineWidth = 1.5; g.strokeRect(x, base - sq(a), bw - 4, sq(a));
      g.fillStyle = '#ff7a3d'; g.globalAlpha = 0.9; g.fillRect(x, base - sq(after), bw - 4, sq(after)); g.globalAlpha = 1;
    }
    label(g, 'ひくい おと', 8, H - 4, '#b39a6a', 'left', 'bottom'); label(g, 'たかい おと', W - 8, H - 4, '#b39a6a', 'right', 'bottom');
    if (noise) label(g, 'ぜんぶの たかさの おとが おなじ つよさ', W / 2, 4, '#8a6a3a', 'center');
  }

  // ---- カーブの したの ひとこと ----
  const HINT = {
    sine: 'おとが 1つだけ。けずる ものが ないから、あかるさを うごかしても ほとんど かわらない。',
    sawtooth: 'おとが いっぱい。あかるさを さげると、たかい ほうから じゅんばんに きえて、さいごは サイン波に ちかづく。',
    square: 'おとが 1つ とびに ならぶ。さげると、たかい ほうから きえて、まるい おとに なる。',
    triangle: 'たかい おとが もともと よわい。だから、さげても かわり かたは ゆるやか。',
    noise: 'ぜんぶの たかさが まざる。さげると、たかい ところが きえて「ごーっ」と こもる。'
  };
  const WAHFX = { sine: [1, 'たかい おとが ないから、ほとんど きこえない。'], triangle: [2, 'たかい おとが よわいから、ワウワウは ひかえめ。'], square: [4, 'はっきり きこえる。(1つ とびの おと)'], sawtooth: [5, 'おとが いちばん いっぱい。ワウワウが よく きこえる!'], noise: [5, 'ぜんぶの たかさが あるから、「ザーワウワウ」と よく きこえる。'] };
  function updateWahNote() {
    const c = cOf(st.wave), [n, tx] = WAHFX[st.wave];
    $('wnote').innerHTML = '<div class="cav">' + charSvg(c) + '</div><div class="ct"><b>' + c.name + '</b>: ワウワウの きこえやすさ <span style="color:#ff7a3d;letter-spacing:2px">' + '★'.repeat(n) + '</span><span style="color:#d8c9a0;letter-spacing:2px">' + '★'.repeat(5 - n) + '</span><div>' + tx + '</div></div>';
  }
  let lastNote = '';
  function updateNote() {
    const c = cOf(st.wave), noise = st.wave === 'noise';
    const dots = []; let keep = 0, total = 0;
    for (let k = 0; k < N; k++) {
      const present = noise || Math.abs(coef(st.wave, k + 1)) > 0.002;
      if (!present) { dots.push('na'); continue; }
      total++; if (hM[k] > 0.5) { keep++; dots.push('on'); } else dots.push('no');
    }
    let msg;
    if (noise) msg = keep >= N ? 'ぜんぶ とおる' : 'ひくい おとだけ のこる';
    else if (keep === total) msg = 'ぜんぶの おとが とおってる';
    else if (keep === 0) msg = 'ぜんぶ きえた…';
    else if (keep === 1 && dots[0] === 'on') msg = '1つだけ のこった = サイン波!';
    else msg = keep + ' / ' + total + ' こ のこってる';
    const morph = !noise && st.wave !== 'sine' && keep === 1 && dots[0] === 'on', sc = morph ? cOf('sine') : c;
    if (morph) msg = '1つだけ のこった! サイン波に へんしん!';
    const key = st.wave + '|' + dots.join(',') + msg;
    if (key === lastNote) return; lastNote = key;
    $('cnote').innerHTML = '<div class="cav' + (morph ? ' morph' : '') + '">' + charSvg(sc) + '</div><div class="ct"><b>' + sc.name + '</b>: ' + msg + '<div class="hdots">' + dots.map((d) => '<i class="' + d + '"></i>').join('') + '</div><div>' + HINT[st.wave] + '</div></div>';
  }

  // ---- ワウワウの ひとこと ----
  function drawWah(t) {
    const [g, W, H] = setup($('cvWah')), base = cutHz(), pad = 10, top = 22, bot = H - 22;
    const fAt = (ph) => base * Math.pow(2, 1.6 * Math.sin(ph)), lo = base * Math.pow(2, -1.6), hi = base * Math.pow(2, 1.6);
    const yF = (f) => bot - (Math.log(f / lo) / Math.log(hi / lo)) * (bot - top);
    g.strokeStyle = 'rgba(122,75,0,.2)'; g.lineWidth = 1; g.beginPath(); g.moveTo(pad, yF(base)); g.lineTo(W - pad, yF(base)); g.stroke();
    label(g, 'あかるい(くち ひらく)', pad + 2, 4, '#c0561c'); label(g, 'こもる(くち とじる)', pad + 2, H - 4, '#5b8def', 'left', 'bottom');
    g.strokeStyle = '#ff7a3d'; g.lineWidth = 3; g.lineJoin = 'round'; g.beginPath();
    const cyc = 2.5; for (let i = 0; i <= 120; i++) { const ph = (i / 120) * cyc * 2 * Math.PI, x = pad + (i / 120) * (W - 2 * pad), y = yF(fAt(ph)); i ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.stroke();
    const ph = st.wah ? ((t * 1.2) % cyc) * 2 * Math.PI : 0, x = pad + (ph / (cyc * 2 * Math.PI)) * (W - 2 * pad), y = yF(fAt(ph));
    g.fillStyle = st.wah ? '#ff7a3d' : '#c9b88a'; g.strokeStyle = '#fff'; g.lineWidth = 3; g.beginPath(); g.arc(x, y, 9, 0, 7); g.fill(); g.stroke();
    // くち
    const o = (y - top) / (bot - top), my = 1 - o;
    const mx = W - 30; g.fillStyle = '#7a3a3a'; g.beginPath(); g.ellipse(mx, H / 2, 9, 3 + 11 * my, 0, 0, 7); g.fill();
    label(g, st.wah ? '' : '▶ ならして ワウワウを おして みよう', W / 2, H / 2 - 6, '#b39a6a', 'center');
  }

  // ---- ようす ----
  function frame(now) {
    const t = now / 1000, fc = Math.max(40, st.wah ? cutHz() * Math.pow(2, 1.6 * Math.sin(2 * Math.PI * 1.2 * t)) : cutHz());
    responses(fc); applySound(fc);
    drawCurve(fc); drawWave(); drawBars(); updateNote(); drawWah(t);
    { const f = $('stageFace'); if (f.firstChild) faceLook(f, Math.max(0, Math.min(1, Math.log(fc / 80) / Math.log(12000 / 80))), st.res / 1000); }
    requestAnimationFrame(frame);
  }
  function buildChips() {
    $('waves').innerHTML = CHARS.map((c) => '<button type="button" class="char' + (st.wave === c.w ? ' sel' : '') + '" data-w="' + c.w + '">' + charSvg(c) + '<div>' + c.name + '</div><small>' + c.sub + '</small></button>').join('');
    { const c = cOf(st.wave); $('profile').innerHTML = '<div class="prof" style="border-color:' + c.color + '"><div class="pav">' + charSvg(c) + '</div><div><div class="pn">' + c.name + '<small>' + c.sub + '</small></div><div class="pd">' + PROF[c.w][0] + '<br>' + PROF[c.w][1] + '</div></div><div class="pb">' + profBars(c.w) + '</div><div class="ph"><b>' + PROF[c.w][2] + '</b></div></div>'; }
    updateWahNote();
    $('stageFace').innerHTML = charSvg(cOf(st.wave)); $('stageFace').classList.toggle('sing', st.playing); $('stageName').textContent = cOf(st.wave).name;
    $('pitches').innerHTML = '<span style="align-self:center;font-size:13px;color:#8a6a3a">おとの たかさ:</span>' + PITCHES.map(([n], i) => '<button type="button" class="chip' + (st.pitch === i ? ' sel' : '') + '" data-p="' + i + '">' + n + '</button>').join('');
    $('waves').querySelectorAll('.char').forEach((el) => el.onclick = () => { st.wave = el.dataset.w; buildChips(); if (st.playing) startSound(); });
    $('pitches').querySelectorAll('.chip').forEach((el) => el.onclick = () => { st.pitch = +el.dataset.p; buildChips(); });
  }
  const outs = () => { $('cutOut').textContent = Math.round(cutHz()) + ' Hz'; $('resOut').textContent = 'Q ' + qVal().toFixed(1); };
  $('cut').oninput = () => { st.cut = +$('cut').value; outs(); };
  $('res').oninput = () => { st.res = +$('res').value; outs(); };
  document.querySelectorAll('.playb').forEach(b => b.onclick = () => { st.playing = !st.playing; $('stageFace').classList.toggle('sing', st.playing); document.querySelectorAll('.playb').forEach(x => { x.textContent = st.playing ? '■ とめる' : '▶ ならす'; x.classList.toggle('sel', st.playing); }); if (st.playing) startSound(); else stopSound(); });
  $('wahBtn').onclick = () => { st.wah = !st.wah; $('wahBtn').classList.toggle('sel', st.wah); };
  buildChips(); outs();
  requestAnimationFrame(frame);
})();
