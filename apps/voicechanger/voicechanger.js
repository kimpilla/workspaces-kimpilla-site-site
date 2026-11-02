(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);

  // ---- キャラクター「こえっこ」(こえ せんようの なかま。ふわりん〈サイン波〉の しるしは つけない) ----
  // からだの いろ = こえの たかさ(ひくい=あお、たかい=ピンク)。おなかの せん = その かけらの ほんとうの なみ。
  const koeSvg = (color, pts) => {
    let wv = '';
    if (pts) wv = '<path d="' + pts.map((v, k) => (k ? 'L' : 'M') + (26 + k * (48 / (pts.length - 1))).toFixed(1) + ' ' + (79 + (k % 2 ? -1 : 1) * Math.max(0.8, v * 7.5)).toFixed(1)).join('') + '" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" opacity=".92"/>';
    return '<svg viewBox="0 0 100 100" aria-hidden="true"><rect x="12" y="22" width="76" height="68" rx="32" fill="' + color + '"/>' +
      '<path d="M50 22 C45 9 57 6 55 15" fill="none" stroke="' + color + '" stroke-width="5" stroke-linecap="round"/>' +
      '<circle cx="35" cy="47" r="7" fill="#fff"/><circle cx="65" cy="47" r="7" fill="#fff"/><circle cx="35" cy="48" r="3.2" fill="#2b2150"/><circle cx="65" cy="48" r="3.2" fill="#2b2150"/>' +
      '<ellipse class="mouth" cx="50" cy="64" rx="9" ry="3.5" fill="#7a2b3b"/>' + wv + '</svg>';
  };
  const HERO = '#ff9f6b';
  $('hero').innerHTML = koeSvg(HERO, null); $('ctr').innerHTML = koeSvg(HERO, null);

  // ---- つまみ ----
  const KNOBS = [
    { k: 'tune', le: '🐘', he: '🐭', em: '🎵', name: 'たかさ', lo: 'ひくーい', hi: 'たかーい', min: -1, max: 1, def: 0, tr: 'linear-gradient(90deg,#8e7bff,#ffd23f,#ff7fb0)', th: '#ff9a3c' },
    { k: 'wob', le: '😐', he: '🥶', em: '🌀', name: 'ゆれ', lo: 'まっすぐ', hi: 'ぶるぶる', min: 0, max: 1, def: 0, tr: 'linear-gradient(90deg,#d9f1ff,#7fc8ff)', th: '#3fa0e8' },
    { k: 'echo', le: '😶', he: '⛰️', em: '📣', name: 'エコー', lo: 'なし', hi: 'やまびこ', min: 0, max: 1, def: 0, tr: 'linear-gradient(90deg,#e4f7e8,#7be0a5)', th: '#3fbf7c' },
    { k: 'dist', le: '🫧', he: '🪨', em: '🔥', name: 'ひずみ', lo: 'なめらか', hi: 'ざらざら', min: 0, max: 1, def: 0, tr: 'linear-gradient(90deg,#ffe9b0,#ff9a3c)', th: '#e5503e' },
    { k: 'rob', le: '🧑', he: '🤖', em: '⚙️', name: 'ロボット', lo: 'にんげん', hi: 'ロボット', min: 0, max: 1, def: 0, tr: 'linear-gradient(90deg,#e0e8ff,#7fa8ff)', th: '#4f7be8' },
    { k: 'muf', le: '🔔', he: '🧣', em: '☁️', name: 'こもり', lo: 'くっきり', hi: 'こもる', min: 0, max: 1, def: 0, tr: 'linear-gradient(90deg,#f1ecdf,#b9ad8e)', th: '#8a7a55' },
    { k: 'vol', le: '🔈', he: '📢', em: '🔊', name: 'おおきさ', lo: 'ちいさい', hi: 'おおきい', min: 0.15, max: 1, def: 0.8, tr: 'linear-gradient(90deg,#ffe3ec,#ff8fb1)', th: '#e0507f' },
  ];
  const defP = () => { const p = { rev: false, voc: false, vkey: 0, vharm: 0, vthick: 0.3, vair: 0.2, vvib: 0 }; KNOBS.forEach((n) => { p[n.k] = n.def; }); return p; };
  const clone = (p) => Object.assign({}, p);
  // ---- じょうたい ----
  let ac, master, an, buf = null, rbuf = null, peaks = null;
  const work = { a: 0, b: 1, ta: 0, tb: 1, chops: [], cur: 1, p: defP() };   // ta,tb=1ばんで えらんだ(むおんを けずった)はんい。a,b=3ばんで「かけら」に する ぶぶん       // あたらしい こえ(まだ ばんに ない)
  let sel = null;                                // ばんの かけらを えらんでいる とき
  const edit = () => sel || work;
  const frags = [];                              // {a,b,p,x,y,el}
  let fid = 0;

  const say = (t) => { $('msg').textContent = t; };
  const hint = (t) => { $('bhint').textContent = t; };

  function ensure() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    ac = new (window.AudioContext || window.webkitAudioContext)();
    const comp = ac.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 6;
    master = ac.createGain(); master.gain.value = 0.9;
    an = ac.createAnalyser(); an.fftSize = 512;
    master.connect(comp); comp.connect(ac.destination); master.connect(an);
    loopUI();
  }
  const distCurve = (() => { const n = 1024, c = new Float32Array(n), k = 70; for (let i = 0; i < n; i++) { const x = (i * 2) / n - 1; c[i] = ((3 + k) * x * 20 * (Math.PI / 180)) / (Math.PI + k * Math.abs(x)); } return c; })();

  // ---- ボコーダー(こえを 18の おびに わけて、おびごとの おおきさで のこぎりなみを うごかす。あいうえおシンセと おなじ しくみ) ----
  const sigOf = (p) => (p.voc ? [p.vkey, p.vharm, p.vthick, p.vair, p.vvib].join() : '');
  let noiseBuf = null;
  function vocBuild(p, semi, src) {
    const c = ac;
    if (!noiseBuf) { noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate); const nd = noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1; }
    const modIn = c.createGain(), out = c.createGain(); out.gain.value = 0.5; src.connect(modIn);
    const f = 261.63 * Math.pow(2, (p.vkey + Math.round(semi)) / 12), carSum = c.createGain(), oscs = [];
    [[0, 1], [4, p.vharm * 0.8], [7, p.vharm * 0.65], [0.16, p.vthick * 0.9]].forEach(([st, g]) => {
      if (g <= 0.001) return; const o = c.createOscillator(), og = c.createGain(); o.type = 'sawtooth'; o.frequency.value = f * Math.pow(2, st / 12); og.gain.value = g; o.connect(og); og.connect(carSum); oscs.push(o);
    });
    const ns = c.createBufferSource(), ng = c.createGain(); ns.buffer = noiseBuf; ns.loop = true; ng.gain.value = 0.2 + 1.3 * p.vair; ns.connect(ng); ng.connect(carSum);
    const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 5.5; lg.gain.value = p.vvib * 90; lfo.connect(lg); oscs.forEach((o) => lg.connect(o.detune));
    const rect = new Float32Array(1025); for (let i = 0; i < 1025; i++) rect[i] = Math.abs(i / 512 - 1);
    const N = 18, lo = 140, hi = 7000;
    for (let k = 0; k < N; k++) {
      const fr = lo * Math.pow(hi / lo, k / (N - 1)), mb = c.createBiquadFilter(), sh = c.createWaveShaper(), env = c.createBiquadFilter(), amt = c.createGain(), cb = c.createBiquadFilter(), vca = c.createGain();
      mb.type = 'bandpass'; mb.frequency.value = fr; mb.Q.value = 5; sh.curve = rect; env.type = 'lowpass'; env.frequency.value = 90; amt.gain.value = 9; cb.type = 'bandpass'; cb.frequency.value = fr; cb.Q.value = 5; vca.gain.value = 0;
      modIn.connect(mb); mb.connect(sh); sh.connect(env); env.connect(amt); amt.connect(vca.gain); carSum.connect(cb); cb.connect(vca); vca.connect(out);
    }
    const ss = c.createBiquadFilter(), ssG = c.createGain(), dh = c.createBiquadFilter(), dg = c.createGain();   // たかい いきの おと・しし(子音)は もとの こえから すこし
    ss.type = 'highpass'; ss.frequency.value = 2800; ssG.gain.value = 0.5; modIn.connect(ss); ss.connect(ssG); ssG.connect(out);
    dh.type = 'highpass'; dh.frequency.value = 2000; dg.gain.value = 0.5; modIn.connect(dh); dh.connect(dg); dg.connect(out);
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -10; comp.ratio.value = 8; comp.attack.value = 0.003; out.connect(comp);
    const all = [...oscs, ns, lfo]; all.forEach((o) => o.start());
    return { out: comp, stop: (d) => { const t = c.currentTime + (d || 0) + 0.3; all.forEach((o) => { try { o.stop(t); } catch (e) { /* */ } }); setTimeout(() => { try { comp.disconnect(); out.disconnect(); } catch (e) { /* */ } }, ((d || 0) + 1.5) * 1000); } };
  }
  // ---- 1つの こえの かけらを ならす(つまみは あとから うごかせる) ----
  function chain(p, semi, gain) {
    const src = ac.createBufferSource();
    const lfo = ac.createOscillator(), lfoG = ac.createGain(); lfo.frequency.value = 6; lfo.connect(lfoG); lfoG.connect(src.detune);
    const dry = ac.createGain(), ringIn = ac.createGain(), ringWet = ac.createGain(), ringOsc = ac.createOscillator();
    ringOsc.frequency.value = 70; ringIn.gain.value = 0; ringOsc.connect(ringIn.gain);
    const inp = ac.createGain(), voc = p.voc ? vocBuild(p, semi, src) : null;   // ボコーダーが ON なら、こえは ボコーダーを とおってから つまみの へ
    if (voc) voc.out.connect(inp); else src.connect(inp);
    inp.connect(dry); inp.connect(ringIn); ringIn.connect(ringWet);
    const mix1 = ac.createGain(); dry.connect(mix1); ringWet.connect(mix1);
    const dsDry = ac.createGain(), sh = ac.createWaveShaper(), dsWet = ac.createGain(); sh.curve = distCurve; sh.oversample = '2x';
    mix1.connect(dsDry); mix1.connect(sh); sh.connect(dsWet);
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.7;
    dsDry.connect(lp); dsWet.connect(lp);
    const out = ac.createGain(), dl = ac.createDelay(1), fb = ac.createGain(), ew = ac.createGain(); dl.delayTime.value = 0.23; fb.gain.value = 0.45;
    lp.connect(out); lp.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(ew); ew.connect(out); out.connect(master);
    const c = { src, nodes: [lfo, ringOsc], out, semi, gain, p, voc: !!voc, sig: sigOf(p), vstop: voc ? voc.stop : null };
    c.set = (q) => {
      c.p = q; const t = ac.currentTime, f = (n, v) => n.setTargetAtTime(v, t, 0.03);
      f(src.playbackRate, Math.pow(2, (q.tune * 12 + (c.voc ? 0 : semi)) / 12)); f(lfoG.gain, q.wob * 90 + (q.scr ? 900 : 0)); f(lfo.frequency, q.scr ? 3 : 4 + q.wob * 4);
      f(dry.gain, 1 - 0.85 * q.rob); f(ringWet.gain, q.rob * 1.6);
      f(dsDry.gain, 1 - q.dist); f(dsWet.gain, q.dist * 0.7);
      f(lp.frequency, 16000 * Math.pow(0.035, q.muf));
      f(ew.gain, q.echo * 0.85); f(out.gain, q.vol * gain);
    };
    c.set(p);
    lfo.start(); ringOsc.start();
    return c;
  }
  const stopChain = (c, delay, vdelay) => {
    if (c.vstop) c.vstop(vdelay === undefined ? (delay || 0) : vdelay);
    const t = ac.currentTime + (delay || 0);
    try { c.src.stop(t); } catch (e) { /* もう とまってる */ }
    setTimeout(() => { c.nodes.forEach((n) => { try { n.stop(); } catch (e) { /* */ } }); try { c.out.disconnect(); } catch (e) { /* */ } }, (delay || 0) * 1000 + 3500);
  };
  const bufFor = (p) => (p.rev ? rbuf : buf);
  const region = (e) => { const d = buf.duration; return [e.a * d, e.b * d]; };      // さかさま の ときは、さかさまに した ほうの こえの なかで えらぶ
  const trimE = () => ({ a: work.ta, b: work.tb });
  const dryP = () => { const q = defP(); q.rev = !!edit().p.rev; return q; };                     // 1ばんの なぞりでは、つまみを かけない もとの こえ

  const voices = [];
  function shot(e, semi, dry) {                  // 1かい ならす(dry=つまみを かけない)
    if (!buf) return;
    ensure();
    const p = dry ? dryP() : e.p, c = chain(p, semi || 0, 0.9); c.src.buffer = bufFor(p);
    const [s, t] = region(dry ? trimE() : e, p), dur = Math.max(0.05, t - s);
    c.src.start(0, s, dur);
    const real = dur / Math.pow(2, (p.tune * 12 + (p.voc ? 0 : (semi || 0))) / 12);
    c.src.onended = () => stopChain(c, 3, 0.1);
    c.until = ac.currentTime + real; voices.push(c);
    while (voices.length > 16) stopChain(voices.shift(), 0.02);
    for (let i = voices.length - 1; i >= 0; i--) if (voices[i].until < ac.currentTime - 0.1) voices.splice(i, 1);
    c.ref = e; return c;
  }

  // ---- パンチイン(おしている あいだだけ かかる) ----
  const punch = {};
  function shotP(f, semi) {
    let e = f, s = semi;
    if (punch.rev) e = { a: 1 - e.b, b: 1 - e.a, p: { ...e.p, rev: !e.p.rev } };
    if (punch.scr) e = { a: e.a, b: e.b, p: { ...e.p, scr: 1 } };
    if (punch.up) s += 12;
    if (punch.dn) s -= 12;
    let c;
    if (punch.stut && buf) {
      const w = Math.min(e.b - e.a, 0.12 / buf.duration), e2 = { a: e.a, b: e.a + w, p: e.p };
      c = shot(e2, s);
      for (let i = 1; i < 4; i++) setTimeout(() => { if (buf) shot(e2, s); }, i * 100);
    } else c = shot(e, s);
    if (punch.uni) shot(e, s + 0.18);
    return c;
  }
  const PB = { loop: 0, stut: 0, uni: 0, up: 0, dn: 0, rev: 0, scr: 0 };
  document.querySelectorAll('.pbtn').forEach((b) => {
    const k = b.dataset.k, on = () => { punch[k] = true; b.classList.add('on'); }, off = () => { punch[k] = false; b.classList.remove('on'); };
    b.addEventListener('pointerdown', (ev) => { ev.preventDefault(); try { b.setPointerCapture(ev.pointerId); } catch (e) { /* */ } on(); });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((t) => b.addEventListener(t, off));
  });

  // ---- 「ならす」(くりかえし。つまみで すぐ かわる) ----
  let loopC = null;
  function loopStart(dry) {
    if (!buf) return; ensure(); loopStop();
    const e = edit(), p = dry ? dryP() : e.p, c = chain(p, 0, 0.9); c.src.buffer = bufFor(p); c.src.loop = true; c.ref = e; c.dry = !!dry;
    const [s, t] = region(dry ? trimE() : e, p); c.src.loopStart = s; c.src.loopEnd = Math.max(s + 0.05, t); c.src.start(0, s);
    loopC = c; paintPlay();
  }
  function loopStop() {
    if (!loopC) return; stopChain(loopC, 0.02); loopC = null; paintPlay();
  }
  function paintPlay() {                          // 1ばんの「ならす」(もとの こえ)と、2・3ばんの「ならす」(つまみつき)
    document.querySelectorAll('.playbtn').forEach((b) => { const on = !!loopC && loopC.dry === b.classList.contains('dry'); b.classList.toggle('on', on); b.textContent = on ? '■ とめる' : (b.classList.contains('dry') ? '▶ ならす' : '▶ ならす'); });
  }
  function loopRefresh() {                       // えらびなおした とき、つまみが かわった とき
    if (!loopC) return;
    const e = edit(), p = loopC.dry ? dryP() : e.p;
    if (loopC.src.buffer !== bufFor(p) || loopC.sig !== sigOf(p)) { loopStart(loopC.dry); return; }
    const [s, t] = region(loopC.dry ? trimE() : e, p); loopC.src.loopStart = s; loopC.src.loopEnd = Math.max(s + 0.05, t); loopC.ref = e; if (!loopC.dry) loopC.set(p);
  }

  // ---- ろくおん ----
  let mrec = null, stream = null, chunks = [], pressed = false, recStart = 0, recTimer = 0;
  async function startRec() {
    ensure(); loopStop();
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder) { say('このブラウザでは ろくおんが つかえません。「みほんの こえ」で あそんでね'); return; }
    try { if (navigator.audioSession) navigator.audioSession.type = 'play-and-record'; } catch (e) { /* ない */ }
    $('rec').classList.add('on'); say('しゃべってね… (はなすと おわり)'); pressed = true;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: true } }); }
    catch (e) { $('rec').classList.remove('on'); say('マイクを つかえません。マイクの きょかを たしかめるか、「みほんの こえ」を つかってね'); try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e2) { /* */ } return; }
    if (!pressed) { stream.getTracks().forEach((t) => t.stop()); $('rec').classList.remove('on'); say('マイクを ゆるしたら、もういちど おしながら しゃべってね'); return; }
    const mt = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find((t) => MediaRecorder.isTypeSupported(t));
    mrec = new MediaRecorder(stream, mt ? { mimeType: mt } : {}); chunks = [];
    mrec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    mrec.onstop = async () => {
      clearTimeout(recTimer); stream.getTracks().forEach((t) => t.stop()); $('rec').classList.remove('on');
      try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { /* */ }
      if (performance.now() - recStart < 250) { say('みじかすぎたよ。おしながら しゃべってね'); return; }
      try { setBuf(await ac.decodeAudioData(await new Blob(chunks, { type: mrec.mimeType }).arrayBuffer())); say('とれたよ！ なみを なぞって えらんで、つまみで かえてみよう'); }
      catch (e) { say('うまく よみこめませんでした。もういちど やってみてね'); }
    };
    const ms = ac.createMediaStreamSource(stream); ms.connect(an);       // ろくおん ちゅうの おおきさを くちに みせるだけ(スピーカーへは ださない)
    recStart = performance.now(); mrec.start();
    recTimer = setTimeout(() => { if (mrec && mrec.state === 'recording') mrec.stop(); }, 6000);
  }
  function endRec() { pressed = false; if (mrec && mrec.state === 'recording') mrec.stop(); }

  function setBuf(b) {                           // むおんを けずって おおきさを そろえる
    const d = b.getChannelData(0); let s0 = 0, e0 = d.length - 1, pk = 0;
    for (let k = 0; k < d.length; k++) pk = Math.max(pk, Math.abs(d[k]));
    if (pk < 0.003) { say('おとが ちいさすぎたみたい。もういちど！'); return; }
    const th = Math.max(0.02, pk * 0.08);
    while (s0 < e0 && Math.abs(d[s0]) < th) s0++; while (e0 > s0 && Math.abs(d[e0]) < th) e0--;
    s0 = Math.max(0, s0 - 600); e0 = Math.min(d.length - 1, e0 + 1200);
    const n = Math.max(2000, e0 - s0 + 1), nb = ac.createBuffer(1, n, b.sampleRate), o = nb.getChannelData(0), g = 0.9 / pk;
    for (let k = 0; k < n; k++) o[k] = (d[s0 + k] || 0) * g;
    const fade = Math.min(300, n >> 2); for (let k = 0; k < fade; k++) { o[k] *= k / fade; o[n - 1 - k] *= k / fade; }
    buf = nb; rbuf = ac.createBuffer(1, n, b.sampleRate); const r = rbuf.getChannelData(0); for (let k = 0; k < n; k++) r[k] = o[n - 1 - k];
    const NB = 400, st = n / NB; peaks = new Float32Array(NB);
    for (let i = 0; i < NB; i++) { let m = 0; for (let k = Math.floor(i * st); k < Math.floor((i + 1) * st); k++) m = Math.max(m, Math.abs(o[k])); peaks[i] = m; }
    sel = null; work.a = 0; work.b = 1; work.ta = 0; work.tb = 1; work.chops = []; work.cur = 1; work.p = defP();
    paintKnobs(); drawWave(); loopRefresh(); $('wempty').style.display = 'none'; $('wempty2').style.display = 'none'; document.querySelectorAll('.playbtn').forEach((b) => { b.disabled = false; }); $('cutall').disabled = false; vkeyEls.forEach((b) => { b.disabled = false; }); $('cut').disabled = false; paintEditing();
    if (frags.length) { frags.forEach((f) => f.el.remove()); frags.length = 0; }
    paintSel();
  }

  // みほんの こえ「あ い う え お」(マイクが なくても あそべる)。あいうえおシンセと おなじ こえ。よめない ときは、ぶんしで つくる
  async function voiceAiueo() {
    const parts = [];
    for (let i = 0; i < 5; i++) {
      const ab = window.__VOICES ? Uint8Array.from(atob(window.__VOICES[i]), (c) => c.charCodeAt(0)).buffer : await (await fetch('voice/' + i + '.wav?v=4')).arrayBuffer();
      parts.push(await ac.decodeAudioData(ab));
    }
    const gap = Math.floor(ac.sampleRate * 0.12), sr = parts[0].sampleRate, n = parts.reduce((s, p) => s + p.length, 0) + gap * 4;
    const out = ac.createBuffer(1, n, sr), o = out.getChannelData(0); let pos = 0;
    parts.forEach((p) => { o.set(p.getChannelData(0), pos); pos += p.length + gap; });
    return out;
  }
  async function synthAiueo() {
    const sr = 44100, dur = 0.42, gap = 0.1, V = [[800, 1250], [300, 2300], [330, 1200], [520, 1900], [450, 900]], len = Math.floor(sr * (dur * 5 + gap * 4)), oc = new OfflineAudioContext(1, len, sr);
    const o = oc.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 190;
    const f1 = oc.createBiquadFilter(), f2 = oc.createBiquadFilter(), m = oc.createGain(), env = oc.createGain();
    f1.type = f2.type = 'bandpass'; f1.Q.value = f2.Q.value = 5; m.gain.value = 2.2;
    env.gain.value = 0; o.connect(f1); o.connect(f2); f1.connect(m); f2.connect(m); m.connect(env); env.connect(oc.destination);
    V.forEach((v, i) => { const t = i * (dur + gap); f1.frequency.setValueAtTime(v[0], t); f2.frequency.setValueAtTime(v[1], t); env.gain.setValueAtTime(0, t); env.gain.linearRampToValueAtTime(1, t + 0.04); env.gain.setValueAtTime(1, t + dur - 0.06); env.gain.linearRampToValueAtTime(0, t + dur); });
    o.start(); o.stop(len / sr); return oc.startRendering();
  }
  $('sample').addEventListener('click', async () => {
    ensure(); say('みほんの こえを よういしているよ…');
    let b = null;
    try { b = await voiceAiueo(); } catch (e) { try { b = await synthAiueo(); } catch (e2) { b = null; } }
    if (!b) { say('みほんの こえを よういできませんでした'); return; }
    setBuf(b); say('「あ い う え お」だよ。なぞって えらんで、つまみで かえよう！');
  });

  // ---- なみの えと ゆびの なぞり ----
  const waves = [{ kind: 'trim', box: $('wavebox'), cv: $('wave') }, { kind: 'piece', box: $('wavebox2'), cv: $('wave2') }];
  const getSel = (w) => (w.kind === 'trim' ? { a: work.ta, b: work.tb } : edit());
  const slices = () => { const q = [work.ta, ...work.chops, work.tb]; return q.slice(0, -1).map((a, i) => ({ a, b: q[i + 1] })); };
  const SCOL = ['#ff6b6b', '#ff9a3c', '#ffd23f', '#6bd68c', '#2ec4c4', '#5b8def', '#9b6bff', '#ff6bb0'];
  function pickSlice(k, play) {                  // k ばんめの かけらの もとを えらぶ
    const s = slices(); k = Math.max(1, Math.min(s.length, k)); work.cur = k; work.a = s[k - 1].a; work.b = s[k - 1].b;
    drawWave(); paintSlices(); loopRefresh(); if (play && !loopC) shot(work, 0);
  }
  function paintSlices() {
    const s = slices(), host = $('slicerow'); host.innerHTML = '';
    s.forEach((sl, i) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'slb' + (i + 1 === work.cur && !sel ? ' on' : ''); b.textContent = i + 1; b.style.background = SCOL[i % 8]; b.setAttribute('aria-label', (i + 1) + 'ばんの かけら'); b.addEventListener('click', () => { ensure(); if (sel) select(null); pickSlice(i + 1, true); }); host.appendChild(b); });
  }
  function afterTrim() { work.chops = work.chops.filter((c) => c > work.ta + 0.02 && c < work.tb - 0.02); work.cur = Math.min(work.cur, work.chops.length + 1); const s = slices()[work.cur - 1]; work.a = s.a; work.b = s.b; paintSlices(); }
  const setSel = (w, a, b) => { if (w.kind === 'trim') { work.ta = a; work.tb = b; } else { const e = edit(); e.a = a; e.b = b; } };
  const boundsOf = (w) => (w.kind === 'trim' || sel ? [0, 1] : [work.ta, work.tb]);
  function drawOne(w) {
    const cv = w.cv, cx2 = cv.getContext('2d'), r = w.box.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.max(1, Math.round(r.width * dpr)); cv.height = Math.max(1, Math.round(r.height * dpr));
    const W = cv.width, H = cv.height; cx2.clearRect(0, 0, W, H);
    if (!peaks) return;
    if (w.kind === 'piece') { drawPiece(cx2, W, H, dpr); return; }
    const s = getSel(w), [lo, hi] = boundsOf(w), x0 = s.a * W, x1 = s.b * W, n = peaks.length, bw = W / n, flip = !!edit().p.rev;
    cx2.fillStyle = '#ffffff14'; cx2.fillRect(0, 0, W, H);
    cx2.fillStyle = '#ff9a3c33'; cx2.fillRect(x0, 0, x1 - x0, H);
    for (let i = 0; i < n; i++) {
      const pk = peaks[flip ? n - 1 - i : i], x = i * bw, mid = x + bw / 2, inside = mid >= x0 && mid <= x1, usable = mid >= lo * W && mid <= hi * W, h = Math.max(2 * dpr, pk * H * 0.9);
      cx2.fillStyle = inside ? '#ffd23f' : usable ? '#8f84c9' : '#4a4378'; cx2.fillRect(x + 0.5, (H - h) / 2, Math.max(1, bw - 1.5), h);
    }
    cx2.fillStyle = '#ff9a3c'; cx2.fillRect(x0 - 2 * dpr, 0, 4 * dpr, H); cx2.fillRect(x1 - 2 * dpr, 0, 4 * dpr, H);
    cx2.beginPath(); cx2.arc(x0, H / 2, 9 * dpr, 0, 7); cx2.arc(x1, H / 2, 9 * dpr, 0, 7); cx2.fill();
  }
  function drawPiece(cx2, W, H, dpr) {           // きりめで わけた かけら(1・2・3…)
    const n = peaks.length, bw = W / n, flip = !!edit().p.rev, sl = slices(), q = [work.ta, ...work.chops, work.tb];
    cx2.fillStyle = '#ffffff14'; cx2.fillRect(0, 0, W, H);
    sl.forEach((s, i) => { const on = sel ? false : i + 1 === work.cur; cx2.fillStyle = SCOL[i % 8] + (on ? '66' : '26'); cx2.fillRect(s.a * W, 0, (s.b - s.a) * W, H); });
    for (let i = 0; i < n; i++) {
      const pk = peaks[flip ? n - 1 - i : i], x = i * bw, mid = (x + bw / 2) / W, h = Math.max(2 * dpr, pk * H * 0.8);
      let col = '#4a4378'; sl.forEach((s, k) => { if (mid >= s.a && mid <= s.b) col = (!sel && k + 1 === work.cur) ? '#ffd23f' : '#b3a8ec'; });
      if (sel && mid >= sel.a && mid <= sel.b) col = '#ffd23f';
      cx2.fillStyle = col; cx2.fillRect(x + 0.5, (H - h) / 2, Math.max(1, bw - 1.5), h);
    }
    cx2.font = 'bold ' + Math.round(20 * dpr) + 'px sans-serif'; cx2.textAlign = 'center'; cx2.textBaseline = 'top';
    sl.forEach((s, i) => { if ((s.b - s.a) * W > 22 * dpr) { cx2.fillStyle = '#fff'; cx2.fillText(String(i + 1), ((s.a + s.b) / 2) * W, 4 * dpr); } });
    cx2.fillStyle = '#fff'; q.forEach((c, i) => { if (i === 0 || i === q.length - 1) return; cx2.fillRect(c * W - 2 * dpr, 0, 4 * dpr, H); cx2.beginPath(); cx2.arc(c * W, H - 12 * dpr, 8 * dpr, 0, 7); cx2.fill(); });
  }
  function drawWave() { waves.forEach(drawOne); }
  window.addEventListener('resize', drawWave);
  waves.forEach((w) => {
    if (w.kind === 'piece') return;
    let drag = null;
    const wx = (ev) => { const r = w.box.getBoundingClientRect(); return Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width)); };
    w.box.addEventListener('pointerdown', (ev) => {
      if (!buf) return; ev.preventDefault(); w.box.setPointerCapture(ev.pointerId); ensure();
      const s = getSel(w), x = wx(ev), nearA = Math.abs(x - s.a) < 0.05, nearB = Math.abs(x - s.b) < 0.05;     // はしの つまみに ちかければ、はしだけ うごかす
      drag = { x0: x, mode: nearA && (!nearB || Math.abs(x - s.a) <= Math.abs(x - s.b)) ? 'a' : nearB ? 'b' : 'new', moved: false };
    });
    w.box.addEventListener('pointermove', (ev) => {
      if (!drag) return; const x = wx(ev), s = getSel(w), [lo, hi] = boundsOf(w), cl = (v) => Math.min(hi, Math.max(lo, v));
      if (Math.abs(x - drag.x0) > 0.01) drag.moved = true;
      if (!drag.moved) return;
      let a = s.a, b = s.b;
      if (drag.mode === 'a') a = Math.min(cl(x), b - 0.03);
      else if (drag.mode === 'b') b = Math.max(cl(x), a + 0.03);
      else { a = Math.min(cl(drag.x0), cl(x)); b = Math.max(cl(drag.x0), cl(x)); if (b - a < 0.03) b = Math.min(hi, a + 0.03); }
      setSel(w, a, b); if (w.kind === 'trim' && !sel) { work.a = work.ta; work.b = work.tb; }
      drawWave(); loopRefresh();
    });
    w.box.addEventListener('pointerup', () => {
      if (!drag) return; const [lo, hi] = boundsOf(w);
      if (!drag.moved && drag.mode === 'new') { setSel(w, lo, hi); if (w.kind === 'trim' && !sel) { work.a = work.ta; work.b = work.tb; } drawWave(); loopRefresh(); }
      afterTrim(); drawWave(); if (!loopC) shot(trimE(), 0, true);
      drag = null;
    });
    w.box.addEventListener('pointercancel', () => { drag = null; });
  });

  // かけらの なみ: タップで きりめを ふやす/けす、ドラッグで きりめを うごかす
  (function () {
    const box = $('wavebox2'); let drag = null;
    const wx = (ev) => { const r = box.getBoundingClientRect(); return Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width)); };
    box.addEventListener('pointerdown', (ev) => {
      if (!buf) return; ev.preventDefault(); box.setPointerCapture(ev.pointerId); ensure(); if (sel) select(null);
      const x = wx(ev); let idx = -1, best = 0.04; work.chops.forEach((c, i) => { if (Math.abs(c - x) < best) { best = Math.abs(c - x); idx = i; } });
      drag = { x0: x, idx, moved: false };
    });
    box.addEventListener('pointermove', (ev) => {
      if (!drag || drag.idx < 0) return; const x = wx(ev); if (Math.abs(x - drag.x0) > 0.012) drag.moved = true; if (!drag.moved) return;
      const lo = (drag.idx === 0 ? work.ta : work.chops[drag.idx - 1]) + 0.03, hi = (drag.idx === work.chops.length - 1 ? work.tb : work.chops[drag.idx + 1]) - 0.03;
      work.chops[drag.idx] = Math.min(hi, Math.max(lo, x)); const s = slices()[work.cur - 1]; work.a = s.a; work.b = s.b; drawWave(); loopRefresh();
    });
    box.addEventListener('pointerup', (ev) => {
      if (!drag) return; const x = wx(ev);
      if (!drag.moved) {
        if (drag.idx >= 0) { work.chops.splice(drag.idx, 1); work.cur = Math.min(work.cur, work.chops.length + 1); pickSlice(work.cur, false); }       // きりめを タップ = けす
        else if (x > work.ta + 0.03 && x < work.tb - 0.03 && work.chops.every((c) => Math.abs(c - x) > 0.03) && work.chops.length < 11) {   // なみを タップ = きりめを ふやす
          work.chops.push(x); work.chops.sort((p, q) => p - q); const k = work.chops.indexOf(x) + 1; pickSlice(k, true);
        } else { drawWave(); }
      } else { pickSlice(work.cur, true); }
      drag = null;
    });
    box.addEventListener('pointercancel', () => { drag = null; });
  }());

  // ---- つまみの がめん ----
  const knobEl = {}, kvEl = {};
  KNOBS.forEach((n) => { knobEl[n.k] = []; });
  function makeKnobs(host) {                       // 2ばんの つまみ と、ばんの したの「えらんだ かけらの エフェクト」で おなじ つまみを つかう
    KNOBS.forEach((n) => {
      const d = document.createElement('div'); d.className = 'knob';
      d.innerHTML = '<div class="sl"><span class="em" aria-hidden="true">' + n.le + '</span><input type="range" min="' + n.min + '" max="' + n.max + '" step="0.01" value="' + n.def + '" aria-label="' + n.name + '"><span class="em" aria-hidden="true">' + n.he + '</span></div>';
      const inp = d.querySelector('input'); inp.style.setProperty('--tr', n.tr); inp.style.setProperty('--th', n.th);
      inp.addEventListener('input', () => { ensure(); const e = edit(); e.p[n.k] = parseFloat(inp.value); knobEl[n.k].forEach((x) => { x.value = e.p[n.k]; }); knobChanged(); });
      host.appendChild(d); knobEl[n.k].push(inp);
    });
  }
  makeKnobs($('knobs')); makeKnobs($('fknobs'));
  // つまみの えは、いまの ねを かたちで みせる(なみが のびる・ゆれる・ぎざぎざ になる…)
  function kvDraw(n, v) {
    if (!kvEl[n.k]) return;
    const S = (t, c) => Math.sin(2 * Math.PI * c * t);
    const path = (fn, op, dx) => { let d = ''; for (let i = 0; i <= 76; i++) { const y = 20 - 15 * fn(i / 76); d += (i ? 'L' : 'M') + (i + (dx || 0)).toFixed(1) + ' ' + y.toFixed(1); } return '<path d="' + d + '" fill="none" stroke="' + n.th + '" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" opacity="' + op + '"/>'; };
    let s = '';
    switch (n.k) {
      case 'tune': s = path((t) => S(t, 1 + (v + 1) * 2.2), 1); break;
      case 'wob': s = path((t) => Math.sin(2 * Math.PI * 2.5 * t + v * 3.4 * Math.sin(2 * Math.PI * 2 * t)), 1); break;
      case 'echo': { const burst = (t0) => (t) => S(t - t0, 4) * Math.exp(-Math.pow((t - t0 - 0.1) / 0.075, 2)); s = path(burst(0), 1);
        for (let i = 1; i <= 3; i++) s += path(burst(0.22 * i), (v * Math.pow(0.72, i - 1)).toFixed(2)); break; }
      case 'dist': { const g = 1 + v * 9; s = path((t) => Math.tanh(g * S(t, 2.2)) / Math.tanh(g), 1); break; }
      case 'rob': { const m = Math.round(48 - v * 40); s = path((t) => S(Math.floor(t * m) / m, 2.2), 1); break; }
      case 'muf': s = path((t) => (S(t, 2) + (1 - v) * 0.55 * S(t, 9)) / (1 + (1 - v) * 0.55), 1); break;
      case 'vol': s = path((t) => S(t, 2.2) * (0.12 + 0.88 * ((v - n.min) / (n.max - n.min))), 1); break;
      case 'vharm': s = path((t) => S(t, 2) * 0.55, 0.9) + path((t) => S(t, 2.52) * 0.55 * v, (0.25 + 0.75 * v).toFixed(2)) + path((t) => S(t, 3) * 0.55 * v, (0.25 + 0.75 * v).toFixed(2)); break;
      case 'vthick': s = path((t) => S(t, 2.2) * 0.8, 1) + path((t) => S(t + v * 0.06, 2.2 * (1 + v * 0.12)) * 0.8, (0.2 + 0.7 * v).toFixed(2)); break;
      case 'vair': s = path((t) => S(t, 2.2) * (1 - 0.6 * v) + v * 0.9 * (Math.sin(t * 977) * Math.sin(t * 331 + 1)), 1); break;
      case 'vvib': s = path((t) => Math.sin(2 * Math.PI * 2.5 * t + v * 3.4 * Math.sin(2 * Math.PI * 2 * t)), 1); break;
      default: break;
    }
    kvEl[n.k].innerHTML = '<rect x="0" y="0" width="76" height="40" rx="10" fill="#ffffffcc"/><line x1="4" y1="20" x2="72" y2="20" stroke="#0001" stroke-width="1"/>' + s;
  }
  function paintKnobs() { const p = edit().p; KNOBS.forEach((n) => { knobEl[n.k].forEach((x) => { x.value = p[n.k]; }); }); document.querySelectorAll('.revbtn').forEach((b) => b.classList.toggle('on', !!p.rev)); if (typeof paintVoc === 'function' && vknobEl) paintVoc(); }
  let nudge = 0;
  function knobChanged() {
    const e = edit();
    if (loopC) { if (!loopC.dry) loopC.set(e.p); }
    else if (performance.now() - nudge > 450) { nudge = performance.now(); if (buf) { const c = shot(e, 0); if (c) mouthPulse(c.until - ac.currentTime); } }   // ならして いない ときは、うごかすと ちょっと ならす
    if (sel) refreshFrag(sel);
  }
  const mirror = (e) => { const a = 1 - e.b, b = 1 - e.a; e.a = a; e.b = b; if (e === work) { const ta = 1 - work.tb, tb = 1 - work.ta; work.ta = ta; work.tb = tb; work.chops = work.chops.map((c) => 1 - c).sort((x, y) => x - y); work.cur = work.chops.length + 2 - work.cur; } };   // さかさまに すると、おなじ ぶぶんが のこるよう えらびも はんてん
  document.querySelectorAll('.revbtn').forEach((rb) => rb.addEventListener('click', () => { ensure(); const e = edit(); e.p.rev = !e.p.rev; mirror(e); paintKnobs(); drawWave(); if (loopC) loopRefresh(); else if (buf) shot(e, 0, true); if (sel) refreshFrag(sel); }));
  $('reset').addEventListener('click', () => { const e = edit(); if (e.p.rev) mirror(e); e.p = defP(); paintKnobs(); drawWave(); loopRefresh(); if (sel) refreshFrag(sel); say('つまみを もとに もどしたよ'); });
  function paintEditing() {
    const t = !buf ? '' : sel ? 'いま いじっている: <b>ばんの かけら</b> (ほかの かけらは そのまま)' : 'いま いじっている: <b>あたらしい こえ</b>';
    $('editing').innerHTML = t; $('editing2').innerHTML = t; $('fpanel').hidden = !sel;
  }

  document.querySelectorAll('.playbtn').forEach((b) => b.addEventListener('click', () => { if (!buf) return; const dry = b.classList.contains('dry'), was = loopC && loopC.dry === dry; if (loopC) loopStop(); if (!was) loopStart(dry); }));

  // ---- ぐるぐる ばん ----
  const board = $('board'), bw = $('bw');
  const fragSize = (f) => 36 + (f.b - f.a) * 22;
  const colorOf = (p) => 'hsl(' + Math.round(215 + ((p.tune + 1) / 2) * 125) + ' 85% 66%)';   // ひくい=あお → たかい=ピンク
  const wavePts = (f) => {                      // かけらの ぶぶんの ほんとうの なみ(14てん)
    if (!peaks) return null; const n = peaks.length, fl = !!f.p.rev, out = [];
    for (let i = 0; i < 14; i++) { const c = Math.floor((f.a + (f.b - f.a) * (i / 13)) * (n - 1)); let m = 0; for (let k = Math.max(0, c - 3); k <= Math.min(n - 1, c + 3); k++) m = Math.max(m, peaks[fl ? n - 1 - k : k]); out.push(m); }
    return out;
  };
  function fragStyle(f) {
    const sz = fragSize(f), d = f.el.firstChild;
    d.style.width = d.style.height = sz + 'px'; d.innerHTML = koeSvg(colorOf(f.p), wavePts(f)) + '<span class="nb">' + (f.n || '') + '</span>';
    f.el.style.left = (50 + f.x * 46) + '%'; f.el.style.top = (50 + f.y * 46) + '%';
  }
  function refreshFrag(f) { fragStyle(f); }
  function newFragPos() {
    for (let t = 0; t < 30; t++) {
      const a = Math.random() * Math.PI * 2, r = 0.45 + Math.random() * 0.45, x = Math.sin(a) * r, y = -Math.cos(a) * r;
      if (frags.every((f) => Math.hypot(f.x - x, f.y - y) > 0.3)) return { x, y };
    }
    return { x: Math.sin(Math.random() * 6) * 0.7, y: -Math.cos(Math.random() * 6) * 0.7 };
  }
  $('cut').addEventListener('click', () => {
    if (!buf) return; ensure();
    if (frags.length >= 12) { say('かけらは 12こまで！ いらない かけらを けしてね'); return; }
    const e = edit(), pos = newFragPos();
    const f = { a: e.a, b: e.b, p: clone(e.p), x: pos.x, y: pos.y, id: ++fid, n: sel ? sel.n : work.cur };
    const el = document.createElement('button'); el.type = 'button'; el.className = 'frag'; el.setAttribute('aria-label', 'こえの かけら'); el.appendChild(document.createElement('div')); f.el = el;
    board.appendChild(el); frags.push(f); fragStyle(f); bindFrag(f); pop(f);
    hint('かけらが ふえたよ。ゆびで すきな ところに うごかそう。「まわす」で ならびじゅんに なるよ'); shot(f, semiOf(f));
    paintSel();
  });
  $('cutall').addEventListener('click', () => {      // ぜんぶの かけら(1・2・3…)を ばんに おく
    if (!buf) return; ensure(); if (sel) select(null);
    const s = slices();
    if (frags.length + s.length > 12) { say('かけらは 12こまで！ いらない かけらを けしてね'); return; }
    s.forEach((sl, i) => {
      const pos = newFragPos(), f = { a: sl.a, b: sl.b, p: clone(work.p), x: pos.x, y: pos.y, id: ++fid, n: i + 1 };
      const el = document.createElement('button'); el.type = 'button'; el.className = 'frag'; el.setAttribute('aria-label', 'こえの かけら'); el.appendChild(document.createElement('div')); f.el = el;
      board.appendChild(el); frags.push(f); fragStyle(f); bindFrag(f); pop(f);
    });
    hint('ぜんぶ ばんに おいたよ。かけらを タップして えらぶと、その かけらだけ エフェクトを かえられるよ'); paintSel();
  });
  const radiusOf = (f) => Math.min(1, Math.hypot(f.x, f.y) / 0.92);
  const semiOf = (f) => { const s = (radiusOf(f) - 0.55) * 18; return f.p.voc ? Math.round(s) : s; };
  const angleOf = (f) => { let a = Math.atan2(f.x, -f.y); if (a < 0) a += Math.PI * 2; return a; };
  function pop(f) { f.el.classList.remove('pop'); void f.el.offsetWidth; f.el.classList.add('pop'); }
  function paintSel() {
    frags.forEach((f) => f.el.classList.toggle('sel', f === sel)); $('del').disabled = !sel; paintEditing();
    $('cut').textContent = sel ? 'この かけらを コピー' : (slices().length > 1 ? work.cur + 'を ばんに おく' : 'ばんに おく'); $('cutall').disabled = !buf || !!sel; paintSlices();
  }
  function select(f) {
    sel = f; paintSel(); paintKnobs(); drawWave(); loopRefresh();
    if (f) hint('この かけらを いじっているよ。したの エフェクトで、この かけらだけ かえられるよ'); else hint('あたらしい こえに もどったよ');
  }
  function bindFrag(f) {
    let st = null;
    f.el.addEventListener('pointerdown', (ev) => {
      ev.preventDefault(); ev.stopPropagation(); ensure(); f.el.setPointerCapture(ev.pointerId);
      st = { sx: ev.clientX, sy: ev.clientY, x: f.x, y: f.y, moved: false }; f.el.classList.add('drag');
    });
    f.el.addEventListener('pointermove', (ev) => {
      if (!st) return; const r = board.getBoundingClientRect(), dx = ev.clientX - st.sx, dy = ev.clientY - st.sy;
      if (!st.moved && Math.hypot(dx, dy) < 6) return; st.moved = true;
      let x = st.x + dx / (r.width * 0.46), y = st.y + dy / (r.height * 0.46), m = Math.hypot(x, y);
      if (m > 0.95) { x *= 0.95 / m; y *= 0.95 / m; } if (m < 0.2) { x *= 0.2 / (m || 1); y *= 0.2 / (m || 1); }
      f.x = x; f.y = y; fragStyle(f);
    });
    const up = () => {
      if (!st) return; f.el.classList.remove('drag');
      if (!st.moved) { select(f); pop(f); const c = shotP(f, semiOf(f)); if (c) mouthPulse(c.until - ac.currentTime); }
      else if (!running) shot(f, semiOf(f));
      st = null;
    };
    f.el.addEventListener('pointerup', up); f.el.addEventListener('pointercancel', () => { st = null; f.el.classList.remove('drag'); });
  }
  bw.addEventListener('pointerdown', (ev) => { if (ev.target === board || ev.target === bw) { if (sel) { select(null); hint('「あたらしい こえ」に もどったよ'); } } });
  $('del').addEventListener('click', () => {
    if (!sel) return; const f = sel, i = frags.indexOf(f); f.el.remove(); frags.splice(i, 1); select(null); hint('けしたよ');
  });

  // ---- まわる はり ----
  let running = false, ang = 0, lastT = 0, raf = 0, wasLoop = false, loopS = 0, loopPh = 0;
  const revSec = () => 9 - ($('spd').value / 100) * 7.2;          // 1しゅうの びょうすう(9〜1.8)
  $('run').addEventListener('click', () => {
    ensure(); running = !running; $('run').classList.toggle('on', running); $('run').textContent = running ? '■ とめる' : '▶ まわす'; board.classList.toggle('run', running);
    if (running) { lastT = performance.now(); ang = 0; if (!frags.length) hint('まず「かけらにする」で、かけらを ばんに おいてね'); }
  });
  function tick(now) {
    raf = requestAnimationFrame(tick);
    if (running) {
      const dt = Math.min(0.1, (now - lastT) / 1000); lastT = now;
      let da = (dt / revSec()) * Math.PI * 2, a0 = ang;
      if (punch.loop) {
        const W = Math.PI / 3;
        if (!wasLoop) { loopS = a0; loopPh = 0; }
        const ph0 = loopPh; loopPh += da;
        if (loopPh >= W) { da = W - ph0; loopPh = -1e-4; }
        a0 = (loopS + ph0 + Math.PI * 4) % (Math.PI * 2);
      }
      wasLoop = !!punch.loop;
      const a1 = a0 + da; ang = a1 % (Math.PI * 2);
      $('sweep').style.transform = 'rotate(' + (180 + (ang * 180) / Math.PI) + 'deg)';
      frags.forEach((f) => {
        const fa = angleOf(f), hit = a1 >= Math.PI * 2 ? (fa > a0 || fa <= a1 - Math.PI * 2) : (fa > a0 && fa <= a1);
        if (hit) { pop(f); const c = shotP(f, semiOf(f)); if (c) mouthPulse(c.until - ac.currentTime); }
      });
    }
    // くちの ひらき(いま ならしている おおきさに あわせる)
    let lv = 0;
    if (an) { const d = new Uint8Array(an.fftSize); an.getByteTimeDomainData(d); let s = 0; for (let i = 0; i < d.length; i += 4) { const v = (d[i] - 128) / 128; s += v * v; } lv = Math.sqrt(s / (d.length / 4)); }
    const open = Math.min(1, lv * 5);
    document.querySelectorAll('.vcw .mouth').forEach((m) => { m.setAttribute('ry', (2.6 + open * 9).toFixed(1)); });
    $('hero').classList.toggle('bob', open < 0.05);
  }
  function mouthPulse() { /* くちは おとの おおきさで うごく */ }
  function loopUI() { if (!raf) raf = requestAnimationFrame(tick); }
  loopUI();

  // ---- ボコーダーの がめん(つまみの ねは、いま いじっている こえ〈あたらしい こえ/ばんの かけら〉に つく) ----
  const VKN = [
    { k: 'vharm', v: 'vharm', em: '🎶', name: 'ハモり', lo: 'ひとり', hi: 'ハモる', le: '🧑', he: '👭', tr: 'linear-gradient(90deg,#ffe3f1,#ff8fc7)', th: '#e0507f' },
    { k: 'vthick', v: 'vthick', em: '🎛️', name: 'ぶんしん', lo: 'うすい', hi: 'あつい', le: '🪶', he: '🧱', tr: 'linear-gradient(90deg,#e8f6ff,#7fc8ff)', th: '#3fa0e8' },
    { k: 'vair', v: 'vair', em: '💨', name: 'いき', lo: 'くっきり', hi: 'ささやき', le: '🔔', he: '🤫', tr: 'linear-gradient(90deg,#eef0f2,#aab6c4)', th: '#6a7c92' },
    { k: 'vvib', v: 'vvib', em: '🎤', name: 'ふるえ', lo: 'まっすぐ', hi: 'ゆらゆら', le: '😐', he: '🥹', tr: 'linear-gradient(90deg,#e4f7e8,#7be0a5)', th: '#3fbf7c' },
  ];
  const vknobEl = {};
  VKN.forEach((n) => {
    n.min = 0; n.max = 1;
    const d = document.createElement('div'); d.className = 'knob';
    d.innerHTML = '<svg class="kv" viewBox="0 0 76 40" aria-hidden="true"></svg><div class="kb"><div class="nm"><span>' + n.em + ' ' + n.name + '</span><i>' + n.lo + ' ⇔ ' + n.hi + '</i></div><div class="sl"><span class="em" aria-hidden="true">' + n.le + '</span><input type="range" min="0" max="1" step="0.01" value="0" aria-label="' + n.name + '"><span class="em" aria-hidden="true">' + n.he + '</span></div></div>';
    const inp = d.querySelector('input'); inp.style.setProperty('--tr', n.tr); inp.style.setProperty('--th', n.th); kvEl[n.k] = d.querySelector('.kv'); vknobEl[n.k] = inp;
    inp.addEventListener('input', () => { ensure(); const e = edit(); e.p[n.v] = parseFloat(inp.value); kvDraw(n, e.p[n.v]); if (!e.p.voc) setVoc(true); else if (loopC) loopRefresh(); if (sel) refreshFrag(sel); });
    $('vknobs').appendChild(d);
  });
  const VCOL = ['#ff6b6b', '#ff9a3c', '#ffd23f', '#6bd68c', '#2ec4c4', '#5b8def', '#9b6bff', '#ff6bb0'], VNAME = ['ド', 'レ', 'ミ', 'ファ', 'ソ', 'ラ', 'シ', 'ド↑'], VSEMI = [0, 2, 4, 5, 7, 9, 11, 12];
  const vkeyEls = [];
  VSEMI.forEach((s, i) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'vkey'; b.textContent = VNAME[i]; b.style.background = VCOL[i]; b.disabled = true;
    b.addEventListener('pointerdown', (ev) => {
      ev.preventDefault(); ensure(); const e = edit(); e.p.vkey = s + vOct * 12; if (!e.p.voc) e.p.voc = true;
      paintVoc(); if (loopC) loopRefresh(); else shot(e, 0); if (sel) refreshFrag(sel); b.classList.add('on');
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((t) => b.addEventListener(t, () => b.classList.remove('on')));
    $('vkeys').appendChild(b); vkeyEls.push(b);
  });
  let vOct = 0;
  document.querySelectorAll('.voct').forEach((b) => b.addEventListener('click', () => {
    vOct = parseInt(b.dataset.o, 10); document.querySelectorAll('.voct').forEach((x) => x.classList.toggle('on', x === b));
  }));
  function paintVoc() {
    const p = edit().p; document.querySelectorAll('.vocsw').forEach((b) => { b.classList.toggle('on', !!p.voc); b.textContent = p.voc ? '🎤 ボコーダー ON' : '🎤 ボコーダー OFF'; });
    VKN.forEach((n) => { vknobEl[n.k].value = p[n.v]; kvDraw(n, p[n.v]); });
    const base = ((p.vkey % 12) + 12) % 12; vkeyEls.forEach((b, i) => b.classList.toggle('cur', !!p.voc && (i === 7 ? false : VSEMI[i] === base)));
  }
  function setVoc(on) { const e = edit(); e.p.voc = on; paintVoc(); if (loopC) loopRefresh(); else if (buf) shot(e, 0); if (sel) refreshFrag(sel); }
  document.querySelectorAll('.vocsw').forEach((b) => b.addEventListener('click', () => { ensure(); setVoc(!edit().p.voc); }));
  $('fdone').addEventListener('click', () => select(null));

  // ---- ボタン ----
  const rb = $('rec');
  rb.addEventListener('pointerdown', (ev) => { ev.preventDefault(); try { rb.setPointerCapture(ev.pointerId); } catch (e) { /* */ } startRec(); });
  rb.addEventListener('pointerup', endRec); rb.addEventListener('pointercancel', endRec); rb.addEventListener('lostpointercapture', endRec);
  rb.addEventListener('contextmenu', (ev) => ev.preventDefault());
  rb.addEventListener('keydown', (ev) => { if ((ev.key === ' ' || ev.key === 'Enter') && !ev.repeat) { ev.preventDefault(); startRec(); } });
  rb.addEventListener('keyup', (ev) => { if (ev.key === ' ' || ev.key === 'Enter') endRec(); });
  paintKnobs();
  window.__vc = { get buf() { return buf; }, frags, work, get sel() { return sel; }, setBuf, get loopC() { return loopC; }, get an() { return an; }, voices, shot };
})();
