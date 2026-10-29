// なみを たすと: 2つの波を たす(つよめあう・うちけしあう・うなり)/ 倍音を ふやして、のこぎり波・しかく波・さんかく波を つくる
(() => {
  const $ = (id) => document.getElementById(id);
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
  const coef = (w, n) => {                                        // n ばいおん の つよさ
    if (w === 'sine') return n === 1 ? 1 : 0;
    if (w === 'sawtooth') return (n % 2 ? 1 : -1) / n * 2 / Math.PI;
    if (w === 'square') return n % 2 ? 4 / (Math.PI * n) : 0;
    if (w === 'triangle') return n % 2 ? 8 / (Math.PI * Math.PI * n * n) * (((n - 1) / 2) % 2 ? -1 : 1) : 0;
    return 1;                                                      // ノイズ: どの たかさも おなじ
  };


  const TAU = Math.PI * 2;
  const st = { ratio: 1, phase: 0, ampB: 0, playing1: false, target: 'sawtooth', n: 1, playing2: false, auto: false };
  const BASE = 220;

  // ---- おんせい ----
  let ctx = null, out = null;
  function ensure() { if (ctx) return; ctx = new (window.AudioContext || window.webkitAudioContext)(); out = ctx.createGain(); out.gain.value = 0.2; out.connect(ctx.destination); }
  let s1 = null;                                                    // ① A, B, delay
  function stop1() { if (!s1) return; s1.forEach((o) => { try { o.stop && o.stop(); } catch (e) { /* もう とまっている */ } o.disconnect(); }); s1 = null; }
  function bWave() {                                              // B: ずれ(いそう)を ふくんだ サイン波 sin(wt + φ)
    const re = new Float32Array(2), im = new Float32Array(2), p = st.phase * Math.PI / 180;
    re[1] = Math.sin(p); im[1] = Math.cos(p);
    return ctx.createPeriodicWave(re, im, { disableNormalization: true });
  }
  function start1() {
    ensure(); if (ctx.state === 'suspended') ctx.resume(); stop1();
    const a = ctx.createOscillator(), b = ctx.createOscillator(), g = ctx.createGain();
    a.frequency.value = BASE; b.frequency.value = BASE * st.ratio; b.setPeriodicWave(bWave()); g.gain.value = st.ampB;
    const ga = ctx.createGain(); ga.gain.value = 0.5; const gb = ctx.createGain(); gb.gain.value = 0.5;
    a.connect(ga); ga.connect(out); b.connect(g); g.connect(gb); gb.connect(out);
    a.start(); b.start(); s1 = [a, b, g, ga, gb]; s1.g = g; s1.b = b;
  }
  function apply1() { if (!s1) return; const t = ctx.currentTime; s1.b.setPeriodicWave(bWave()); s1.g.gain.setTargetAtTime(st.ampB, t, 0.02); s1.b.frequency.setTargetAtTime(BASE * st.ratio, t, 0.02); }
  let s2 = null, lastN = 0, lastT = '';
  function stop2() { if (!s2) return; try { s2.stop(); } catch (e) { /* もう とまっている */ } s2.disconnect(); s2 = null; }
  function start2() {
    ensure(); if (ctx.state === 'suspended') ctx.resume(); stop2();
    const real = new Float32Array(N + 1), imag = new Float32Array(N + 1);
    for (let k = 1; k <= st.n; k++) imag[k] = coef(st.target, k);
    const o = ctx.createOscillator(); o.setPeriodicWave(ctx.createPeriodicWave(real, imag, { disableNormalization: true }));
    o.frequency.value = BASE; const g = ctx.createGain(); g.gain.value = 0.9; o.connect(g); g.connect(out); o.start(); s2 = o; s2.disconnect = ((orig) => () => { orig.call(o); g.disconnect(); })(o.disconnect);
  }
  function wave2() { if (st.playing2) start2(); }
  const N = 24;

  // ---- え ----
  function setup(c) { const dpr = devicePixelRatio || 1, W = c.clientWidth, H = c.clientHeight; if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); } const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H); return [g, W, H]; }
  const label = (g, t, x, y, color, align, base) => { g.fillStyle = color || '#8a6a3a'; g.font = '11px sans-serif'; g.textAlign = align || 'left'; g.textBaseline = base || 'top'; g.fillText(t, x, y); };
  function line(g, W, H, amp, fn, color, lw, dash) {
    g.strokeStyle = color; g.lineWidth = lw; g.lineJoin = 'round'; g.setLineDash(dash || []); g.beginPath();
    const mid = H / 2, S = (H / 2 - 10) / amp;
    for (let i = 0; i <= 300; i++) { const x = 6 + (i / 300) * (W - 12), y = mid - fn(i / 300) * S; i ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.stroke(); g.setLineDash([]);
  }
  function grid(g, W, H) { g.strokeStyle = 'rgba(122,75,0,.2)'; g.lineWidth = 1; g.beginPath(); g.moveTo(6, H / 2); g.lineTo(W - 6, H / 2); g.stroke(); }

  // ① 2つの なみを たす
  const CYC = 4;                                                    // がめんに でる A の なみの かず
  const DISP = { 1: 1, 2: 2, 3: 3, 1.1: 1.1 };
  function cycB() { return CYC * st.ratio; }
  function draw1() {
    const [g, W, H] = setup($('cv1')); grid(g, W, H);
    const A = (u) => Math.sin(TAU * CYC * u), B = (u) => st.ampB * Math.sin(TAU * (cycB() * u - st.phase / 360));
    line(g, W, H, 2, A, '#5b8def', 2, [5, 4]); line(g, W, H, 2, B, '#38b26a', 2, [5, 4]);
    line(g, W, H, 2, (u) => A(u) + B(u), '#ff7a3d', 4);
    label(g, 'A', 8, 4, '#5b8def'); label(g, 'B', 24, 4, '#38b26a'); label(g, 'A + B', 44, 4, '#ff7a3d');
  }
  // ふわりんの おなかの なみ(n しゅうき)
  [1, 2, 3].forEach((n) => { let d = ''; for (let i = 0; i <= 40; i++) d += (i ? 'L' : 'M') + i + ' ' + (8 - 6 * Math.sin(Math.PI * 2 * n * i / 40)).toFixed(1) + ' '; WP['s' + n] = d; });
  const fw = (n) => Object.assign({}, cOf('sine'), { w: 's' + n });
  function updateBpic() {
    const el = $('bpic'); if (!el) return;
    const s = st.ampB, size = 14 + 46 * s, cyc = st.ratio >= 2 ? st.ratio : 1;
    el.innerHTML = '<div class="bp"><div style="width:60px">' + charSvg(fw(1)) + '</div><small>A</small></div><span class="op">+</span>' +
      '<div class="bp"><div style="width:60px;height:62px;display:flex;align-items:center;justify-content:center"><div style="width:' + size + 'px;opacity:' + (s < 0.02 ? 0.25 : 1) + ';transform:rotate(' + st.phase + 'deg);transform-origin:center center">' + charSvg(fw(cyc)) + '</div></div><small>B' + (st.ratio === 1.1 ? '(A より ほんの すこし たかい)' : '') + '</small></div>' +
      '<div class="bphint"><div>🔊 <b>おおきさ</b> = ふわりんの おおきさ</div><div>🎵 <b>たかさ</b> = おなかの なみの かず</div><div>⏱ <b>ずれ</b> = ふわりんの むき(いちばん みぎで さかさま = ぎゃくの タイミング)</div></div>';
  }
  function note1() {
    updateBpic();
    let c, t;
    if (st.ampB < 0.02) { c = 'A だけ(サイン波)'; t = 'まだ B は ならして いない。「Bの おおきさ」を あげて、たしてみよう。'; }
    else if (st.ratio === 1.1) { c = 'うなり'; t = 'たかさが ほんの すこし ちがうと、つよめあう ところと うちけしあう ところが こうごに きて、おおきく なったり ちいさく なったり(うなり)。(※ ずが みやすいように、ゆっくりに してあるよ)'; }
    else if (st.ratio !== 1) { c = 'たかさが ちがう'; t = 'ちがう たかさの なみを たすと、ぎざぎざした べつの かたちの なみに なる。これが、いろいろな おとが まざる しくみ。'; }
    else {
      const m = Math.abs(2 * st.ampB * Math.cos(Math.PI * st.phase / 360));
      const sz = Math.abs(1 + st.ampB * Math.cos(TAU * st.phase / 360));
      if (st.phase < 15 || st.phase > 345) { c = 'つよめあう'; t = 'ぴったり おなじ タイミングだと、ぜんぶ かさなって、おおきな なみに なる。'; }
      else if (Math.abs(st.phase - 180) < 15) { c = st.ampB > 0.9 ? 'うちけしあう' : 'へる'; t = st.ampB > 0.9 ? 'はんたいの タイミングだと、うえと したが ぶつかって きえてしまう。おとも ほとんど きこえなくなるよ!' : 'はんたいの タイミングだと、おおきさが へる。'; }
      else { c = 'ちょっと ずれてる'; t = 'ずれるほど、おおきさが かわる。0°で いちばん おおきく、180°で いちばん ちいさい。'; }
      c += '(いまの おおきさ: ' + Math.round(sz / (1 + st.ampB) * 100) + '%)';
    }
    $('note1').innerHTML = '<div class="cav">' + charSvg(cOf('sine')) + '</div><div class="ct"><b>' + c + '</b><div>' + t + '</div></div>';
  }

  // ② 倍音を ふやす
  const sumWave = (w, n, u) => { let s = 0; for (let k = 1; k <= n; k++) s += coef(w, k) * Math.sin(TAU * u * k * 2); return s; };   // 2しゅうき ぶん
  function draw2() {
    const [g, W, H] = setup($('cv2')); grid(g, W, H);
    const w = st.target, amp = w === 'sawtooth' ? 0.7 : w === 'square' ? 1.27 : 0.85;
    line(g, W, H, amp * 1.15, (u) => sumWave(w, N * 4, u), 'rgba(122,75,0,.45)', 1.5, [3, 3]);        // おてほん
    if (st.n > 1) line(g, W, H, amp * 1.15, (u) => coef(w, st.n) * Math.sin(TAU * u * st.n * 2), '#5b8def', 1.5);   // いま たした なみ
    line(g, W, H, amp * 1.15, (u) => sumWave(w, st.n, u), '#ff7a3d', 4);
    label(g, 'おてほん(ぜんぶ たした かたち)', 8, 4, '#8a6a3a'); label(g, 'いま まで たした', 8, 17, '#ff7a3d'); label(g, 'いま たした なみ', 8, 30, '#5b8def');
  }
  function bars2() {
    const [g, W, H] = setup($('cvb')), w = st.target, bw = (W - 12) / N, top = 6, base = H - 20;
    let mx = 1e-9; for (let k = 1; k <= N; k++) mx = Math.max(mx, Math.abs(coef(w, k)));
    g.strokeStyle = 'rgba(122,75,0,.25)'; g.beginPath(); g.moveTo(6, base + .5); g.lineTo(W - 6, base + .5); g.stroke();
    for (let k = 1; k <= N; k++) {
      const a = Math.abs(coef(w, k)) / mx, h = Math.sqrt(a) * (base - top), x = 6 + (k - 1) * bw + 2, on = k <= st.n;
      if (a > 0.001) { g.fillStyle = on ? (k === st.n ? '#5b8def' : '#ff7a3d') : '#e8dcc0'; g.fillRect(x, base - h, bw - 4, h); }
      else { g.fillStyle = '#e8dcc0'; g.fillRect(x, base - 3, bw - 4, 3); }
    }
    label(g, 'ひくい おと', 8, H - 3, '#b39a6a', 'left', 'bottom'); label(g, 'たかい おと', W - 8, H - 3, '#b39a6a', 'right', 'bottom');
  }
  function note2() {
    const w = st.target, tc = cOf(w), n = st.n, key = w + n; if (key === lastT) return; lastT = key;
    let c = tc, who, tx;
    if (n === 1) { c = cOf('sine'); who = 'ふわりん(サイン波)'; tx = 'まず 1ぽんだけ。なめらかな なみ。'; }
    else if (n >= N) { who = tc.name + '(' + tc.sub + ')'; tx = 'ここまで たすと、おてほんと ほとんど おなじ かたちに なった!'; }
    else { who = 'まざってる' + (n >= 8 ? '… ' + tc.name + 'に ちかい!' : ''); tx = n + 'ぽんの なみを たした かたち。たすほど、' + tc.name + 'の かたちに ちかづく。'; }
    $('note2').innerHTML = '<div class="cav">' + charSvg(c) + '</div><div class="ct"><b>' + who + '</b><div>' + tx + '</div></div>';
  }

  // ③ がっき
  const INST = {
    flute: ['🪈', 'フルート', [1, .35, .12, .06, .03, .02], 'ほとんど 1ぽんめ(いちばん ひくい なみ)だけ。ほかは すこし。だから、サイン波に ちかい、やわらかくて すんだ おと。おおきさは、ふわっと はじまって のびる。'],
    piano: ['🎹', 'ピアノ', [1, .85, .55, .35, .3, .12, .05, .15, .1, .04, .05, .03], 'ポーンと たたかれて、だんだん ちいさくなる。たかい 倍音ほど はやく きえるから、はじめは あかるくて、あとは まるい おとに なる。'],
    trumpet: ['🎺', 'トランペット', [.5, 1, .9, .75, .55, .45, .35, .25, .18, .12, .08, .05], 'まんなかへんの 倍音が いちばん つよい。だから、ぴかぴか かがやく、はりのある おと。おおきさは、ぱっと おおきく はじまって、すこし おちつく。'],
    violin: ['🎻', 'バイオリン', [1, .8, .7, .55, .5, .4, .35, .3, .25, .2, .17, .14, .12, .1, .08, .07], 'たかい 倍音まで たくさん つづく。ギザっこ(のこぎり波)に ちかい、ざらっとして あかるい おと。おおきさは、ゆっくり たちあがって、ゆらゆら(ビブラート)する。'],
    organ: ['⛪', 'オルガン', [1, .9, .0, .7, .0, .5, .0, .6], 'えらんだ 倍音(1・2・4・6・8ばん)を、おなじくらい まぜる。ドローバーで じぶんで ふやす しくみが もとに なってる。おおきさは、おすと すぐ なって、ずっと おなじ。はなすと すぐ とまる。'],
  };
  st.inst = 'piano'; st.amps = new Float32Array(N); st.playing3 = false; st.custom = false;
  function loadInst(k) { st.inst = k; st.custom = false; const a = INST[k][2]; for (let i = 0; i < N; i++) st.amps[i] = a[i] || 0; }
  loadInst('piano');
  let s3 = null;
  // がっきごとの おとの うごき: atk=たちあがり(秒) atkT=たかい倍音ほど おくれる ぶん tau=おちつく はやさ hiD=たかい倍音ほど はやく おちる sus=のこる ぶん hiS=たかい倍音で さらに へる rel=はなした あと
  // vib=ビブラート(はやさHz・ふかさ cent・はじまる じかん) scoop=はじめの ずれ(cent) noise=いきの ざらざら
  const ENV = {
    flute: { atk: .07, atkT: .5, tau: .15, hiD: 0, sus: .9, hiS: .3, rel: .15, vib: [5, 7, .35], scoop: 0, noise: .16, nf: 2500, note: 1.2, loop: 2.0 },
    piano: { atk: .002, atkT: 0, tau: .5, hiD: 1.6, sl: .55, sus: 0, hiS: 0, rel: .12, vib: null, scoop: 0, str: .45, beat: 1.4, noise: .9, nf: 900, nsus: 0, ntau: .018, note: 1.9, loop: 2.8 },
    trumpet: { atk: .035, atkT: .25, tau: .25, hiD: .6, sus: .75, hiS: .55, rel: .08, vib: [5, 4, .5], scoop: -45, noise: 0, nf: 0, note: 1.2, loop: 1.9 },
    violin: { atk: .16, atkT: .1, tau: .3, hiD: 0, sus: .9, hiS: .15, rel: .3, vib: [5.5, 14, .4], scoop: -25, noise: .06, nf: 6000, note: 1.3, loop: 2.0 },
    organ: { atk: .006, atkT: 0, tau: 0, hiD: 0, sus: 1, hiS: 0, rel: .02, vib: null, scoop: 0, noise: 0, nf: 0, note: 1.1, loop: 1.8 },
  };
  ENV.custom = ENV.organ;
  const envKey = () => st.custom ? 'custom' : st.inst;
  const susK = (E, k) => E.sus * (1 - E.hiS * (k - 1) / N);
  const atkK = (E, k) => E.atk * (1 + E.atkT * (k - 1));
  const tauK = (E, k) => E.tau / (1 + E.hiD * (k - 1));
  function lvl(E, k, t) {                                              // 1ぽんぶんの おおきさ(0〜1)の うごき
    if (t < 0) return 0; const a = atkK(E, k), sk = susK(E, k);
    const body = (u) => u < a ? u / a : (E.tau > 0 ? sk + (1 - sk) * ((1 - (E.sl || 0)) * Math.exp(-(u - a) / tauK(E, k)) + (E.sl || 0) * Math.exp(-(u - a) / (tauK(E, k) * 5))) : 1);
    if (t < E.note) return body(t);
    return body(E.note) * Math.exp(-(t - E.note) / (E.rel / 3));
  }
  function master() { let s = 0; for (let k = 1; k <= N; k++) s += st.amps[k - 1] * st.amps[k - 1]; return 0.6 / Math.sqrt(Math.max(s, 0.05)) / (ENV[envKey()].beat ? 1.5 : 1); }
  function stop3() { if (!s3) return; clearInterval(s3.timer); clearTimeout(s3.thr); s3.nodes.forEach((n) => { try { n.stop && n.stop(); } catch (e) { /* もう とまっている */ } n.disconnect(); }); s3 = null; }
  function trig() {
    if (!s3) return; const E = ENV[envKey()], t = ctx.currentTime, m = master();
    for (let k = 1; k <= N; k++) {
      const a = st.amps[k - 1] * m, g = s3.gs[k - 1].gain; g.cancelScheduledValues(t); g.setValueAtTime(0, t);
      if (a <= 0.0005) continue;
      const ak = atkK(E, k); g.linearRampToValueAtTime(a, t + ak);
      if (E.tau > 0) { if (E.sl) { const tk = tauK(E, k); g.setTargetAtTime(a * E.sl, t + ak, tk); g.setTargetAtTime(0.0001, t + ak + tk * 3, tk * 5); } else g.setTargetAtTime(Math.max(0.0001, a * susK(E, k)), t + ak, tauK(E, k)); }
      g.setTargetAtTime(0, t + E.note, E.rel / 3);
      const d = s3.os[k - 1].detune; d.cancelScheduledValues(t); const st0 = (E.str || 0) * k * k; s3.gb[k - 1].gain.value = E.beat ? 1 : 0; s3.os2[k - 1].detune.setValueAtTime(st0 + (E.beat || 0) * (1 + 0.04 * k), t); if (E.scoop) { d.setValueAtTime(E.scoop, t); d.linearRampToValueAtTime(0, t + 0.07); } else d.setValueAtTime(st0, t);
    }
    const lg = s3.lg.gain; lg.cancelScheduledValues(t); lg.setValueAtTime(0, t);
    if (E.vib) { s3.l.frequency.value = E.vib[0]; lg.setValueAtTime(0, t + E.vib[2]); lg.linearRampToValueAtTime(E.vib[1], t + E.vib[2] + 0.4); }
    const ng = s3.ng.gain; ng.cancelScheduledValues(t); ng.setValueAtTime(0, t);
    if (E.noise) { s3.nf.frequency.value = E.nf; s3.nf.type = E.nf > 4000 ? 'highpass' : 'bandpass'; ng.linearRampToValueAtTime(E.noise * m * 0.5, t + E.atk); ng.setTargetAtTime(E.noise * m * 0.5 * (E.nsus === undefined ? 0.5 : E.nsus), t + E.atk, E.ntau || 0.1); ng.setTargetAtTime(0, t + E.note, E.rel / 3); }
    s3.t0 = performance.now(); s3.loop = E.loop;
    clearInterval(s3.timer); s3.timer = setInterval(trig, E.loop * 1000);
  }
  function wave3() { if (!s3 || s3.thr) return; s3.thr = setTimeout(() => { if (s3) { s3.thr = 0; trig(); } }, 150); }
  function start3() {
    ensure(); if (ctx.state === 'suspended') ctx.resume(); stop3();
    const nodes = [], os = [], gs = [], os2 = [], gb = [], l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = 5; lg.gain.value = 0; l.connect(lg); l.start(); nodes.push(l, lg);
    for (let k = 1; k <= N; k++) { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = BASE * k; g.gain.value = 0; lg.connect(o.detune); o.connect(g); g.connect(out); o.start(); os.push(o); gs.push(g); nodes.push(o, g); const o2 = ctx.createOscillator(), b2 = ctx.createGain(); o2.frequency.value = BASE * k; b2.gain.value = 0; lg.connect(o2.detune); o2.connect(b2); b2.connect(g); o2.start(); os2.push(o2); gb.push(b2); nodes.push(o2, b2); }
    const nb = ctx.createBufferSource(); nb.buffer = noiseBuf3(); nb.loop = true; const nf = ctx.createBiquadFilter(), ng = ctx.createGain(); ng.gain.value = 0; nb.connect(nf); nf.connect(ng); ng.connect(out); nb.start(); nodes.push(nb, nf, ng);
    s3 = { nodes, os, gs, os2, gb, l, lg, nf, ng, t0: performance.now(), loop: 2 }; trig();
  }
  let nbuf = null;
  function noiseBuf3() { if (nbuf) return nbuf; nbuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); const d = nbuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return nbuf; }
  function draw3() {
    const [g, W, H] = setup($('cv3w')); grid(g, W, H);
    let mx = 1e-6; const f = (u) => { let s = 0; for (let k = 1; k <= N; k++) s += st.amps[k - 1] * Math.sin(TAU * u * k * 2); return s; };
    for (let i = 0; i <= 300; i++) mx = Math.max(mx, Math.abs(f(i / 300)));
    line(g, W, H, mx * 1.1, f, '#ff7a3d', 4); label(g, 'なみの かたち', 8, 4, '#8a6a3a');
    const [g2, W2, H2] = setup($('cv3b')), bw = (W2 - 12) / N, base = H2 - 20, top = 6;
    g2.strokeStyle = 'rgba(122,75,0,.25)'; g2.beginPath(); g2.moveTo(6, base + .5); g2.lineTo(W2 - 6, base + .5); g2.stroke();
    for (let k = 1; k <= N; k++) { const a = st.amps[k - 1], h = a * (base - top), x = 6 + (k - 1) * bw + 2; if (a > 0.01) { g2.fillStyle = '#ff7a3d'; g2.fillRect(x, base - h, bw - 4, h); } else { g2.fillStyle = '#e8dcc0'; g2.fillRect(x, base - 3, bw - 4, 3); } if (k === 1 || k % 4 === 0) label(g2, k, x + (bw - 4) / 2, base + 3, '#b39a6a', 'center'); }
    { const [g3, W3, H3] = setup($('cv3e')), E = ENV[envKey()], LP = E.loop, bs = H3 - 14, tp = 8; g3.strokeStyle = 'rgba(122,75,0,.2)'; g3.beginPath(); g3.moveTo(6, bs + .5); g3.lineTo(W3 - 6, bs + .5); g3.stroke();
      const X = (t) => 6 + (t / LP) * (W3 - 12), tot = (() => { let s = 0; for (let k = 1; k <= N; k++) s += st.amps[k - 1] ** 2; return Math.sqrt(Math.max(s, 1e-6)); })();
      const lv = (t) => { let s = 0; for (let k = 1; k <= N; k++) s += (st.amps[k - 1] * lvl(E, k, t)) ** 2; return Math.sqrt(s) / tot; };
      let pk = 0; for (let i = 0; i <= 200; i++) pk = Math.max(pk, lv((i / 200) * LP)); pk = Math.max(pk, 1e-6);
      g3.strokeStyle = '#38b26a'; g3.lineWidth = 4; g3.lineJoin = 'round'; g3.beginPath();
      for (let i = 0; i <= 200; i++) { const t = (i / 200) * LP, y = bs - (lv(t) / pk) * (bs - tp); i ? g3.lineTo(X(t), y) : g3.moveTo(X(t), y); } g3.stroke();
      label(g3, 'おす', X(0) + 2, H3 - 1, '#b39a6a', 'left', 'bottom'); label(g3, 'はなす', X(E.note), H3 - 1, '#b39a6a', 'center', 'bottom');
      if (s3) { const t = ((performance.now() - s3.t0) / 1000) % LP; g3.fillStyle = '#ff7a3d'; g3.beginPath(); g3.arc(X(t), bs - (lv(t) / pk) * (bs - tp), 7, 0, 7); g3.fill(); } }
    label(g2, 'ひくい おと', 8, 2, '#b39a6a'); label(g2, 'たかい おと →', W2 - 8, 2, '#b39a6a', 'right');
  }
  let lastI = '';
  function note3() { const key = st.custom ? 'c' : st.inst; if (key === lastI) return; lastI = key; $('note3').innerHTML = st.custom ? '<div class="cav" style="font-size:34px;text-align:center">🎛️</div><div class="ct"><b>じぶんの おと</b><div>ぼうを なぞって つくった おと。たかい ぼうを ふやすほど あかるく、へらすと まるく なるよ。</div></div>' : '<div class="cav" style="font-size:34px;text-align:center">' + INST[st.inst][0] + '</div><div class="ct"><b>' + INST[st.inst][1] + '</b><div>' + INST[st.inst][3] + '</div></div>'; }
  function buildInst() {
    $('insts').innerHTML = Object.keys(INST).map((k) => '<button type="button" class="chip' + (!st.custom && st.inst === k ? ' sel' : '') + '" data-k="' + k + '">' + INST[k][0] + ' ' + INST[k][1] + '</button>').join('');
    $('insts').querySelectorAll('.chip').forEach((el) => el.onclick = () => { loadInst(el.dataset.k); lastI = ''; buildInst(); wave3(); });
  }
  (() => {
    const c = $('cv3b'); let down = false;
    const set = (e) => { const r = c.getBoundingClientRect(), k = Math.floor((e.clientX - r.left - 6) / ((r.width - 12) / N)); if (k < 0 || k >= N) return; const v = Math.max(0, Math.min(1, 1 - (e.clientY - r.top - 6) / (r.height - 26))); st.amps[k] = v < 0.03 ? 0 : v; if (!st.custom) { st.custom = true; lastI = ''; buildInst(); } wave3(); };
    c.addEventListener('pointerdown', (e) => { down = true; c.setPointerCapture(e.pointerId); set(e); e.preventDefault(); });
    c.addEventListener('pointermove', (e) => { if (down) set(e); });
    c.addEventListener('pointerup', () => { down = false; }); c.addEventListener('pointercancel', () => { down = false; });
  })();
  $('play3').onclick = () => { st.playing3 = !st.playing3; if (st.playing3) { st.playing1 = false; st.playing2 = false; stop1(); stop2(); ['play1', 'play2'].forEach((i) => { $(i).textContent = '▶ ならす'; $(i).classList.remove('sel'); }); start3(); } else stop3(); $('play3').textContent = st.playing3 ? '■ とめる' : '▶ ならす'; $('play3').classList.toggle('sel', st.playing3); };

  // ---- ようす ----
  let autoT = 0;
  function frame(now) {
    if (st.auto) { const k = Math.floor((now / 600) % (N + 3)); const n = Math.min(N, k + 1); if (n !== st.n) { st.n = n; $('nsl').value = n; $('nOut').textContent = n; wave2(); } }
    draw1(); draw2(); bars2(); note2(); draw3(); note3();
    requestAnimationFrame(frame);
  }

  // ---- はじめに: ふわりんの あつまり ----
  function buildIntro() {
    const f = cOf('sine'), items = [[1, 52], [2, 36], [3, 28], [4, 22], [5, 18]];
    const fam = items.map(([n, w]) => '<div class="fm"><div style="width:' + w + 'px">' + charSvg(f) + '</div><small>' + n + 'ばい</small></div>').join('<span class="op">+</span>');
    $('intro').innerHTML = '<div class="famrow">' + fam + '<span class="op">+ …</span><span class="op">=</span><div class="fm"><div style="width:50px">' + charSvg(cOf('sawtooth')) + '</div><small>ギザっこ</small></div></div>' +
      '<p>どんな おとも、ふわりん(サイン波)が たくさん あつまって できているよ。(ノイズの ザーッも、ぜんぶの たかさの ふわりんが でたらめに まざった もの。)おおきい ふわりんは <b>つよい なみ</b>、ちいさい ふわりんは <b>よわい なみ</b>。ふわりんは 1ばい・2ばい・3ばい…と、だんだん <b>たかい おと</b>に なっていく。どの ふわりんを、どれくらいの おおきさで あつめるかで、ギザっこ・カクゾー・ピアノ…と、ちがう おとに なるんだ。</p>';
  }

  // ---- そうさ ----
  const RATIOS = [['おなじ', 1], ['2ばい', 2], ['3ばい', 3], ['すこしだけ ちがう', 1.1]];
  function build() {
    $('ratios').innerHTML = RATIOS.map(([n, r]) => '<button type="button" class="chip rc' + (st.ratio === r ? ' sel' : '') + '" data-r="' + r + '"><span class="ri">' + charSvg(fw(r >= 2 ? r : 1)) + '</span>' + n + '</button>').join('');
    $('ratios').querySelectorAll('.chip').forEach((el) => el.onclick = () => { st.ratio = +el.dataset.r; if (st.ratio !== 1 && st.phase === 0) { /* そのまま */ } build(); note1(); apply1(); });
    $('targets').innerHTML = ['sawtooth', 'square', 'triangle'].map((w) => { const c = cOf(w); return '<button type="button" class="char' + (st.target === w ? ' sel' : '') + '" data-w="' + w + '">' + charSvg(c) + '<div>' + c.name + '</div><small>' + c.sub + '</small></button>'; }).join('');
    $('targets').querySelectorAll('.char').forEach((el) => el.onclick = () => { st.target = el.dataset.w; lastT = ''; build(); wave2(); });
    note1();
  }
  $('ph').oninput = (e) => { let v = +e.target.value; if (v >= 172) v = 180; else if (v <= 8) v = 0; e.target.value = v; st.phase = v; $('phOut').textContent = st.phase + '°'; note1(); apply1(); };
  $('amp').oninput = (e) => { let v = +e.target.value; if (v >= 94) v = 100; else if (v <= 3) v = 0; e.target.value = v; st.ampB = v / 100; $('ampOut').textContent = Math.round(st.ampB * 100) + '%'; note1(); apply1(); };
  $('nsl').oninput = (e) => { st.auto = false; $('autoBtn').classList.remove('sel'); st.n = +e.target.value; $('nOut').textContent = st.n; wave2(); };
  $('play1').onclick = () => { st.playing1 = !st.playing1; if (st.playing1) { st.playing2 = false; stop2(); st.playing3 = false; stop3(); $('play3').textContent = '▶ ならす'; $('play3').classList.remove('sel'); $('play2').textContent = '▶ ならす'; $('play2').classList.remove('sel'); start1(); } else stop1(); $('play1').textContent = st.playing1 ? '■ とめる' : '▶ ならす'; $('play1').classList.toggle('sel', st.playing1); };
  $('play2').onclick = () => { st.playing2 = !st.playing2; if (st.playing2) { st.playing1 = false; stop1(); st.playing3 = false; stop3(); $('play3').textContent = '▶ ならす'; $('play3').classList.remove('sel'); $('play1').textContent = '▶ ならす'; $('play1').classList.remove('sel'); start2(); } else stop2(); $('play2').textContent = st.playing2 ? '■ とめる' : '▶ ならす'; $('play2').classList.toggle('sel', st.playing2); };
  $('autoBtn').onclick = () => { st.auto = !st.auto; $('autoBtn').classList.toggle('sel', st.auto); };
  buildIntro(); buildInst(); build(); $('phOut').textContent = '0°'; $('ampOut').textContent = '0%'; $('nOut').textContent = '1';
  requestAnimationFrame(frame);
})();
