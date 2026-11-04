// あいうえおシンセ: もじの こえを ボコーダーに とおして、えらんだ たかさの ロボットの こえで ならす
(() => {
  const $ = (id) => document.getElementById(id);
  const KANA = 'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん';   // voice/<ばんごう>.wav の じゅん
  // 50おんの ひょう(れつ = あ・か・さ…、みぎから。'' は あき)
  const COLS = ['あいうえお', 'かきくけこ', 'さしすせそ', 'たちつてと', 'なにぬねの', 'はひふへほ', 'まみむめも', 'や ゆ よ', 'らりるれろ', 'わをん'];   // M = 「゛゜小」ボタン(ケータイの ように、おすたびに だくおん・はんだくおん・ちいさい もじに かわる)。ぜんぶ 10ぎょう
  // こどもが うたう たかさ(まんなかの ド〜うえの ド)
  const NOTES = [['ド', 261.63, '#ff6b6b'], ['レ', 293.66, '#ff9f43'], ['ミ', 329.63, '#f7c948'], ['ファ', 349.23, '#6bd68c'], ['ソ', 392.0, '#4ecdc4'], ['ラ', 440.0, '#5b9cff'], ['シ', 493.88, '#9b7bff'], ['ド', 523.25, '#ff7ac4']];
  let note = 0, last = 0, lastV = 0, lastCut = 0;
  // ---- おんしょくの つまみ(0〜100)。ぜんぶ ボコーダーの「もとの おと」の しゅるい ----
  const PAR = { normal: 1, breath: 0, bright: 63, thick: 0, vib: 0, harm: 0 };   // normal=1: ボコーダーを とおさない ふつうの こえ
  const PRESETS = [['🙂', 'ふつう', { normal: 1 }], ['🤖', 'ロボット', { normal: 0, breath: 0, bright: 63, thick: 0, vib: 0, harm: 0 }], ['👻', 'ささやき', { normal: 0, breath: 100, bright: 63, thick: 0, vib: 0, harm: 0 }], ['🧚', 'コーラス', { normal: 0, breath: 0, bright: 63, thick: 70, vib: 0, harm: 0 }], ['🌈', 'ハーモニー', { normal: 0, breath: 0, bright: 55, thick: 0, vib: 0, harm: 75 }], ['🦄', 'ふるえ', { normal: 0, breath: 0, bright: 63, thick: 0, vib: 70, harm: 0 }]];   // [えもじ, なまえ(よみあげ用), ねだん]
  const VP = { ssF: 2800, ssG: 0.5, noiseG: 0.2, envF: 90, dryF: 2000, dryG: 0.5, Q: 5 };   // ボコーダーの ちょうせい(こえの かたさ・しし(子音)の とおりやすさ)
  window.__aiueoVP = VP;
  // ---- ボコーダー(こえを 18の たかさの おびに わけて、おびごとの おおきさで のこぎりなみを うごかす) ----
  function buildVocoder(c, dest) {
    const modIn = c.createGain(), out = c.createGain(); out.gain.value = 0.5;
    const osc = c.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = NOTES[note][1];
    const noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate), nd = noiseBuf.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    const noise = c.createBufferSource(); noise.buffer = noiseBuf; noise.loop = true;
    const carSum = c.createGain(), oscG = c.createGain(), noiseG = c.createGain();
    oscG.gain.value = 1; noiseG.gain.value = VP.noiseG;                 // すこし ノイズを まぜると、「か」「さ」なども ききとりやすい
    osc.connect(oscG); oscG.connect(carSum); noise.connect(noiseG); noiseG.connect(carSum);
    const exO = [], exG = [];                                          // たしの おと 5つ(0・1=ずらした おなじ たかさ、2=1オクターブ した、3・4=ミ と ソ)
    for (let k = 0; k < 5; k++) { const o = c.createOscillator(), g = c.createGain(); g.gain.value = 0; o.frequency.value = NOTES[note][1]; o.connect(g); g.connect(carSum); exO.push(o); exG.push(g); }
    const lfo = c.createOscillator(), lfoG = c.createGain(); lfo.frequency.value = 5.5; lfoG.gain.value = 0; lfo.connect(lfoG);   // ふるえ(ビブラート)
    [osc, ...exO].forEach((o) => lfoG.connect(o.detune));
    const rect = new Float32Array(1025); for (let i = 0; i < 1025; i++) rect[i] = Math.abs(i / 512 - 1);   // ぜったいち(ぜんぶ プラスに。まんなか=0 が ちょうど 0 に なるよう、かずは きすう)
    const N = 18, lo = 140, hi = 7000;
    for (let k = 0; k < N; k++) {
      const f = lo * Math.pow(hi / lo, k / (N - 1));
      const mb = c.createBiquadFilter(); mb.type = 'bandpass'; mb.frequency.value = f; mb.Q.value = VP.Q;
      const sh = c.createWaveShaper(); sh.curve = rect;
      const env = c.createBiquadFilter(); env.type = 'lowpass'; env.frequency.value = VP.envF;
      const amt = c.createGain(); amt.gain.value = 9;
      const cb = c.createBiquadFilter(); cb.type = 'bandpass'; cb.frequency.value = f; cb.Q.value = VP.Q;
      const vca = c.createGain(); vca.gain.value = 0;
      modIn.connect(mb); mb.connect(sh); sh.connect(env); env.connect(amt); amt.connect(vca.gain);
      carSum.connect(cb); cb.connect(vca); vca.connect(out);
    }
    const ss = c.createBiquadFilter(); ss.type = 'highpass'; ss.frequency.value = VP.ssF;   // たかい いきの おと(シュッ)は もとの こえから すこし
    const ssG = c.createGain(); ssG.gain.value = VP.ssG;
    modIn.connect(ss); ss.connect(ssG); ssG.connect(out);
    let dgN = null; if (VP.dryG > 0) { const dh = c.createBiquadFilter(); dh.type = 'highpass'; dh.frequency.value = VP.dryF; dgN = c.createGain(); dgN.gain.value = VP.dryG; modIn.connect(dh); dh.connect(dgN); dgN.connect(out); }   // こえの たかい ぶぶんを そのまま すこし まぜる(子音)
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -10; comp.ratio.value = 8; comp.attack.value = 0.003;
    out.connect(comp); comp.connect(dest);
    osc.start(); noise.start(); lfo.start(); exO.forEach((o) => o.start());
    return { modIn, osc, out, oscG, noiseG, exO, exG, lfoG, ssG, dg: dgN, carrier: [osc, ...exO] };
  }


  // ---- おんせい ----
  let ac = null, voc = null, master = null, echoSend = null;
  const bufs = new Array(KANA.length);
  function ensure() {
    if (!ac) {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain(); master.gain.value = 1; master.connect(ac.destination);
      echoSend = ac.createGain(); echoSend.gain.value = 0;                   // やまびこ(ぜんぶの おとに かかる)
      const dl = ac.createDelay(1), fb = ac.createGain(), wet = ac.createGain(); dl.delayTime.value = 0.23; fb.gain.value = 0.45; wet.gain.value = 0.8;
      master.connect(echoSend); echoSend.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(wet); wet.connect(ac.destination);
      voc = buildVocoder(ac, master); voc.out.gain.value = 0;   // こえが ないときは だまる
      applyPar();
    }
    if (ac.state === 'suspended') ac.resume();
  }
  let waveKey = -1;
  function applyPar() {
    if (!voc) return;
    const b = PAR.breath / 100, br = PAR.bright / 100, th = PAR.thick / 100, hm = PAR.harm / 100, f = NOTES[note][1], t = ac.currentTime;
    const p = 2.2 - 1.9 * br, key = Math.round(p * 100);                  // ざらざら = たかい ひびきが つよい のこぎりに ちかづく
    if (key !== waveKey) {
      const re = new Float32Array(40), im = new Float32Array(40); for (let n = 1; n < 40; n++) im[n] = 1 / Math.pow(n, p);
      const w = ac.createPeriodicWave(re, im); voc.carrier.forEach((o) => o.setPeriodicWave(w)); waveKey = key;
    }
    voc.oscG.gain.value = 1 - b; voc.noiseG.gain.value = 0.2 + 1.4 * b;
    voc.lfoG.gain.value = PAR.vib * 0.6;
    const ex = [[1, 14, 0.6 * th], [1, -14, 0.6 * th], [0.5, 0, 0.5 * th], [1.2599, 0, 0.7 * hm], [1.4983, 0, 0.7 * hm]];
    voc.exO.forEach((o, k) => { o.frequency.setTargetAtTime(f * ex[k][0], t, 0.01); o.detune.value = ex[k][1]; voc.exG[k].gain.value = ex[k][2]; });
    voc.osc.frequency.setTargetAtTime(f, t, 0.01);
    echoSend.gain.value = (PAR.echo || 0) / 100 * 0.9;
  }
  async function load(i) {
    if (bufs[i]) return bufs[i];
    const r = await fetch('voice/' + i + '.wav?v=4');
    bufs[i] = await ac.decodeAudioData(await r.arrayBuffer());
    return bufs[i];
  }
  const noiseBurst = () => {                                              // 「ぱ」の はじける おと(ほんの 25ミリびょう)
    const n = Math.round(ac.sampleRate * 0.025), bf = ac.createBuffer(1, n, ac.sampleRate), d = bf.getChannelData(0);
    for (let k = 0; k < n; k++) d[k] = (Math.random() * 2 - 1) * Math.pow(1 - k / n, 2);
    return bf;
  };
  let cur = null, gen = 0;
  async function play(i, v = 0, cut = 0) {
    ensure(); last = i; lastV = v; lastCut = cut; applyPar();
    const my = ++gen;                                                      // れんだ たいさく: あたらしい おとが きたら、まえの おとは とめる
    const b = await load(i);
    if (my !== gen) return;                                                // よみこみを まっている あいだに つぎが おされた
    if (cur) { try { cur.stop(); } catch (e) { /* もう おわっている */ } }
    const s = ac.createBufferSource(); s.buffer = b; cur = s;
    if (PAR.normal) {                                                     // ふつうの こえ: ボコーダーを とおさずに そのまま。たかさの キーで、こえの たかさが かわる(ソ=もとの こえ)
      const rate = 1, ng = ac.createGain(), t0 = ac.currentTime + 0.005; ng.gain.value = 1.15; s.playbackRate.value = rate; s.connect(ng); ng.connect(master);
      voc.out.gain.cancelScheduledValues(t0); voc.out.gain.setValueAtTime(0, t0);
      s.start(t0); if (cut) s.stop(t0 + Math.min(b.duration, cut) / rate);
      s.onended = () => { if (cur === s) cur = null; try { ng.disconnect(); } catch (e) { /* */ } };
      if (rec && recEv.length < 200) recEv.push({ i, v, cut, n: note, p: Object.assign({}, PAR) });
      const bot0 = $('bot'); bot0.classList.remove('sing'); void bot0.offsetWidth; bot0.classList.add('sing');
      return;
    }
    s.connect(voc.modIn);
    const t = ac.currentTime + 0.005, dur = cut ? Math.min(b.duration, cut) : b.duration;
    s.start(t); if (cut) s.stop(t + dur);
    const g = voc.out.gain;
    g.cancelScheduledValues(t); g.setValueAtTime(Math.max(g.value, 0), t); g.linearRampToValueAtTime(0.5, t + 0.01);
    g.setTargetAtTime(0, t + dur + 0.03, cut ? 0.015 : 0.04);
    s.onended = () => { if (cur === s) cur = null; };
    if (rec && recEv.length < 200) recEv.push({ i, v, cut, n: note, p: Object.assign({}, PAR) });
    const bot = $('bot'); bot.classList.remove('sing'); void bot.offsetWidth; bot.classList.add('sing');
  }

  // ---- もじの ひょう ----
  const tiles = [];
  for (let c = 0; c < COLS.length; c++) for (let r = 0; r < COLS[c].length; r++) {         // 1ぎょうずつ うえから したへ
    const ch = COLS[c][r] || ' ', b = document.createElement('button'); b.type = 'button';
    if (ch === ' ') { b.className = 'kk blank'; b.tabIndex = -1; b.setAttribute('aria-hidden', 'true'); }
    else {
      b.className = 'kk'; b.textContent = ch;
      const i = KANA.indexOf(ch);
      const go = () => { $('nowK').textContent = ch; play(i, 0, 0); b.classList.add('on'); setTimeout(() => b.classList.remove('on'), 150); };
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); go(); });
      b.addEventListener('click', (e) => { if (e.detail === 0) go(); });   // キーボード
      tiles.push({ b, ch, i });
    }
    b.style.gridColumn = 'span 6';
    $('kana').appendChild(b);
  }
  const showInfo = () => { $('nowN').textContent = 'たかさ: ' + NOTES[note][0]; };
  NOTES.forEach(([name, , color], k) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'key' + (k === note ? ' sel' : '');
    b.textContent = name; b.style.background = color;
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault(); note = k; ensure(); applyPar();
      document.querySelectorAll('.key').forEach((x, j) => x.classList.toggle('sel', j === k));
      showInfo();
      play(last, lastV, lastCut);   // さいごの もじ(か、じぶんの こえ)を、この たかさで
    });
    $('keys').appendChild(b);
  });
  showInfo();

  // ---- かおを おすと おんしょくの つまみ ----
  const panel = $('panel');
  const sliders = {};
  const preBtns = [];
  const paintPre = (k) => { preBtns.forEach((x, j) => x.classList.toggle('sel', j === k)); paintVoc(); };
  function paintVoc() { const b = $('vocT'); if (!b) return; const on = !PAR.normal; const kb = document.querySelector('.keysbar'); if (kb) kb.classList.toggle('off', !on); b.textContent = on ? '🤖 ボコーダー ON' : '🙂 ボコーダー OFF'; b.classList.toggle('sel', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); }
  $('vocT').addEventListener('click', () => {                           // ボコーダーの ON/OFF(つまみの あたいは そのまま)。さいごの もじで くらべられる
    ensure(); PAR.normal = PAR.normal ? 0 : 1; paintVoc();
    if (PAR.normal) paintPre(0); else paintPre(-1);
    applyPar(); play(last, lastV, lastCut);
  });
  PRESETS.forEach(([emoji, name, vals], k) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'chip pre' + (k === 0 ? ' sel' : ''); b.textContent = emoji; b.setAttribute('aria-label', name); preBtns.push(b);
    b.addEventListener('click', () => { Object.assign(PAR, { echo: PAR.echo || 0 }, vals); syncKnobs(); paintPre(k); ensure(); applyPar(); play(last, lastV, lastCut); });
    $('presets').appendChild(b);
  });
  [['breath', 'ブーン', 'ささやき'], ['bright', 'まるい', 'ざらざら'], ['thick', 'ひとり', 'みんな'], ['vib', 'まっすぐ', 'ふるえる'], ['harm', 'ひとつ', 'ドミソ'], ['echo', 'なし', 'やまびこ']].forEach(([key, l, r]) => {
    const row = document.createElement('div'); row.className = 'knob';
    row.innerHTML = '<span class="l">' + l + '</span><input type="range" min="0" max="100" step="1"><span class="r">' + r + '</span>';
    const inp = row.querySelector('input'); inp.value = PAR[key] || 0; sliders[key] = inp;
    inp.addEventListener('input', () => { PAR[key] = +inp.value; if (key !== 'echo') { PAR.normal = 0; paintPre(-1); } if (ac) applyPar(); });
    inp.addEventListener('change', () => { ensure(); applyPar(); play(last, lastV, lastCut); });   // はなした ときに、さいごの もじで きかせる
    $('knobs').appendChild(row);
  });
  PAR.echo = 0; paintVoc();
  function syncKnobs() { Object.keys(sliders).forEach((k) => { sliders[k].value = PAR[k] || 0; }); }
  $('bot').addEventListener('pointerdown', (e) => {
    e.preventDefault(); ensure(); const open = panel.classList.toggle('show');
    $('bot').classList.toggle('open', open);
    const bot = $('bot'); bot.classList.remove('pop'); void bot.offsetWidth; bot.classList.add('pop');
  });
  $('panelX').addEventListener('click', () => { panel.classList.remove('show'); $('bot').classList.remove('open'); });

  // ---- ろくおん(おした もじを じゅんばんに おぼえて、あとで ならす) ----
  let rec = false, recEv = [], playing = false, timers = [];
  const bRec = $('bRec'), bPlay = $('bPlay');
  function stopPlayback() { timers.forEach(clearTimeout); timers = []; playing = false; bPlay.textContent = '▶ さいせい'; bPlay.classList.remove('sel'); }
  function refresh() { bPlay.disabled = rec || !recEv.length; bRec.classList.toggle('rec', rec); bRec.textContent = rec ? '■ とめる' : '● ろくおん'; }
  bRec.addEventListener('click', () => { ensure(); if (playing) stopPlayback(); if (!rec) { rec = true; recEv = []; } else rec = false; refresh(); });
  bPlay.addEventListener('click', () => {
    ensure();
    if (playing) { stopPlayback(); return; }
    if (!recEv.length) return;
    playing = true; bPlay.textContent = '■ とめる'; bPlay.classList.add('sel');
    const keep = { note, par: Object.assign({}, PAR) }, STEP = 550;
    recEv.forEach((e, n) => timers.push(setTimeout(() => {
      note = e.n; Object.assign(PAR, e.p); syncKnobs(); showInfo(); applyPar();
      document.querySelectorAll('.key').forEach((x, j) => x.classList.toggle('sel', j === note));
      $('nowK').textContent = KANA[e.i]; play(e.i, 0, 0);
    }, n * STEP + 50)));
    timers.push(setTimeout(() => { stopPlayback(); note = keep.note; Object.assign(PAR, keep.par); syncKnobs(); showInfo(); applyPar(); document.querySelectorAll('.key').forEach((x, j) => x.classList.toggle('sel', j === note)); }, (recEv.length - 1) * STEP + 1500));
  });
  refresh();

  // さきに こえを よみこんでおく(さいしょに さわった とき)
  document.addEventListener('pointerdown', () => { ensure(); KANA.split('').forEach((_, i) => load(i).catch(() => {})); }, { once: true });
  window.__aiueoBuild = buildVocoder;                              // たしかめよう(オフラインで ならして みる)
  window.__aiueo = { PAR, play, applyPar, get ac() { return ac; }, get voc() { return voc; }, VP };
})();
