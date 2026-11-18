// ピュンピュンマシーン(ダブサイレン)。音はすべてブラウザで合成する(録音の素材なし)
// つまみ・ボタンの並びと働きは、手本の Benidub DS71 の面を写した(四角い波の発振器 → ローパスフィルター → 音量。高さを、ゆれ〈LFO〉と、押したときの上がり下がり〈SWEEP〉で動かす)。
// ゆれの形は、Aが定番の4つ、Bが変わった4つ。B の形と、音の細かい値は仮で、本人が手本と聴き比べて直す。
(() => {
  const $ = (id) => document.getElementById(id);
  const KEY = 'dubsiren-v3';
  const P = { vol: 0.7, decay: 0.35, depth: 0.55, tune: 0.45, sweep: 0.5, rate: 0.4, ftune: 0,
    etime: 0.45, efb: 0.5, emix: 0.45, eon: 1, sel: 0 };
  // 4つのボタンは、それぞれ自分の設定(プリセット)を持つ。押したボタンの設定がつまみに出て、つまみを回すとそのボタンの設定が変わる。
  // VOLUME とエコーは、全部のボタンで共通(本人「ボタンごとの設定を持たせる」2026-11-17。本物の DS71 も、ボタンで中のプリセットを呼び出す)
  const PADKEYS = ['decay', 'tune', 'sweep', 'ftune', 'depth', 'rate'];
  P.pre = [
    { decay: 0.35, tune: 0.45, sweep: 0.5, ftune: 0, depth: 0.55, rate: 0.35 },    // なめらかに上下: ゆっくりの定番
    { decay: 0.25, tune: 0.6, sweep: 0.5, ftune: 0, depth: 0.4, rate: 0.5 },       // 2つの高さ: 高めで、はっきり刻む
    { decay: 0.45, tune: 0.5, sweep: 0.32, ftune: 1, depth: 0.6, rate: 0.55 },     // 上から下へ: 押すと上がっていく
    { decay: 0.55, tune: 0.38, sweep: 0.68, ftune: 1, depth: 0.7, rate: 0.28 },    // 下から上へ: 低めから、押すと下がっていく
  ];
  try { Object.assign(P, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* 保存なしでも動く */ }
  PADKEYS.forEach((k) => { P[k] = P.pre[P.sel][k]; });
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(P)); } catch (e) { /* そのまま */ } };
  const exp = (v, a, b) => a * Math.pow(b / a, v);
  const V = {
    tune: () => exp(P.tune, 70, 1400),              // 発振器の高さ Hz
    rate: () => exp(P.rate, 0.25, 30),              // ゆれの速さ Hz
    depth: () => P.depth * 2400,                    // ゆれの深さ(セント。最大で上下2オクターブ)
    decay: () => exp(P.decay, 0.03, 4),             // 離したあとに消えるまで(秒)
    sweep: () => (0.5 - P.sweep) * 2 * 3600,        // 左(UP)で上がる、右(DOWN)で下がる。まん中(FLAT)は動かない
    etime: () => exp(1 - P.etime, 0.06, 1.0),
  };

  // ---- ゆれの形(1周ぶんを作って、くり返し読む) ----
  const LEN = 1024;
  const SHAPES = [
    (x) => Math.sin(2 * Math.PI * x),                                                     // A1 なめらか
    (x) => (x < 0.5 ? 1 : -1),                                                            // A2 2つの高さ
    (x) => 1 - 2 * x,                                                                     // A3 上から下へ
    (x) => 2 * x - 1,                                                                     // A4 下から上へ
    (x) => (Math.sin(2 * Math.PI * x) + 0.35 * Math.sin(6 * Math.PI * x + 1) + 0.25 * Math.sin(14 * Math.PI * x + 2)) / 1.4,   // B1 よろよろ
    (x) => (x < 0.5 ? 1 : (Math.floor((x - 0.5) * 16) % 2 ? -1 : 0.2)),                    // B2 長い音のあとに細かく刻む
    (x) => 1 - 2 * Math.floor(x * 8) / 7,                                                 // B3 階段で下がる
    (x) => (x < 0.5 ? -1 + 2 * x : -0.3 + 2.6 * (x - 0.5)),                               // B4 2段で上がる
  ];
  const ICONS = ['M2 8 C8 0 12 0 18 8 S28 16 34 8 S44 0 50 8 S60 16 64 8', 'M2 13 H12 V3 H30 V13 H48 V3 H64', 'M2 3 L20 13 V3 L40 13 V3 L60 13', 'M2 13 L20 3 V13 L40 3 V13 L60 3',
    'M2 8 C6 2 9 13 13 6 S20 2 24 9 S30 14 34 7 S42 3 46 10 S56 12 64 6', 'M2 13 V3 H24 V13 H28 V3 H32 V13 H36 V3 H40 V13 H44 V3 H48 V13 H64', 'M2 3 H10 V5 H18 V8 H26 V10 H34 V13 H40 V3 H48 V5 H56 V8 H64', 'M2 13 L18 8 V11 L34 3 V13 L50 8 V11 L64 4'];

  // ---- 音 ----
  let ctx = null, N = null, voice = null, bufs = null, held = null;
  const satCurve = () => { const c = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = i / 511.5 - 1; c[i] = Math.tanh(x * 1.5) / 1.5; } return c; };
  function build() {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    const g = (v) => { const n = ctx.createGain(); n.gain.value = v; return n; };
    bufs = SHAPES.map((f) => { const b = ctx.createBuffer(1, LEN, ctx.sampleRate); const d = b.getChannelData(0); for (let i = 0; i < LEN; i++) d[i] = f(i / LEN); return b; });
    N = {};
    N.osc = ctx.createOscillator(); N.osc.type = 'square'; N.osc.frequency.value = V.tune();
    N.vcf = ctx.createBiquadFilter(); N.vcf.type = 'lowpass'; N.vcf.Q.value = 4;          // 12dB/oct、くせ(レゾナンス)は固定
    N.vca = g(0); N.vol = g(0.6);
    N.sweep = ctx.createConstantSource(); N.sweep.offset.value = 0;                          // SWEEP の上がり下がり(セント)
    N.sweepTune = g(0);                                                                      // FILTER+TUNE のときだけ、高さにもかける
    N.sweep.connect(N.vcf.detune); N.sweep.connect(N.sweepTune).connect(N.osc.detune);
    N.lfoAmt = g(0); N.lfoAmt.connect(N.osc.detune); N.lfoAmt.connect(N.vcf.detune);       // ゆれは、高さとフィルターの両方に(音色が高さについていく)
    N.osc.connect(N.vcf).connect(N.vca).connect(N.vol);
    // エコー(別の箱)
    N.dry = g(1); N.send = g(1); N.delay = ctx.createDelay(2.0);
    N.etone = ctx.createBiquadFilter(); N.etone.type = 'lowpass'; N.etone.frequency.value = 3500;
    N.ehp = ctx.createBiquadFilter(); N.ehp.type = 'highpass'; N.ehp.frequency.value = 120;
    N.sat = ctx.createWaveShaper(); N.sat.curve = satCurve(); N.fb = g(0); N.wet = g(0);
    N.out = ctx.createDynamicsCompressor(); N.out.threshold.value = -8; N.out.ratio.value = 8;
    N.vol.connect(N.dry).connect(N.out);
    N.vol.connect(N.send).connect(N.delay);
    N.delay.connect(N.etone).connect(N.ehp).connect(N.sat);
    N.sat.connect(N.fb).connect(N.delay); N.sat.connect(N.wet).connect(N.out);
    N.out.connect(ctx.destination);
    N.osc.start(); N.sweep.start();
    apply();
  }
  function ensure() {
    if (!ctx || ctx.state === 'closed') build();
    if (ctx.state !== 'running') ctx.resume().catch(() => { try { ctx.close(); } catch (e) {} build(); });
  }
  const set = (prm, v, t = 0.02) => { if (prm) prm.setTargetAtTime(v, ctx.currentTime, t); };
  function apply() {
    PADKEYS.forEach((k) => { P.pre[P.sel][k] = P[k]; });      // いま選んでいるボタンの設定に書き戻す
    if (!ctx) return;
    set(N.osc.frequency, V.tune()); set(N.vcf.frequency, Math.min(18000, V.tune() * 5));
    set(N.vol.gain, P.vol * 0.4);                   // 四角い波は大きいので、最大でも割れないところまで
    set(N.lfoAmt.gain, V.depth());
    if (voice) voice.lfo.playbackRate.setTargetAtTime(V.rate() * LEN / ctx.sampleRate, ctx.currentTime, 0.02);
    set(N.sweepTune.gain, P.ftune ? 1 : 0);
    set(N.delay.delayTime, V.etime(), 0.06); set(N.fb.gain, P.eon ? P.efb * 1.1 : 0); set(N.wet.gain, P.eon ? P.emix * 1.3 : 0);
    set(N.send.gain, P.eon ? 1 : 0);
  }
  // 押す: その形のゆれを、頭から始める。高さの上がり下がり(SWEEP)も、押したときから
  function press(i) {
    ensure();
    const t = ctx.currentTime;
    if (voice) { try { voice.lfo.stop(t); } catch (e) {} }
    const lfo = ctx.createBufferSource(); lfo.buffer = bufs[i]; lfo.loop = true; lfo.playbackRate.value = V.rate() * LEN / ctx.sampleRate;
    lfo.connect(N.lfoAmt); lfo.start(t);
    voice = { lfo };
    N.sweep.offset.cancelScheduledValues(t); N.sweep.offset.setValueAtTime(0, t); N.sweep.offset.setTargetAtTime(V.sweep(), t, Math.max(0.05, V.decay() * 0.5));
    N.vca.gain.cancelScheduledValues(t); N.vca.gain.setValueAtTime(N.vca.gain.value, t); N.vca.gain.linearRampToValueAtTime(1, t + 0.004);
    $('toneLed').classList.add('on');
  }
  // 離す: DECAY の長さで消える
  function release() {
    if (!voice) return;
    const t = ctx.currentTime, d = V.decay(), v = voice; voice = null;
    N.vca.gain.cancelScheduledValues(t); N.vca.gain.setValueAtTime(N.vca.gain.value, t); N.vca.gain.setTargetAtTime(0, t, d / 4);
    try { v.lfo.stop(t + d + 0.5); } catch (e) {}
    setTimeout(() => { if (!voice) $('toneLed').classList.remove('on'); }, d * 700);
  }

  // ---- 面を作る ----
  const panel = $('panel'), echo = $('echo');
  const add = (par, html, x, y, cls, tag = 'div') => { const e = document.createElement(tag); if (cls) e.className = cls; e.innerHTML = html; e.style.left = x + 'px'; e.style.top = y + 'px'; par.appendChild(e); return e; };
  const knobs = {};
  function knob(par, key, x, y, size, white) {
    const k = add(par, '<div class="scale"></div><div class="body"></div><div class="rot"><div class="cap"></div><div class="ptr"></div></div>', x, y, 'knob' + (white ? ' w' : ''));
    k.style.width = k.style.height = size + 'px';
    const draw = () => k.querySelector('.rot').style.setProperty('--a', (P[key] * 270 - 135) + 'deg');
    let pid = null, y0 = 0, v0 = 0;
    k.addEventListener('pointerdown', (e) => { e.preventDefault(); try { k.setPointerCapture(e.pointerId); } catch (er) {} pid = e.pointerId; y0 = e.clientY; v0 = P[key]; });
    k.addEventListener('pointermove', (e) => {
      if (pid !== e.pointerId) return;
      let v = Math.max(0, Math.min(1, v0 + (y0 - e.clientY) / 220));
      if (key === 'sweep' && Math.abs(v - 0.5) < 0.03) v = 0.5;         // FLAT に吸いつく
      P[key] = v; draw(); apply();
    });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((ev) => k.addEventListener(ev, (e) => { if (pid !== e.pointerId) return; pid = null; save(); }));
    draw(); knobs[key] = draw; return k;
  }
  const W = 600, H = 715, MW = 250, EW = 250;
  panel.style.width = W + 'px'; panel.style.height = H + 'px';
  const mod = $('mod'); mod.style.width = MW + 'px'; mod.style.height = H + 'px';
  const line = (par, cls, css) => { const d = document.createElement('div'); d.className = cls; d.style.cssText = css; par.appendChild(d); };
  // 上の帯(12VDC INPUT・Ext.TRIGGER・OUTPUT)は、アプリでは意味がないので外した(本人、2026-11-17)
  // 上の段: TONE(VOLUME・DECAY)と TUNE。MODULATION は、エコーと同じく箱の外に出した(本人、2026-11-17)
  // TONE は、本体全体の見出しにする(MODULATION・ECHO の箱と同じ置き方。本人「toneの枠は置き方が変わってくるのでは」2026-11-17)
  add(panel, 'TONE', W / 2, 66, 'tagw'); add(panel, '', W / 2 + 62, 66, 'led').id = 'toneLed';
  knob(panel, 'vol', 110, 172, 92); add(panel, '0', 74, 245, 't s'); add(panel, '10', 152, 245, 't s'); add(panel, 'VOLUME', 110, 268, 't b');
  line(panel, 'brk', 'left:64px;top:250px;width:92px');
  knob(panel, 'decay', 300, 172, 92); add(panel, 'SHORT', 258, 250, 't s'); add(panel, 'LONG', 344, 250, 't s'); add(panel, 'DECAY', 300, 270, 't b');
  line(panel, 'brk', 'left:248px;top:252px;width:104px');
  // 絵で示す(本人「DECAYとかSWEEPも視覚的にわかりやすく」2026-11-17)。押すとその値になる
  const mark = (par, key, v, d, x, y) => { const b = add(par, '<svg viewBox="0 0 30 16"><path d="' + d + '"/></svg>', x, y, 'ricon wide', 'button'); b.type = 'button'; b.addEventListener('click', () => { P[key] = v; knobs[key](); apply(); save(); }); return b; };
  mark(panel, 'decay', 0.05, 'M1 14 V3 H14 L17 14 H29', 228, 226); mark(panel, 'decay', 0.95, 'M1 14 V3 H8 C14 3 18 14 29 14', 372, 226);
  knob(panel, 'tune', 492, 172, 92); add(panel, 'LOW', 452, 245, 't s'); add(panel, 'HIGH', 536, 245, 't s'); add(panel, 'TUNE', 492, 268, 't b');
  line(panel, 'brk', 'left:446px;top:250px;width:92px');
  // まん中: SWEEP。その上側に FILTER / FILTER+TUNE(丸いボタン。どちらかは LED で)
  add(panel, '<div><span class="sled" id="fl0"></span>FILTER</div><div><span class="sled" id="fl1"></span>FILTER+TUNE</div>', 160, 336, 'flab');
  const fbtn = add(panel, '', 244, 334, 'rbtn', 'button'); fbtn.type = 'button';
  const fdraw = () => { $('fl0').classList.toggle('on', !P.ftune); $('fl1').classList.toggle('on', !!P.ftune); fbtn.classList.toggle('on', !!P.ftune); };
  fbtn.addEventListener('click', () => { P.ftune = P.ftune ? 0 : 1; fdraw(); apply(); save(); }); fdraw();
  knob(panel, 'sweep', 330, 440, 124); add(panel, '▼', 330, 352, 't'); add(panel, 'FLAT', 330, 336, 't s');
  add(panel, 'UP', 258, 528, 't s'); add(panel, 'DOWN', 402, 528, 't s'); add(panel, 'SWEEP', 330, 547, 't b');
  line(panel, 'brk', 'left:258px;top:530px;width:144px');
  mark(panel, 'sweep', 0, 'M1 14 H6 C14 14 18 3 29 3', 214, 528); mark(panel, 'sweep', 1, 'M1 3 H6 C14 3 18 14 29 14', 450, 528); mark(panel, 'sweep', 0.5, 'M1 8 H29', 378, 342);
  // 名前(ロゴの場所。製品名は入れない)。BANK SELECT は外した(本人「バンクは現状使わない」2026-11-17。バンクBの形は SHAPES に残してある)
  add(panel, 'PYUN PYUN<small>dub siren</small>', 506, 440, 'name');
  // 4つのトリガー
  const boxes = [];
  [115, 235, 355, 475].forEach((x, i) => {
    const bx = add(panel, '<div class="lab one"><svg viewBox="0 0 66 16"><path d="' + ICONS[i] + '"/></svg></div><div class="pad"></div>', x, 570, 'padbox');
    const pad = bx.querySelector('.pad'); let pid = null;
    // 波のマーク(上の帯)を押すと、音を出さずにそのボタンを選ぶ。つまみをそのボタンの設定にしてから鳴らせる(本人「出す前に切り替え」2026-11-18)
    const lab = bx.querySelector('.lab'); lab.setAttribute('role', 'button'); lab.tabIndex = 0; lab.setAttribute('aria-label', (i + 1) + '番のボタンを選ぶ(音は出ない)');
    lab.addEventListener('click', () => selectPad(i));
    lab.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectPad(i); } });
    pad.addEventListener('pointerdown', (e) => { e.preventDefault(); try { pad.setPointerCapture(e.pointerId); } catch (er) {} pid = e.pointerId; held = i; boxes.forEach((b) => b.classList.remove('on')); pad.classList.add('on'); selectPad(i); press(i); });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((ev) => pad.addEventListener(ev, (e) => { if (pid !== e.pointerId) return; pid = null; pad.classList.remove('on'); if (held === i) { held = null; release(); } }));
    boxes.push(pad);
  });
  // ボタンを押すと、そのボタンの設定をつまみに出す。選んでいるボタンは枠が光る
  function selectPad(i) {
    if (P.sel !== i) { P.sel = i; PADKEYS.forEach((k) => { P[k] = P.pre[i][k]; if (knobs[k]) knobs[k](); }); fdraw(); apply(); save(); }
    panel.querySelectorAll('.padbox').forEach((b, j) => b.classList.toggle('sel', j === P.sel));
  }
  panel.querySelectorAll('.padbox').forEach((b, j) => b.classList.toggle('sel', j === P.sel));
  // いまの形: DECAY は、押して離したあとの音の大きさ。SWEEP は、押してからの高さの動き。箱の外(上の帯)に置く
  const scr = document.createElement('div'); scr.className = 'scr'; scr.innerHTML = '<canvas width="240" height="80"></canvas><span>白=大きさ 緑=高さ(点線で離す)</span>';
  document.querySelector('header').insertBefore(scr, document.querySelector('header a'));
  scr.querySelector('canvas').style.cssText = 'width:120px;height:40px';
  function drawScr() {
    const c = scr.querySelector('canvas'), g = c.getContext('2d'), w = 240, h = 80; g.clearRect(0, 0, w, h);
    const T = 2.4, x = (t) => 6 + (t / T) * (w - 12), rel = 0.6, d = V.decay();
    g.strokeStyle = '#eceae4'; g.lineWidth = 3; g.beginPath();
    for (let i = 0; i <= 120; i++) { const t = (i / 120) * T, a = t < rel ? 1 : Math.exp(-(t - rel) / (d / 4)); const yy = h - 6 - a * (h - 18); i ? g.lineTo(x(t), yy) : g.moveTo(x(t), yy); }
    g.stroke();
    g.strokeStyle = '#48ff7a'; g.lineWidth = 3; g.beginPath(); const sw = V.sweep() / 3600, tau = Math.max(0.05, d * 0.5);
    for (let i = 0; i <= 120; i++) { const t = (i / 120) * T, p = sw * (1 - Math.exp(-t / tau)); const yy = h / 2 - p * (h / 2 - 6); i ? g.lineTo(x(t), yy) : g.moveTo(x(t), yy); }
    g.stroke();
    g.setLineDash([4, 4]); g.strokeStyle = '#9a988f'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x(rel), 2); g.lineTo(x(rel), h - 2); g.stroke(); g.setLineDash([]);
  }
  setInterval(drawScr, 120); drawScr();

  // ---- MODULATION の箱(DEPTH・RATE)。エコーと同じ作り ----
  add(mod, 'MODULATION', MW / 2, 60, 'tagw');
  knob(mod, 'depth', MW / 2, 200, 104, true); add(mod, 'MIN', 58, 268, 't s'); add(mod, 'MAX', 192, 268, 't s'); add(mod, 'DEPTH', MW / 2, 292, 't b');
  // RATE の速さを絵でも示す(本人「RATEの表記の仕方」が良かった、2026-11-17)。押すとその速さになる。LED は速さで点滅
  const RICONS = [[0.12, 'M1 8 C5 1 9 1 10 8 S15 15 19 8'], [0.5, 'M1 12 L5 4 L9 12 L13 4 L17 12'], [0.88, 'M1 12 L3 4 L5 12 L7 4 L9 12 L11 4 L13 12 L15 4 L17 12']];
  const rIcons = RICONS.map(([v, d], i) => {
    const b = add(mod, '<svg viewBox="0 0 20 16"><path d="' + d + '"/></svg>', 76 + i * 44, 372, 'ricon', 'button'); b.type = 'button';
    b.addEventListener('click', () => { P.rate = v; knobs.rate(); apply(); save(); rDraw(); });
    return [v, b];
  });
  add(mod, '', 214, 372, 'led g').id = 'rateLed';
  knob(mod, 'rate', MW / 2, 480, 104, true); add(mod, 'SLOW', 58, 548, 't s'); add(mod, 'FAST', 192, 548, 't s'); add(mod, 'RATE', MW / 2, 572, 't b');
  const rDraw = () => rIcons.forEach(([v, b]) => b.classList.toggle('on', Math.abs(P.rate - v) < 0.08));
  rDraw(); setInterval(rDraw, 300);
  (function blink() { const on = Math.floor(performance.now() / 1000 * V.rate() * 2) % 2 === 0; $('rateLed').classList.toggle('on', on); requestAnimationFrame(blink); })();

  // ---- エコーの箱 ----
  echo.style.width = EW + 'px'; echo.style.height = H + 'px';
  add(echo, 'ECHO', EW / 2, 60, 'tagw');
  knob(echo, 'etime', EW / 2, 160, 100, true); add(echo, 'SLOW', 62, 222, 't s'); add(echo, 'FAST', 188, 222, 't s'); add(echo, 'TIME', EW / 2, 245, 't b');
  knob(echo, 'efb', EW / 2, 340, 92); add(echo, '0', 82, 405, 't s'); add(echo, '10', 168, 405, 't s'); add(echo, 'FEEDBACK', EW / 2, 422, 't b');
  knob(echo, 'emix', EW / 2, 510, 92); add(echo, '0', 82, 575, 't s'); add(echo, '10', 168, 575, 't s'); add(echo, 'MIX', EW / 2, 592, 't b');
  const eon = add(echo, 'ON', EW / 2, 655, 'onbtn', 'button'); eon.type = 'button';
  const eDraw = () => { eon.classList.toggle('on', !!P.eon); eon.textContent = P.eon ? 'ON' : 'OFF'; };
  eon.addEventListener('click', () => { P.eon = P.eon ? 0 : 1; eDraw(); apply(); save(); }); eDraw();

  // ---- 画面に合わせる: 広ければ横に2つ、せまければ縦に2つ ----
  function fit() {
    const cw = document.documentElement.clientWidth - 40, ch = window.innerHeight - $('stage').getBoundingClientRect().top - window.scrollY - 24;
    const G = 24, wideW = W + G + MW + G + EW;
    const wide = cw / ch > 1.2;      // 横長: 3つを横に並べる。縦長: 本体の下に、MODULATION とエコーを並べる
    let TW, TH;
    if (wide) { mod.style.left = (W + G) + 'px'; mod.style.top = '0px'; echo.style.left = (W + G + MW + G) + 'px'; echo.style.top = '0px'; TW = wideW; TH = H; }
    else { const x0 = (W - (MW + G + EW)) / 2; mod.style.left = x0 + 'px'; mod.style.top = (H + G) + 'px'; echo.style.left = (x0 + MW + G) + 'px'; echo.style.top = (H + G) + 'px'; TW = W; TH = H + G + H; }
    const s = wide ? Math.min(cw / TW, ch / TH, 1.4) : Math.min(cw / TW, 1.4);
    $('scaler').style.transform = 'scale(' + s + ')';
    $('stage').style.width = TW * s + 'px'; $('stage').style.height = TH * s + 'px';
  }
  fit(); window.addEventListener('resize', fit);
  document.addEventListener('visibilitychange', () => { if (document.hidden && voice) { held = null; boxes.forEach((b) => b.classList.remove('on')); release(); } });
})();
