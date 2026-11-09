// 宇宙船シンセ v2(Web Audio だけで作った、操縦席のシンセ)
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);

  const DEFAULTS = { wave: 'sawtooth', wave2: 'sawtooth', volume: 0.5, fmRatio: 2, fmDepth: 400, cutoff: 2400, q: 4, attack: 0.01, decay: 1, sustain: 1, fEnv: 0, fDecay: 0.4,
    osc2: 0, detune: 12, sub: 0, release: 0.4, delayTime: 0.35, feedback: 0.35, mix: 0.25, sweep: 0, sweepTime: 0.25, noise: 0, wobble: 0, wobbleRate: 5, arpRate: 6, arpSpan: 2 };
  const p = Object.assign({}, DEFAULTS);

  // ---- ミッション音(押すと音色が変わり、自動演奏のパターンがグリッドに出る) ----
  const PRE = {
    laser: { code: 'LASER', col: '#ff2d8a', p: { wave: 'square', wave2: 'sawtooth', osc2: 0.3, sub: 0, cutoff: 7000, q: 6, sweep: -3, sweepTime: 0.2, release: 0.15, attack: 0.002, decay: 0.2, sustain: 0.2, mix: 0.2, delayTime: 0.12, feedback: 0.3, noise: 0, wobble: 0 } },
    warp: { code: 'WARP', col: '#27e8ff', p: { wave: 'sawtooth', wave2: 'square', osc2: 0.4, sub: 0.5, cutoff: 3500, q: 8, sweep: 2.5, sweepTime: 1.1, attack: 0.3, decay: 1, sustain: 1, release: 1.2, mix: 0.45, feedback: 0.62, delayTime: 0.3, noise: 0, wobble: 0, fm: 'dial' } },
    alert: { code: 'ALERT', col: '#ff4a4a', p: { wave: 'square', osc2: 0, sub: 0, cutoff: 2600, q: 3, wobble: 0.75, wobbleRate: 1.6, attack: 0.02, sustain: 0.8, release: 0.1, mix: 0.1, noise: 0, sweep: 0 } },
    comms: { code: 'COMMS', col: '#2dff9b', p: { wave: 'square', osc2: 0, sub: 0, cutoff: 3200, q: 2, attack: 0.001, sustain: 0.9, release: 0.03, mix: 0.25, delayTime: 0.15, feedback: 0.3, noise: 0, wobble: 0, sweep: 0, fm: 260, fmRatio: 3.5 } },
    thrust: { code: 'THRUST', col: '#ffb000', p: { wave: 'sawtooth', wave2: 'square', osc2: 0.6, sub: 1, cutoff: 420, q: 2, noise: 0.9, wobble: 0.12, wobbleRate: 9, attack: 0.4, sustain: 1, release: 0.6, mix: 0.05, sweep: 0 } },
    sonar: { code: 'SONAR', col: '#9bd0ff', p: { wave: 'sine', osc2: 0, sub: 0, cutoff: 5000, q: 0.5, attack: 0.003, decay: 1.2, sustain: 0, release: 0.6, mix: 0.7, feedback: 0.72, delayTime: 0.45, noise: 0, wobble: 0, sweep: 0 } },
  };
  // 自動演奏のパターン(root=いちばん下の段の音、rate=1秒あたりのマス数、cells=[段,列]。つながったマスは音が伸びる)
  const rng = (r, a, b) => { const o = []; for (let c = a; c <= b; c++) o.push([r, c]); return o; };
  const PAT = {
    laser: { root: 72, rate: 11.76, cells: [].concat(rng(5, 0, 1), rng(5, 4, 5), rng(5, 8, 9), rng(5, 12, 13)) },
    warp: { root: 24, rate: 8, cells: rng(5, 0, 11) },
    alert: { root: 74, rate: 8, cells: rng(0, 0, 15) },
    comms: { root: 76, rate: 14.5, cells: [[5, 0], [5, 2]] },
    thrust: { root: 28, rate: 8, cells: rng(0, 0, 15) },
    sonar: { root: 69, rate: 6.7, cells: [[5, 0]] },
  };
  let ACT = null, LOCKED = false, pressing = null, lockTimer = 0;
  const events = [];                                              // 景色用の出来事(レーザー発射、ソナーなど)

  // 実際に鳴らす設定 = つまみの設定 + ミッション音の上書き
  function E() {
    const o = Object.assign({}, p), pr = ACT && PRE[ACT];
    if (pr) { Object.assign(o, pr.p); const f = pr.p.fm; o.fmDepth = f === 'dial' ? p.fmDepth : (typeof f === 'number' ? f : 0); }
    else o.fmDepth = 0;                                           // WARP を押していない間は、FM は効かない
    return o;
  }

  // ---- 音の経路: 声 → 出口 → [そのまま / エコー] → 音量 → コンプレッサー → スピーカー ----
  let ctx = null, out, dry, wet, delay, fb, master, analyser, noiseBuf;
  function ensureAudio() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    out = ctx.createGain(); dry = ctx.createGain(); wet = ctx.createGain();
    delay = ctx.createDelay(2); fb = ctx.createGain();
    master = ctx.createGain(); analyser = ctx.createAnalyser(); analyser.fftSize = 2048;
    const comp = ctx.createDynamicsCompressor();
    out.connect(dry); out.connect(delay); delay.connect(fb); fb.connect(delay); delay.connect(wet);
    dry.connect(master); wet.connect(master); master.connect(comp); comp.connect(analyser); analyser.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    applyGlobal();
  }
  const mixGains = (e) => { const s = 1 + e.osc2 + e.sub; return [1 / s, e.osc2 / s, e.sub / s]; };
  function applyGlobal() {
    if (!ctx) return;
    const t = ctx.currentTime, e = E();
    master.gain.setTargetAtTime(p.volume, t, 0.02);
    delay.delayTime.setTargetAtTime(e.delayTime, t, 0.05);
    fb.gain.setTargetAtTime(e.feedback, t, 0.02);
    dry.gain.setTargetAtTime(1 - e.mix * 0.5, t, 0.02);
    wet.gain.setTargetAtTime(e.mix, t, 0.02);
    const g = mixGains(e);
    for (const v of voices.values()) {
      v.filter.frequency.setTargetAtTime(e.cutoff, t, 0.02);
      v.filter.Q.setTargetAtTime(e.q, t, 0.02);
      v.modGain.gain.setTargetAtTime(e.fmDepth, t, 0.02);
      v.mod.frequency.setTargetAtTime(v.freq * e.fmRatio, t, 0.02);
      v.osc.type = e.wave; v.osc2.type = e.wave2; v.osc2.detune.setTargetAtTime(e.detune, t, 0.02);
      v.g1.gain.setTargetAtTime(g[0], t, 0.02); v.g2.gain.setTargetAtTime(g[1], t, 0.02); v.gs.gain.setTargetAtTime(g[2], t, 0.02);
      v.gn.gain.setTargetAtTime(e.noise * 0.9, t, 0.02);
      v.lfo.frequency.setTargetAtTime(e.wobbleRate, t, 0.02); v.lg.gain.setTargetAtTime(e.wobble * 700, t, 0.02);
    }
  }

  // ---- 声(1音)。id は鍵盤なら音番号、ミッション音なら文字 ----
  const voices = new Map();
  const midiToHz = (n) => 440 * Math.pow(2, (n - 69) / 12);
  function noteOn(id, midi) {
    ensureAudio();
    if (voices.has(id)) return;
    midi = midi == null ? id : midi;
    const e = E(), t = ctx.currentTime, freq = midiToHz(midi);
    const osc = ctx.createOscillator(), mod = ctx.createOscillator(), modGain = ctx.createGain();
    const osc2 = ctx.createOscillator(), sub = ctx.createOscillator(), g1 = ctx.createGain(), g2 = ctx.createGain(), gs = ctx.createGain();
    const filter = ctx.createBiquadFilter(), amp = ctx.createGain();
    const noise = ctx.createBufferSource(), gn = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
    osc.type = e.wave; osc.frequency.value = freq;
    osc2.type = e.wave2; osc2.frequency.value = freq; osc2.detune.value = e.detune;
    sub.type = 'sine'; sub.frequency.value = freq / 2;
    const mg = mixGains(e); g1.gain.value = mg[0]; g2.gain.value = mg[1]; gs.gain.value = mg[2];
    mod.frequency.value = freq * e.fmRatio; modGain.gain.value = e.fmDepth;
    mod.connect(modGain); modGain.connect(osc.frequency);
    noise.buffer = noiseBuf; noise.loop = true; gn.gain.value = e.noise * 0.9; noise.connect(gn); gn.connect(filter);
    lfo.frequency.value = e.wobbleRate; lg.gain.value = e.wobble * 700; lfo.connect(lg); lg.connect(osc.detune); lg.connect(osc2.detune); lg.connect(sub.detune);
    filter.type = 'lowpass'; filter.frequency.value = e.cutoff; filter.Q.value = e.q;
    amp.gain.setValueAtTime(0, t);
    amp.gain.linearRampToValueAtTime(0.25, t + e.attack);
    amp.gain.setTargetAtTime(0.25 * e.sustain, t + e.attack, Math.max(0.01, e.decay / 3));
    if (e.fEnv > 0.05) {
      const peak = Math.min(20000, e.cutoff * Math.pow(2, e.fEnv));
      filter.frequency.setValueAtTime(e.cutoff, t);
      filter.frequency.linearRampToValueAtTime(peak, t + e.attack + 0.005);
      filter.frequency.setTargetAtTime(e.cutoff, t + e.attack + 0.005, e.fDecay / 3);
    }
    if (Math.abs(e.sweep) > 0.02) {                               // 音程すべり: 高い所から落ちる(−)/低い所から上がる(+)
      const st = Math.pow(2, -e.sweep), T = e.sweepTime;
      [[osc, freq], [osc2, freq], [sub, freq / 2], [mod, freq * e.fmRatio]].forEach(([o, f]) => {
        o.frequency.setValueAtTime(Math.min(20000, f * st), t); o.frequency.exponentialRampToValueAtTime(f, t + T);
      });
    }
    osc.connect(g1); osc2.connect(g2); sub.connect(gs); g1.connect(filter); g2.connect(filter); gs.connect(filter);
    filter.connect(amp); amp.connect(out);
    const off = Math.random() * 1.5;
    [osc, osc2, sub, mod, lfo].forEach((o) => o.start(t)); noise.start(t, off);
    voices.set(id, { osc, osc2, sub, g1, g2, gs, mod, modGain, filter, amp, gn, lfo, lg, noise, freq, midi });
    keyEl(id, true);
  }
  function noteOff(id) {
    const v = voices.get(id);
    if (!v) return;
    voices.delete(id);
    const t = ctx.currentTime, rel = E().release;
    v.amp.gain.cancelScheduledValues(t);
    v.amp.gain.setValueAtTime(v.amp.gain.value, t);
    v.amp.gain.linearRampToValueAtTime(0, t + rel);
    [v.osc, v.osc2, v.sub, v.mod, v.lfo, v.noise].forEach((o) => { try { o.stop(t + rel + 0.05); } catch (e) { /* もう止まっている */ } });
    keyEl(id, false);
  }
  function click() {                                              // ロックの「カチッ」
    if (!ctx) return;
    const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'square'; o.frequency.value = 1800; g.gain.setValueAtTime(0.06, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
    o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + 0.04);
  }

  // ---- ミッション音の入り切り(音は、シーケンサーが自動で鳴らす) ----
  let selfPlay = true;
  function stopPreset() { seqHalt(); ACT = null; LOCKED = false; applyGlobal(); syncBtns(); syncSeq(); }
  function activate(name) {
    seqHalt(); ensureAudio(); ACT = name; LOCKED = false; applyGlobal();
    syncBtns(); syncSeq();
  }
  function setSelf(on) {                                          // OFF のときは、鍵盤の音色だけ変わる
    seqHalt(); selfPlay = on;
    const g = $('gsw'); g.classList.toggle('on', on); g.setAttribute('aria-pressed', on); g.querySelector('b').textContent = on ? 'ON' : 'OFF'; click();
    syncSeq();
  }
  $('gsw').addEventListener('click', () => { ensureAudio(); setSelf(!selfPlay); });
  function syncBtns() {
    const tg = $('mTog'); tg.classList.toggle('act', !!ACT); if (ACT) tg.style.setProperty('--k', '#2dff9b');
    document.querySelectorAll('.pbtn').forEach((b) => { b.classList.toggle('on', ACT === b.dataset.p); b.classList.toggle('lk', ACT === b.dataset.p && LOCKED); });
  }
  let mpTimer = 0;
  const hideMp = () => { clearTimeout(mpTimer); $('mp').classList.add('hide'); $('mTog').classList.remove('open'); };
  const keepMp = () => { clearTimeout(mpTimer); if (!$('mp').classList.contains('hide')) mpTimer = setTimeout(hideMp, 4000); };   // しばらく操作しなければ、自然に消える
  hideMp();
  $('mp').addEventListener('pointerdown', keepMp); $('mp').addEventListener('pointermove', keepMp); $('mp').addEventListener('click', keepMp);
  document.addEventListener('pointerdown', (e) => { if (!e.target.closest('#mp, #mTog')) hideMp(); });
  $('mTog').addEventListener('click', () => { const o = $('mp').classList.toggle('hide'); $('mTog').classList.toggle('open', !o); keepMp(); });
  document.querySelectorAll('.pbtn').forEach((b) => {
    const name = b.dataset.p;
    b.addEventListener('pointerdown', (e) => {                      // 押すたびに ON / OFF(別のを押すと切り替わる)
      e.preventDefault(); ensureAudio();
      if (ACT === name) stopPreset(); else activate(name);
      click();
    });
    b.addEventListener('pointerup', hideMp); b.addEventListener('pointercancel', hideMp);
    b.addEventListener('contextmenu', (e) => e.preventDefault());
  });

  // ---- 自動演奏: OFF / DRONE(一定の高さを鳴らし続ける) / ARP(押さえた鍵盤を順番に鳴らす) ----
  // ---- 段のあるレバー(モード切り替え用) ----
  function mkLever(box, opts, get, set) {
    const n = opts.length;
    box.innerHTML = '<div class="sl"><div class="slot"><div class="hd"></div></div><div class="labs"></div></div>';
    const sl = box.firstChild, slot = sl.querySelector('.slot'), hd = sl.querySelector('.hd'), labs = sl.querySelector('.labs');
    opts.forEach(([v, l, s], i) => { const b = document.createElement('button'); b.type = 'button'; b.innerHTML = l + (s ? '<small>' + s + '</small>' : ''); b.dataset.i = i; labs.appendChild(b); });
    const sync = () => { const i = Math.max(0, opts.findIndex((o) => o[0] === get())); hd.style.left = (n === 1 ? 50 : i / (n - 1) * 100) + '%'; [...labs.children].forEach((b, k) => b.classList.toggle('on', k === i)); };
    const at = (e) => { const r = slot.getBoundingClientRect(); return Math.max(0, Math.min(n - 1, Math.round((e.clientX - r.left) / r.width * (n - 1)))); };
    let on = false;
    sl.addEventListener('pointerdown', (e) => { if (e.target.closest('.labs button')) return; e.preventDefault(); sl.setPointerCapture(e.pointerId); on = true; set(opts[at(e)][0]); sync(); });
    sl.addEventListener('pointermove', (e) => { if (!on) return; const v = opts[at(e)][0]; if (v !== get()) { set(v); sync(); } });
    sl.addEventListener('pointerup', () => { on = false; }); sl.addEventListener('pointercancel', () => { on = false; });
    labs.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; set(opts[+b.dataset.i][0]); sync(); });
    sync(); return sync;
  }
  let autoMode = 'off', droneNote = null, arpTimer = 0, arpIdx = 0;
  const arpHeld = new Set(), arpNotes = new Set();                // arpHeld=いま押している鍵盤、arpNotes=くり返し鳴らす音(離しても残る)
  function setDrone(n) { noteOff('a'); droneNote = n; noteOn('a', n); }
  function stopDrone() { noteOff('a'); }
  function arpStep() {
    if (autoMode !== 'arp' || !arpNotes.size) return;
    const base0 = [...arpNotes].sort((a, b) => a - b), list = [];
    for (let k = 0; k < Math.round(p.arpSpan); k++) base0.forEach((n) => list.push(n + 12 * k));
    const n = list[arpIdx % list.length]; arpIdx++;
    noteOff('arp'); noteOn('arp', n);
    events.push({ type: 'arp', t: performance.now() / 1000 });
    const iv = 1000 / p.arpRate; setTimeout(() => noteOff('arp'), iv * 0.6);
    arpTimer = setTimeout(arpStep, iv);
  }
  function startArp() { if (arpTimer) return; arpIdx = 0; arpStep(); }
  function stopArp() { clearTimeout(arpTimer); arpTimer = 0; noteOff('arp'); }
  function press(n) {
    if (autoMode === 'arp') {                                      // 新しく押しはじめたら、くり返す音を入れ替える
      if (!arpHeld.size) arpNotes.clear();
      arpHeld.add(n); arpNotes.add(n); keyEl(n, true); ensureAudio(); startArp(); return;
    }
    if (autoMode === 'drone') setDrone(n);
    noteOn(n);
  }
  function release(n) {
    if (arpHeld.has(n)) { arpHeld.delete(n); keyEl(n, false); return; }
    noteOff(n);
  }
  function releaseAll() { for (const n of [...voices.keys()]) if (typeof n === 'number') noteOff(n); [...arpHeld].forEach((n) => keyEl(n, false)); arpHeld.clear(); }
  // ---- シーケンサー(音階をグリッドに並べて、自動で鳴らす) ----
  const PRE_IV = [0, 3, 5, 7, 10, 12, 15, 17, 19, 22], PRE_N = 10, PRE_W = 16;     // ミッション音のパターンは、この枠(マイナーペンタ2オクターブ×16マス)で作ってある
  const MAXR = 36, MAXW = 32;
  const SCALES = { mp: ['MINOR PENTA', [0, 3, 5, 7, 10]], Mp: ['MAJOR PENTA', [0, 2, 4, 7, 9]], mi: ['MINOR', [0, 2, 3, 5, 7, 8, 10]], ma: ['MAJOR', [0, 2, 4, 5, 7, 9, 11]], ry: ['RYUKYU', [0, 4, 5, 7, 11]], ch: ['CHROMATIC', [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]] };
  const SCF = { user: { scale: 'mp', oct: 2, len: 16, root: null } };       // 範囲の設定(自分のパターンと、ミッション音ごとに別々)
  Object.keys(PAT).forEach((k) => { SCF[k] = { scale: 'mp', oct: 2, len: 16, root: null }; });
  const curSC = () => viewPre() ? SCF[ACT] : SCF.user;
  const cfgFor = (sc) => { const base0 = SCALES[sc.scale][1], iv = []; for (let k = 0; k < sc.oct; k++) base0.forEach((v) => iv.push(v + 12 * k)); return { iv, N: iv.length, W: sc.len, key: iv.length + 'x' + sc.len + ':' + sc.scale }; };
  const NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
  const OCT_COL = { 0: '#ff5a2d', 1: '#ff2d8a', 2: '#ffb000', 3: '#2dff9b', 4: '#27e8ff', 5: '#a66bff', 6: '#ff5a2d', 7: '#ff2d8a' };   // オクターブごとの蛍光色
  const octCol = (m) => OCT_COL[Math.floor(m / 12) - 1] || '#27e8ff';
  const mkGrid = (cells) => { const g = Array.from({ length: MAXR }, () => new Array(MAXW).fill(false)); cells.forEach(([r, c]) => { g[r][c] = true; }); return g; };
  const USER_RIFF = [[0, 0], [3, 2], [4, 4], [3, 6], [0, 8], [2, 10], [3, 12], [5, 14], [0, 14], [8, 12]];
  const userGrid = mkGrid(USER_RIFF), PGRID = {};
  Object.keys(PAT).forEach((k) => { PGRID[k] = mkGrid(PAT[k].cells); });
  let seqTimer = 0, seqStep = 0, seqCells = null, seqLabs = null, seqSrc = null, seqDim = '';      // seqSrc: 鳴らしている元('pre'=ミッション音 / 'user'=SEQ / null)
  const viewPre = () => !!ACT;                                                        // グリッドに出すのは、選んでいるミッション音のパターン(AUTOPILOT の ON/OFF に関係なく)。何も選んでいなければ MY PATTERN
  const viewGrid = () => viewPre() ? PGRID[ACT] : userGrid;
  const rootFor = (pre) => { const sc = pre ? SCF[ACT] : SCF.user; return sc.root != null ? sc.root : (pre ? PAT[ACT].root : base); };   // 範囲の一番下の音。ふだん(AUTO)は、自分用=鍵盤のOCT、ミッション音=その音の元の高さ
  const viewBase = () => rootFor(viewPre());
  function buildCells() {
    const g = $('sqGrid'), lab = $('sqLab'), c0 = cfgFor(curSC()); g.innerHTML = ''; lab.innerHTML = ''; seqCells = []; seqLabs = [];
    const rh = c0.N > 12 ? Math.max(11, Math.floor(288 / c0.N)) : 24;
    g.style.gridTemplateColumns = 'repeat(' + c0.W + ',1fr)'; g.style.gridTemplateRows = 'repeat(' + c0.N + ',' + rh + 'px)';
    lab.style.gridTemplateRows = 'repeat(' + c0.N + ',' + rh + 'px)'; lab.style.rowGap = '2px'; lab.style.fontSize = rh < 16 ? '7px' : '8px';
    for (let r = c0.N - 1; r >= 0; r--) {
      const l = document.createElement('div'); l.className = 'sqL'; lab.appendChild(l); seqLabs[r] = l;
      for (let c = 0; c < c0.W; c++) {
        const d = document.createElement('div'); d.className = 'sqc' + (c % 4 === 0 ? ' b4' : ''); d.dataset.r = r; d.dataset.c = c;
        g.appendChild(d); (seqCells[r] = seqCells[r] || [])[c] = d;
      }
    }
    seqDim = c0.key;
  }
  function initSeq() {
    const g = $('sqGrid'); let paint = null;
    const hit = (e) => { const el = document.elementFromPoint(e.clientX, e.clientY); return el && el.classList.contains('sqc') ? el : null; };
    const set = (el, v) => { const G = viewGrid(), r = +el.dataset.r, c = +el.dataset.c; if (G[r][c] === v) return; G[r][c] = v; el.classList.toggle('on', v); if (v) { ensureAudio(); const id = 'p'; noteOff(id); noteOn(id, viewBase() + cfgFor(curSC()).iv[r]); setTimeout(() => noteOff(id), 160); } };
    g.addEventListener('pointerdown', (e) => { const el = hit(e); if (!el) return; e.preventDefault(); g.setPointerCapture(e.pointerId); paint = !viewGrid()[+el.dataset.r][+el.dataset.c]; set(el, paint); });
    g.addEventListener('pointermove', (e) => { if (paint === null) return; const el = hit(e); if (el) set(el, paint); });
    const up = () => { paint = null; }; g.addEventListener('pointerup', up); g.addEventListener('pointercancel', up);
    $('sqClr').onclick = () => { viewGrid().forEach((row) => row.fill(false)); refreshGrid(); };
    $('sqRst').onclick = () => { Object.assign(curSC(), { scale: 'mp', oct: 2, len: 16, root: null }); const G = viewGrid(), src = mkGrid(viewPre() ? PAT[ACT].cells : USER_RIFF); G.forEach((row, r) => row.forEach((v, c) => { row[c] = src[r][c]; })); seqHalt(); syncSeq(); };
    const nearest = (iv, v) => { let bi = 0; iv.forEach((x, i) => { if (Math.abs(x - v) < Math.abs(iv[bi] - v)) bi = i; }); return bi; };
    const change = (key, val) => {                                 // 範囲を変える。いまのパターンは、できるだけ同じ高さ・同じ位置に引き継ぐ
      const sc = curSC(), G = viewGrid(), old = cfgFor(sc), oldLen = sc.len; sc[key] = val; const nw = cfgFor(sc);
      if (key !== 'len') {
        const on = []; for (let r = 0; r < old.N; r++) for (let c = 0; c < MAXW; c++) if (G[r][c]) on.push([nearest(nw.iv, old.iv[r]), c]);
        G.forEach((row) => row.fill(false)); on.forEach(([r, c]) => { G[r][c] = true; });
      } else if (val > oldLen) for (let r = 0; r < MAXR; r++) for (let c = oldLen; c < val; c++) G[r][c] = G[r][c % oldLen];   // 長くしたら、くり返しで埋める
      seqHalt(); syncSeq();
    };
    const sel = (id, key, opts, conv) => { const el = $(id); el.innerHTML = opts.map(([v, l]) => '<option value="' + v + '">' + l + '</option>').join(''); el.onchange = () => change(key, conv(el.value)); };
    sel('sqScale', 'scale', Object.keys(SCALES).map((k) => [k, SCALES[k][0]]), (v) => v);
    sel('sqOct', 'oct', [[1, '1'], [2, '2'], [3, '3']], Number);
    sel('sqLen', 'len', [[8, '8'], [16, '16'], [32, '32']], Number);
    // 見た目: 本物の<select>は隠して、操作盤に合わせた部品で操作する(値は<select>に入れて、onchangeを呼ぶ)
    const sk = $('sqSk'), fire = (id, v) => { const el = $(id); el.value = v; el.onchange(); skinSync(); };
    const dd = document.createElement('div'); dd.className = 'dd';
    dd.innerHTML = '<button type="button" aria-haspopup="listbox"><span><small>SCALE</small> <b></b></span></button><ul role="listbox"></ul>';
    const ul = dd.querySelector('ul'), btn = dd.querySelector('button');
    Object.keys(SCALES).forEach((k) => { const li = document.createElement('li'); li.dataset.v = k; li.textContent = SCALES[k][0]; li.setAttribute('role', 'option'); li.onclick = () => { dd.classList.remove('open'); fire('sqScale', k); }; ul.appendChild(li); });
    btn.onclick = () => dd.classList.toggle('open');
    document.addEventListener('pointerdown', (e) => { if (!dd.contains(e.target)) dd.classList.remove('open'); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') dd.classList.remove('open'); });
    $('sqDd').appendChild(dd);
    const dd2 = document.createElement('div'); dd2.className = 'dd';
    dd2.innerHTML = '<button type="button" aria-haspopup="listbox"><span><small>FROM</small> <b></b></span></button><ul role="listbox"></ul>';
    const ul2 = dd2.querySelector('ul'), btn2 = dd2.querySelector('button');
    btn2.onclick = () => { dd.classList.remove('open'); dd2.classList.toggle('open'); }; btn.onclick = () => { dd2.classList.remove('open'); dd.classList.toggle('open'); };
    document.addEventListener('pointerdown', (e) => { if (!dd2.contains(e.target)) dd2.classList.remove('open'); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') dd2.classList.remove('open'); });
    const noteName = (m) => NAMES[m % 12] + (Math.floor(m / 12) - 1);
    const setRoot = (m) => { curSC().root = m; updateSeqLabels(); skinSync(); };
    skinRoot = () => {      // 選べる「一番下の音」を作り直す(音名は、元の高さの音名に合わせる)
      const pre = viewPre(), def = pre ? PAT[ACT].root : base, pc = def % 12, cur = curSC().root;
      ul2.innerHTML = '';
      const add = (v, label) => { const li = document.createElement('li'); li.textContent = label; li.dataset.v = v == null ? '' : v; li.className = (cur == null ? v == null : cur === v) ? 'on' : ''; li.onclick = () => { dd2.classList.remove('open'); setRoot(v); }; ul2.appendChild(li); };
      add(null, 'AUTO (' + noteName(def) + ')');
      for (let o = 1; o <= 6; o++) add(pc + 12 * (o + 1), noteName(pc + 12 * (o + 1)));
      dd2.querySelector('b').textContent = cur == null ? 'AUTO · ' + noteName(def) : noteName(cur);
    };
    $('sqDd').appendChild(dd2);
    const seg = (id, label, unit, vals) => { const w = document.createElement('div'); w.className = 'sqseg'; w.innerHTML = '<span>' + label + '</span>'; vals.forEach((v) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'seg'; b.dataset.v = v; b.textContent = v + unit; b.onclick = () => fire(id, v); w.appendChild(b); }); w.dataset.id = id; sk.appendChild(w); };
    seg('sqOct', 'OCT', '', [1, 2, 3]); seg('sqLen', 'STEP', '', [8, 16, 32]);
    skinSync = () => {
      const sc = curSC(); dd.querySelector('b').textContent = SCALES[sc.scale][0]; skinRoot();
      ul.querySelectorAll('li').forEach((li) => li.classList.toggle('on', li.dataset.v === sc.scale));
      sk.querySelectorAll('.sqseg').forEach((w) => w.querySelectorAll('button').forEach((b) => b.classList.toggle('on', +b.dataset.v === sc[w.dataset.id === 'sqOct' ? 'oct' : 'len'])));
    };
    skinSync();
    refreshGrid();
  }
  let skinSync = () => {}, skinRoot = () => {};
  function refreshGrid() {
    const pre = viewPre(), c0 = cfgFor(curSC());
    if (!seqCells || seqDim !== c0.key) buildCells();
    const G = viewGrid(), col = pre ? PRE[ACT].col : '#27e8ff';
    for (let r = 0; r < c0.N; r++) for (let c = 0; c < c0.W; c++) seqCells[r][c].classList.toggle('on', G[r][c]);
    updateSeqLabels();
    const t = $('sqSrc'); if (t) { t.textContent = pre ? PRE[ACT].code + ' PATTERN' : 'MY PATTERN'; t.style.color = col; }
    const sc = curSC(); $('sqScale').value = sc.scale; $('sqOct').value = sc.oct; $('sqLen').value = sc.len; skinSync();
  }
  function updateSeqLabels() {
    if (!seqLabs) return;
    const c0 = cfgFor(curSC()), b0 = viewBase();
    c0.iv.forEach((iv, r) => { if (!seqLabs[r]) return; const m = b0 + iv; seqLabs[r].textContent = NAMES[m % 12] + (Math.floor(m / 12) - 1); seqLabs[r].style.color = octCol(m); });
    for (let r = 0; r < c0.N; r++) for (let c = 0; c < c0.W; c++) seqCells[r][c].style.setProperty('--o', octCol(b0 + c0.iv[r]));
  }
  function seqTick() {
    if (!seqSrc) return;
    const pre = seqSrc === 'pre' && ACT, sc = pre ? SCF[ACT] : SCF.user, c0 = cfgFor(sc), W = c0.W, G = pre ? PGRID[ACT] : userGrid, B = rootFor(pre), rate = pre ? PAT[ACT].rate : p.arpRate;
    const col = seqStep % W, prv = (col + W - 1) % W, nxt = (col + 1) % W; seqStep++;
    if (seqCells && seqDim === c0.key && viewPre() === !!pre) for (let r = 0; r < c0.N; r++) for (let c = 0; c < W; c++) seqCells[r][c].classList.toggle('ph', c === col);
    const iv = 1000 / rate; let any = false;
    for (let r = 0; r < c0.N; r++) {
      const id = 's' + r;
      if (G[r][col]) {
        if (!G[r][prv] || !voices.has(id)) { any = true; noteOff(id); noteOn(id, B + c0.iv[r]); }   // つながったマスは、鳴らしっぱなし
        if (!G[r][nxt]) setTimeout(() => noteOff(id), iv * 0.75);
      } else noteOff(id);
    }
    if (any) events.push({ type: pre ? ACT : 'arp', t: performance.now() / 1000 });
    seqTimer = setTimeout(seqTick, iv);
  }
  function seqHalt() { clearTimeout(seqTimer); seqTimer = 0; seqSrc = null; for (let r = 0; r < MAXR; r++) noteOff('s' + r); if (seqCells) seqCells.forEach((row) => row.forEach((d) => d.classList.remove('ph'))); }
  function syncSeq() {
    const w = ACT ? ((selfPlay || autoMode === 'seq') ? 'pre' : null) : (autoMode === 'seq' ? 'user' : null);   // 鳴るのは、出ているグリッド。ミッション音+AUTOPILOT ON、または AUTO=SEQ のとき
    if (w !== seqSrc) { seqHalt(); seqSrc = w; if (w) { seqStep = 0; seqTick(); } }
    refreshGrid();
  }
  let autoSync = null;
  function setAuto(m) {
    if (autoMode === 'arp' && m !== 'arp') { [...arpHeld].forEach((n) => keyEl(n, false)); arpHeld.clear(); arpNotes.clear(); stopArp(); }
    if (m !== 'drone') stopDrone();
    autoMode = m; ensureAudio();
    if (m === 'drone') setDrone(droneNote == null ? base : droneNote);                 // 選んだだけで、一定の高さが鳴りはじめる
    if (m === 'arp') { if (!arpNotes.size) [0, 3, 7].forEach((d) => arpNotes.add(base + d)); startArp(); }   // 選んだだけで、和音が順番に鳴りはじめる
    syncSeq();
    if (autoSync) autoSync();
    $('mTog').classList.toggle('auto', m !== 'off');
  }
  autoSync = mkLever($('autoLv'), [['off', 'OFF'], ['drone', 'DRONE'], ['arp', 'ARP'], ['seq', 'SEQ']], () => autoMode, setAuto);


  // ---- 鍵盤(2オクターブ) ----
  let base = 48;
  const PC = 'zsxdcvgbhnjmq2w3er5t6y7u';
  const WHITE = [0, 2, 4, 5, 7, 9, 11];
  function buildKeys() {
    const box = $('kb'); box.innerHTML = '';
    const ww = 100 / 14; let wi = 0;
    for (let i = 0; i < 24; i++) {
      const n = base + i, isW = WHITE.includes(i % 12);
      const k = document.createElement('div');
      k.className = isW ? 'wk' : 'bk'; k.dataset.note = n; k.style.setProperty('--o', octCol(n));
      if (isW) { k.style.left = (wi * ww) + '%'; k.style.width = ww + '%'; wi++; }
      else { k.style.left = (wi * ww - ww * 0.3) + '%'; k.style.width = (ww * 0.6) + '%'; }
      if (isW) k.innerHTML = '<span>' + (i % 12 === 0 ? 'C' + (n / 12 - 1) + '<br>' : '') + PC[i].toUpperCase() + '</span>';
      box.appendChild(k);
    }
    $('octl').textContent = 'OCT C' + (base / 12 - 1); updateSeqLabels();
  }
  function keyEl(id, on) {
    if (typeof id !== 'number') return;
    const k = document.querySelector('[data-note="' + id + '"]'); if (k) k.classList.toggle('dn', on);
  }
  const pointerNote = new Map();
  $('kb').addEventListener('pointerdown', (e) => {
    const k = e.target.closest('[data-note]'); if (!k) return;
    e.preventDefault(); $('kb').setPointerCapture(e.pointerId);
    pointerNote.set(e.pointerId, +k.dataset.note); press(+k.dataset.note);
  });
  $('kb').addEventListener('pointermove', (e) => {
    if (!pointerNote.has(e.pointerId)) return;
    const el = document.elementFromPoint(e.clientX, e.clientY), k = el && el.closest('[data-note]'); if (!k) return;
    const n = +k.dataset.note, old = pointerNote.get(e.pointerId);
    if (n !== old) { release(old); pointerNote.set(e.pointerId, n); press(n); }
  });
  const kup = (e) => { if (pointerNote.has(e.pointerId)) { release(pointerNote.get(e.pointerId)); pointerNote.delete(e.pointerId); } };
  $('kb').addEventListener('pointerup', kup); $('kb').addEventListener('pointercancel', kup);
  const held = new Map();
  window.addEventListener('keydown', (e) => {
    if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
    const i = PC.indexOf(e.key.toLowerCase()); if (i < 0) return;
    held.set(e.key.toLowerCase(), base + i); press(base + i);
  });
  window.addEventListener('keyup', (e) => { const k = e.key.toLowerCase(); if (held.has(k)) { release(held.get(k)); held.delete(k); } });
  window.addEventListener('blur', () => { releaseAll(); held.clear(); });
  const shift = (d) => { releaseAll(); base = Math.min(84, Math.max(24, base + d)); buildKeys(); };
  $('octdn').onclick = () => shift(-12); $('octup').onclick = () => shift(12);

  // ---- つまみ・レバー・スイッチ ----
  const toS = (v, min, max, log) => log ? Math.log(v / min) / Math.log(max / min) : (v - min) / (max - min);
  const fromS = (s, min, max, log) => log ? min * Math.pow(max / min, s) : min + s * (max - min);
  const f1 = (n, u) => (v) => v.toFixed(n) + u;
  const ctlDefs = {
    g1: [['cutoff', 'CUTOFF', '明るさ', 80, 12000, 1, true, (v) => Math.round(v) + 'Hz'], ['q', 'RESO', 'クセ', 0.1, 25, 0.1, false, f1(1, '')], ['fEnv', 'F-ENV', '押した瞬間の開き', 0, 6, 0.1, false, (v) => v < 0.05 ? 'OFF' : '+' + v.toFixed(1)], ['fDecay', 'F-DEC', '閉じる時間', 0.02, 3, 0.01, true, f1(2, 's')]],
    g7: [['fmDepth', 'WARP FM', 'ワープの強さ', 0, 2000, 1, false, (v) => Math.round(v)], ['fmRatio', 'FM RATIO', '比率', 0.5, 8, 0.5, false, (v) => '×' + v]],
    g2: [['osc2', 'OSC2 MIX', '2つ目の量', 0, 1, 0.01, false, (v) => v < 0.02 ? 'OFF' : Math.round(v * 100) + '%'], ['detune', 'DETUNE', 'ずらし', 0, 50, 0.5, false, f1(1, 'ct')], ['sub', 'SUB', '1オクターブ下', 0, 1, 0.01, false, (v) => v < 0.02 ? 'OFF' : Math.round(v * 100) + '%']],
    g3: [['sweep', 'PITCH SWP', '音程すべり', -3, 3, 0.05, false, (v) => Math.abs(v) < 0.05 ? 'OFF' : (v > 0 ? '↑' : '↓') + Math.abs(v).toFixed(1) + 'oct'], ['noise', 'NOISE', 'ノイズ', 0, 1, 0.01, false, (v) => v < 0.02 ? 'OFF' : Math.round(v * 100) + '%'], ['wobble', 'WOBBLE', 'うねり', 0, 1, 0.01, false, (v) => v < 0.02 ? 'OFF' : Math.round(v * 100) + '%']],
    g4: [['delayTime', 'TIME', '間隔', 0.05, 1.2, 0.01, false, f1(2, 's')], ['feedback', 'FDBK', 'くり返し', 0, 0.9, 0.01, false, (v) => Math.round(v * 100) + '%'], ['mix', 'MIX', '量', 0, 1, 0.01, false, (v) => Math.round(v * 100) + '%']],
    g6: [['arpRate', 'RATE', '速さ(ARP・SEQ)', 1, 20, 0.5, true, (v) => v.toFixed(1) + '/s'], ['arpSpan', 'ARP SPAN', '何オクターブ', 1, 3, 1, false, (v) => Math.round(v) + 'oct']],
    g5: [['attack', 'ATK', '立ち上がり', 0.001, 2, 0.001, true, f1(2, 's')], ['decay', 'DEC', '減っていく', 0.01, 3, 0.01, true, f1(2, 's')], ['sustain', 'SUS', '押している間', 0, 1, 0.01, false, (v) => Math.round(v * 100) + '%'], ['release', 'REL', '余韻', 0.01, 4, 0.01, true, f1(2, 's')]],
  };
  const setters = {}, waveSync = {};
  function drag(el, key, min, max, log, step, render) {
    let sy = 0, ss = 0, on = false;
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); el.setPointerCapture(e.pointerId); on = true; sy = e.clientY; ss = toS(p[key], min, max, log); });
    el.addEventListener('pointermove', (e) => {
      if (!on) return;
      const s = Math.max(0, Math.min(1, ss + (sy - e.clientY) / 150));
      let v = fromS(s, min, max, log); if (!log) v = Math.round(v / step) * step; v = Math.max(min, Math.min(max, v));
      p[key] = v; render(); applyGlobal();
    });
    const up = () => { on = false; }; el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    el.addEventListener('dblclick', () => { p[key] = DEFAULTS[key]; render(); applyGlobal(); });
  }
  // 音色のつまみをランダムにする(音量・ARP/SEQの設定は変えない。大きな音にならない範囲で)
  // 対象(OSC / FILTER / ALL)のつまみだけをランダムにする
  let rndScope = 'all', undoSnap = null;
  const RKEYS = ['wave', 'wave2', 'cutoff', 'q', 'fEnv', 'fDecay', 'fmDepth', 'fmRatio', 'osc2', 'detune', 'sub', 'sweep', 'noise', 'wobble', 'attack', 'decay', 'sustain', 'release', 'delayTime', 'feedback', 'mix'];
  const RSCOPE = { osc: ['wave', 'wave2', 'fmDepth', 'fmRatio', 'osc2', 'detune', 'sub', 'sweep', 'noise', 'wobble'], filter: ['cutoff', 'q', 'fEnv', 'fDecay'], all: RKEYS };
  function randomize() {
    undoSnap = {}; RKEYS.forEach((k) => { undoSnap[k] = p[k]; });
    const r = (a, b) => a + Math.random() * (b - a), lg = (a, b) => a * Math.pow(b / a, Math.random()), pick = (a) => a[Math.floor(Math.random() * a.length)];
    const W4 = ['sine', 'triangle', 'sawtooth', 'square'];
    const n = {
      wave: pick(W4), wave2: pick(W4), cutoff: lg(250, 9000), q: r(0.5, 12), fEnv: Math.random() < 0.5 ? 0 : r(0.5, 4), fDecay: r(0.1, 1.5),
      fmDepth: Math.random() < 0.4 ? 0 : r(50, 800), fmRatio: pick([0.5, 1, 1.5, 2, 3, 4, 5, 6]),
      osc2: Math.random() < 0.3 ? 0 : r(0.2, 0.8), detune: r(0, 30), sub: Math.random() < 0.5 ? 0 : r(0.2, 0.6),
      sweep: Math.random() < 0.7 ? 0 : (Math.random() < 0.5 ? -1 : 1) * r(0.3, 1.5), noise: Math.random() < 0.7 ? 0 : r(0.05, 0.3), wobble: Math.random() < 0.6 ? 0 : r(0.1, 0.5),
      attack: lg(0.002, 0.5), decay: r(0.1, 2), sustain: r(0.3, 1), release: r(0.1, 2),
      delayTime: r(0.1, 0.7), feedback: r(0.1, 0.6), mix: Math.random() < 0.2 ? 0 : r(0.1, 0.5),
    };
    RSCOPE[rndScope].forEach((k) => { p[k] = n[k]; });
    refreshAll();
  }
  function refreshAll() {
    Object.keys(setters).forEach((k) => { if (k !== 'volume' && k !== 'arpRate' && k !== 'arpSpan') setters[k](); });
    Object.keys(waveSync).forEach((k) => waveSync[k]());
    applyGlobal(); drawFilter();
  }
  // FILTERの効き具合の窓(周波数ごとの通り方。点線は、鳴らした瞬間に開いたとき)
  let fwin = null;
  function drawFilter() {
    if (!fwin) return;
    const c = fwin.getContext('2d'), W = fwin.width, H = fwin.height, lo = Math.log(30), hi = Math.log(18000), DB = 24;
    const resp = (fc, qdb) => { const ql = Math.pow(10, qdb / 20); return (f) => { const x = f / fc, m = 1 / Math.sqrt(Math.pow(1 - x * x, 2) + x * x / (ql * ql)); return 20 * Math.log10(m); }; };
    const X = (f) => (Math.log(f) - lo) / (hi - lo) * W, Y = (d) => H - 8 - (Math.max(-DB, Math.min(DB, d)) + DB) / (2 * DB) * (H - 16);
    c.clearRect(0, 0, W, H);
    c.strokeStyle = '#17323c'; c.lineWidth = 1; c.beginPath();
    [100, 1000, 10000].forEach((f) => { c.moveTo(X(f), 0); c.lineTo(X(f), H); }); c.moveTo(0, Y(0)); c.lineTo(W, Y(0)); c.stroke();
    const path = (fc, col, dash, fill) => {
      const h = resp(fc, p.q); c.beginPath();
      for (let i = 0; i <= 120; i++) { const f = Math.exp(lo + (hi - lo) * i / 120), x = X(f), y = Y(h(f)); i ? c.lineTo(x, y) : c.moveTo(x, y); }
      c.setLineDash(dash || []); c.strokeStyle = col; c.lineWidth = 2; c.stroke(); c.setLineDash([]);
      if (fill) { c.lineTo(W, H); c.lineTo(0, H); c.closePath(); c.fillStyle = fill; c.fill(); }
    };
    if (p.fEnv > 0.05) path(Math.min(20000, p.cutoff * Math.pow(2, p.fEnv)), '#27e8ff99', [5, 4]);
    path(p.cutoff, '#2dff9b', null, '#2dff9b22');
  }
  function buildKnobs() {
    for (const g in ctlDefs) {
      const box = $(g);
      for (const [key, label, jp, min, max, step, log, fmt] of ctlDefs[g]) {
        const el = document.createElement('div'); el.className = 'kn' + ((key === 'cutoff' || key === 'q') ? ' big' : '');
        if (key === 'arpSpan') {      // 1・2・3の3択なので、つまみでなくボタン
          el.classList.add('sp');
          el.innerHTML = '<div class="spbtn"></div><div class="kl">' + label + '</div><output></output>';
          const row = el.querySelector('.spbtn'), o = el.querySelector('output');
          const bs = [1, 2, 3].map((n) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'seg'; b.textContent = n; b.onclick = () => { p.arpSpan = n; render(); applyGlobal(); }; row.appendChild(b); return b; });
          const render = () => { bs.forEach((b, i) => b.classList.toggle('on', Math.round(p.arpSpan) === i + 1)); o.textContent = Math.round(p.arpSpan) + 'oct'; };
          render(); setters[key] = render; box.appendChild(el); continue;
        }
        const lever = g === 'g5';
        el.innerHTML = lever
          ? '<div class="lv sm"><div class="tr"></div><div class="tk"></div><div class="hd"></div></div><div class="kl">' + label + '</div><output></output>'
          : '<div class="dial"><i></i></div><div class="kl">' + label + '</div><output></output>';
        const o = el.querySelector('output');
        const render = () => {
          if (key === 'mix' || key === 'delayTime') { const l = $('ecLed'); if (l) { l.classList.toggle('on', p.mix > 0); l.style.setProperty('--ect', Math.max(0.08, p.delayTime) + 's'); } }      // ECHOがかかっている間、ディレイの間隔でLEDが点滅する
          if (key === 'cutoff' || key === 'q' || key === 'fEnv') drawFilter();
          const s = toS(p[key], min, max, log); o.textContent = fmt(p[key]);
          if (lever) el.querySelector('.hd').style.bottom = (s * 100) + '%'; else el.querySelector('.dial').style.setProperty('--r', (-135 + 270 * s) + 'deg');
        };
        render(); setters[key] = render; drag(el, key, min, max, log, step, render); box.appendChild(el);
      }
      if (g === 'g1') { fwin = document.createElement('canvas'); fwin.className = 'fwin'; fwin.width = 240; fwin.height = 148; box.appendChild(fwin); drawFilter(); }
    }
    // 音量(窓の左端の縦スライダー)
    const vs = $('vsl'), vf = vs.querySelector('.vf'), vk = vs.querySelector('.vk'), vo = vs.querySelector('output');
    const render = () => { const pc = Math.round(p.volume * 100); vf.style.height = pc + '%'; vk.style.bottom = 'calc(' + pc + '% - 4px)'; vo.textContent = pc; vs.setAttribute('aria-valuenow', pc); };
    render(); setters.volume = render;
    const tr = vs.querySelector('.vt'); let vdown = false;
    const setV = (e) => { const r = tr.getBoundingClientRect(); p.volume = Math.max(0, Math.min(1, 1 - (e.clientY - r.top) / r.height)); applyGlobal(); render(); };
    vs.addEventListener('pointerdown', (e) => { e.preventDefault(); ensureAudio(); vs.setPointerCapture(e.pointerId); vdown = true; setV(e); });
    vs.addEventListener('pointermove', (e) => { if (vdown) setV(e); });
    const vup = () => { vdown = false; }; vs.addEventListener('pointerup', vup); vs.addEventListener('pointercancel', vup);
    // 波のかたちのスイッチ
    const WV = [['sine', 'SIN'], ['triangle', 'TRI'], ['sawtooth', 'SAW'], ['square', 'SQR']];
    [['tg1', 'wave', 'OSC1'], ['tg2', 'wave2', 'OSC2']].forEach(([id, key, name]) => {
      const box = $(id); box.innerHTML = '<span class="t">' + name + '</span><div class="slw"></div>';
      waveSync[key] = mkLever(box.querySelector('.slw'), WV.map(([w, l]) => [w, l]), () => p[key], (v) => { p[key] = v; applyGlobal(); });
    });
    // RANDOM(赤いボタン + 警告のふた): ふたを開けると押せる。押したら、ふたは自動で閉まる
    { const box = $('rbox'); let tm = 0;
      const close = () => { box.classList.remove('open'); clearTimeout(tm); };
      $('rndCov').onclick = () => { box.classList.add('open'); clearTimeout(tm); tm = setTimeout(close, 6000); };
      $('rndBtn').onclick = () => { ensureAudio(); randomize(); $('rndUndo').disabled = false; close(); };
      $('rndUndo').onclick = () => { if (!undoSnap) return; Object.assign(p, undoSnap); undoSnap = null; $('rndUndo').disabled = true; refreshAll(); };
      $('rRange').querySelectorAll('.seg').forEach((b) => { b.onclick = () => { rndScope = b.dataset.s; $('rRange').querySelectorAll('.seg').forEach((x) => x.classList.toggle('on', x === b)); }; });
      document.addEventListener('pointerdown', (e) => { if (!box.contains(e.target)) close(); }); }
  }

  // ---- 窓(操縦席から見える景色) ----
  const vc = $('view'), vg = vc.getContext('2d');
  let W = 300, H = 260;
  function fit() { const d = Math.min(window.devicePixelRatio || 1, 2); W = vc.clientWidth; H = vc.clientHeight; vc.width = W * d; vc.height = H * d; vg.setTransform(d, 0, 0, d, 0, 0); }
  window.addEventListener('resize', fit);
  const stars = Array.from({ length: 150 }, () => ({ x: Math.random() * 2 - 1, y: Math.random() * 2 - 1, z: Math.random() * 0.95 + 0.05 }));
  const wf = (w, x) => { const f = x - Math.floor(x); return w === 'sine' ? Math.sin(2 * Math.PI * f) : w === 'triangle' ? (f < 0.5 ? 4 * f - 1 : 3 - 4 * f) : w === 'sawtooth' ? 2 * f - 1 : (f < 0.5 ? 1 : -1); };
  let onsetT = -99, lastVc = 0, envV = 0;                           // 音を鳴らした時刻と、エンベロープの見かけの値(窓の光り方に使う)
  let phase = 0, phase2 = 0, spd = 0.4, lvl = 0, pitchN = 0.3, last = performance.now() / 1000;
  const tbuf = new Uint8Array(2048), fbuf = new Uint8Array(1024);

  function planet(cx, cy, R, wave, cyc, ph, hue, haze, rim, alpha) {
    const N = 44;
    vg.save(); vg.globalAlpha = alpha;
    vg.beginPath(); vg.arc(cx, cy, R, 0, 7); vg.clip();
    vg.translate(cx, cy); vg.rotate(-0.35);
    for (let i = 0; i < N; i++) {                                 // 縞模様 = 波のかたちそのもの
      const y0 = -R + i * 2 * R / N, tt = (y0 + R / N) / R, v = wf(wave, tt * 0.5 * cyc + ph);
      vg.fillStyle = 'hsl(' + (hue + v * 14) + ',' + (45 + (1 - haze) * 30) + '%,' + (50 + v * 18) + '%)';
      vg.fillRect(-R - 2, y0, 2 * R + 4, 2 * R / N + 1);
    }
    vg.rotate(0.35); vg.translate(-cx, -cy);
    const sh = vg.createRadialGradient(cx - R * 0.4, cy - R * 0.4, R * 0.2, cx, cy, R);
    sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,.78)'); vg.fillStyle = sh; vg.fillRect(cx - R, cy - R, 2 * R, 2 * R);
    vg.fillStyle = 'rgba(10,16,40,' + (haze * 0.55) + ')'; vg.fillRect(cx - R, cy - R, 2 * R, 2 * R);
    vg.restore();
    vg.save(); vg.globalAlpha = alpha; vg.strokeStyle = 'hsla(' + (hue + 160) + ',100%,70%,' + rim + ')'; vg.shadowColor = 'hsl(' + (hue + 160) + ',100%,70%)'; vg.shadowBlur = 18 * rim;
    vg.lineWidth = 1.5; vg.beginPath(); vg.arc(cx, cy, R, 0, 7); vg.stroke(); vg.restore();
  }

  function frame() {
    const now = performance.now() / 1000, dt = Math.min(0.05, now - last); last = now;
    const e = E();
    if (analyser) {
      analyser.getByteTimeDomainData(tbuf); let s = 0; for (let i = 0; i < 1024; i++) { const x = (tbuf[i] - 128) / 128; s += x * x; }
      lvl += (Math.min(1, Math.sqrt(s / 1024) * 3.2) - lvl) * 0.25;
    } else lvl *= 0.9;
    let pm = 0, pc = 0; for (const [id, v] of voices) { if (typeof id === 'number') { pm += v.midi; pc++; } }
    pitchN += ((pc ? Math.max(0, Math.min(1, (pm / pc - 30) / 60)) : 0.25) - pitchN) * 0.1;
    // エンベロープ(ATK・DEC・SUS・REL)の見かけの値。鳴らした瞬間から、立ち上がり→減る→押している間→余韻
    if (voices.size > lastVc) onsetT = now; lastVc = voices.size;
    if (voices.size) { const t = now - onsetT, at = Math.max(0.001, e.attack); envV = t < at ? t / at : e.sustain + (1 - e.sustain) * Math.exp(-(t - at) / Math.max(0.02, e.decay)); }
    else envV *= Math.exp(-dt / Math.max(0.03, e.release * 0.5));
    const warpOn = ACT === 'warp', thrOn = ACT === 'thrust';
    const goal = 0.35 + lvl * 1.2 + (warpOn ? 2.6 : 0) + (thrOn ? 1.2 : 0) + (ACT === 'laser' ? 0.3 : 0);
    spd += (goal - spd) * 0.06;

    // カットオフ: 画面全体の色味(低い=暗い赤橙、高い=明るい青緑)
    const open = e.fEnv > 0.05 ? e.fEnv * 0.07 * Math.exp(-(now - onsetT) / Math.max(0.02, e.fDecay)) : 0;     // F-ENV・F-DEC: 鳴らした瞬間、もやが晴れて閉じていく
    const cn = Math.max(0, Math.min(1, Math.log(e.cutoff / 80) / Math.log(12000 / 80) + open)), hue = 20 + cn * 170, haze = 1 - cn, rim = Math.min(1, e.q / 25) * 0.9 + 0.08;
    vg.save();
    if (thrOn) vg.translate((Math.random() - 0.5) * 3.2, (Math.random() - 0.5) * 3.2);
    vg.fillStyle = 'hsl(' + hue + ',55%,' + (2 + cn * 3) + '%)'; vg.fillRect(-4, -4, W + 8, H + 8);
    const cx = W / 2, cy = H / 2;
    // 星(中心から手前へ流れる)
    for (const s of stars) {
      const pz = s.z + spd * dt * 0.3 * (1.5 + spd * 2) * Math.max(0.25, Math.min(3, 1 + e.sweep * 0.55));   // PITCH SWP: 星の筋の長さ
      s.z -= spd * dt * 0.3;
      const k = H * 0.35, x = cx + s.x / s.z * k, y = cy + s.y / s.z * k;
      if (s.z < 0.03 || x < -20 || x > W + 20 || y < -20 || y > H + 20) { s.x = Math.random() * 2 - 1; s.y = Math.random() * 2 - 1; s.z = 1; continue; }
      const x0 = cx + s.x / pz * k, y0 = cy + s.y / pz * k, a = Math.min(1, (1 - s.z) * 1.3 + 0.1);
      vg.strokeStyle = warpOn ? 'rgba(130,240,255,' + a + ')' : 'hsla(' + hue + ',70%,86%,' + a + ')'; vg.lineWidth = 0.6 + (1 - s.z) * 1.2;
      vg.beginPath(); vg.moveTo(x0, y0); vg.lineTo(x, y); vg.stroke();
    }
    if (e.noise > 0.02) {                                           // NOISE: 画面にざらつき
      vg.fillStyle = 'rgba(210,230,255,' + (0.15 + e.noise * 0.45) + ')';
      for (let i = 0, n = Math.round(e.noise * 260); i < n; i++) vg.fillRect(Math.random() * W, Math.random() * H, 1.2, 1.2);
    }
    // 惑星・衛星
    phase += dt * (0.05 + pitchN * 0.5 + lvl * 0.2); phase2 += dt * (0.05 + pitchN * 0.35);
    const R = H * 0.2 * (1 + 0.06 * Math.sin(now * 0.3)) + lvl * H * 0.025;
    let px = W * 0.68, py = H * 0.42;
    if (warpOn) { px += Math.sin(now * 38) * (e.fmDepth / 400) * 1.6; py += Math.cos(now * 31) * (e.fmDepth / 400) * 1.2; }
    const dOff = e.detune * 0.4;                                    // DETUNE: ずれた惑星と、元の位置の影
    if (e.osc2 > 0.01) {                                            // OSC2 MIX: 2つ目の惑星が、量に合わせてフェードインする
      if (dOff > 1) planet(W * 0.24, H * 0.3, R * 0.42, e.wave2, 2.5, phase2, hue + 70, haze, rim * 0.3, e.osc2 * 0.3);
      planet(W * 0.24 + dOff, H * 0.3, R * 0.42, e.wave2, 2.5, phase2, hue + 70, haze, rim * 0.6, e.osc2 * 0.95);
    }
    const moons = e.mix < 0.03 ? [] : Array.from({ length: 1 + Math.floor(e.feedback * 4) }, (_, i) => {
      const a = now * (0.7 - i * 0.1) + i * 2.1, rx = R * (1.35 + e.delayTime * 0.9 * (i + 1) * 0.6), ry = rx * 0.28;
      return { x: px + Math.cos(a) * rx, y: py + Math.sin(a) * ry - Math.cos(a) * rx * 0.12, back: Math.sin(a) < 0, r: R * 0.09 * (1 - i * 0.1), al: (0.3 + e.mix * 0.7) * (1 - i / 7) };
    });
    const dm = (m) => { vg.fillStyle = 'rgba(210,225,245,' + m.al + ')'; vg.beginPath(); vg.arc(m.x, m.y, m.r, 0, 7); vg.fill(); };
    moons.filter((m) => m.back).forEach(dm);
    const cyc = 1.6 + e.fmRatio * 0.45;                              // FM RATIO: 縞の細かさ
    if (envV > 0.02) {                                              // ATK・DEC・SUS・REL: 惑星のまわりの光(エンベロープの形)
      const gl = vg.createRadialGradient(px, py, R * 0.8, px, py, R * (1.12 + envV * 0.6));
      gl.addColorStop(0, 'hsla(' + (hue + 160) + ',100%,65%,' + (envV * 0.32) + ')'); gl.addColorStop(1, 'hsla(' + (hue + 160) + ',100%,65%,0)');
      vg.fillStyle = gl; vg.fillRect(px - R * 2.2, py - R * 2.2, R * 4.4, R * 4.4);
    }
    if (dOff > 1) planet(px, py, R, e.wave, cyc, phase, hue, haze, rim * 0.4, 0.3);   // 元の位置の影
    planet(px + dOff, py, R, e.wave, cyc, phase, hue, haze, rim, 1);
    if (e.sub > 0.02) {                                             // SUB: 惑星の下側に重い影
      vg.save(); vg.beginPath(); vg.arc(px, py, R, 0, 7); vg.clip();
      const sg2 = vg.createLinearGradient(0, py - R * 0.1, 0, py + R); sg2.addColorStop(0, 'rgba(0,0,12,0)'); sg2.addColorStop(1, 'rgba(0,0,12,' + (e.sub * 0.85) + ')');
      vg.fillStyle = sg2; vg.fillRect(px - R, py - R, 2 * R, 2 * R); vg.restore();
    }
    if (e.wobble > 0.02) {                                          // WOBBLE: 縁がうねる
      const wr = e.wobbleRate || 5; vg.strokeStyle = 'hsla(' + (hue + 160) + ',100%,75%,.8)'; vg.lineWidth = 1.2; vg.beginPath();
      for (let i = 0; i <= 90; i++) { const a = i / 90 * 6.2832, r = R * (1.03 + Math.sin(a * 6 + now * wr * 2) * 0.05 * e.wobble * 2); const x = px + Math.cos(a) * r, y = py + Math.sin(a) * r; i ? vg.lineTo(x, y) : vg.moveTo(x, y); }
      vg.stroke();
    }
    moons.filter((m) => !m.back).forEach(dm);

    vg.fillStyle = 'hsla(' + hue + ',75%,50%,' + (0.1 + (1 - cn) * 0.1) + ')'; vg.fillRect(-4, -4, W + 8, H + 8);   // CUTOFF: 画面全体の色かぶり
    // ミッション音の演出
    if (warpOn) {
      for (let j = 0; j < 4; j++) { const pr = (now * 0.8 + j / 4) % 1; vg.strokeStyle = 'rgba(39,232,255,' + (1 - pr) * 0.4 + ')'; vg.lineWidth = 2; vg.beginPath(); vg.arc(cx, cy, pr * W * 0.7, 0, 7); vg.stroke(); }
    }
    for (let i = events.length - 1; i >= 0; i--) {
      const ev = events[i], a = now - ev.t;
      if (a > 2.4) { events.splice(i, 1); continue; }
      if (ev.type === 'laser' && a < 0.35) {
        const pr = a / 0.18, sx = ev.t % 2 > 1 ? W * 0.12 : W * 0.88, tx = px + Math.sin(ev.t * 9) * R * 0.5, ty = py + Math.cos(ev.t * 7) * R * 0.5;
        const h = Math.min(1, pr), tl = Math.max(0, pr - 0.35);
        vg.strokeStyle = '#ff2d8a'; vg.shadowColor = '#ff2d8a'; vg.shadowBlur = 14; vg.lineWidth = 3;
        vg.beginPath(); vg.moveTo(sx + (tx - sx) * tl, H + (ty - H) * tl); vg.lineTo(sx + (tx - sx) * h, H + (ty - H) * h); vg.stroke(); vg.shadowBlur = 0;
        if (pr >= 1) { vg.fillStyle = 'rgba(255,200,230,' + (1 - (pr - 1) / 0.9) + ')'; vg.beginPath(); vg.arc(tx, ty, 6 + (pr - 1) * 40, 0, 7); vg.fill(); }
      }
      if (ev.type === 'arp') {                                          // RATE: 速いほど輪が短く消える。ARP SPAN: 輪の数(オクターブ数)
        const dur = Math.min(0.6, 1.6 / e.arpRate);
        if (a < dur) for (let k = 0; k < Math.round(e.arpSpan); k++) { vg.strokeStyle = 'rgba(45,255,155,' + (1 - a / dur) * 0.7 * (1 - k * 0.25) + ')'; vg.lineWidth = 2; vg.beginPath(); vg.arc(px, py, R * (1.02 + k * 0.16 + (a / dur) * 0.35), 0, 7); vg.stroke(); }
      }
      if (ev.type === 'sonar') { for (let j = 0; j < 1 + Math.floor(e.feedback * 3); j++) { const aa = a - j * e.delayTime; if (aa < 0 || aa > 1.8) continue; vg.strokeStyle = 'rgba(155,208,255,' + (1 - aa / 1.8) * 0.6 + ')'; vg.lineWidth = 1.5; vg.beginPath(); vg.arc(px, py, aa * W * 0.45, 0, 7); vg.stroke(); } }
    }
    if (thrOn) { const g = vg.createLinearGradient(0, H, 0, H * 0.55); g.addColorStop(0, 'rgba(255,150,30,' + (0.35 + lvl * 0.4) + ')'); g.addColorStop(1, 'rgba(255,150,30,0)'); vg.fillStyle = g; vg.fillRect(0, H * 0.55, W, H * 0.45); }
    if (ACT === 'alert') { vg.fillStyle = 'rgba(255,40,40,' + (Math.sin(now * 10) > 0 ? 0.28 : 0.06) + ')'; vg.fillRect(0, 0, W, H); vg.strokeStyle = '#ff2d2d'; vg.lineWidth = 4; vg.strokeRect(2, 2, W - 4, H - 4); }
    if (ACT === 'comms') {
      vg.fillStyle = 'rgba(45,255,155,.07)'; vg.fillRect(0, 0, W, H); const sy = (now * 80) % H; vg.fillStyle = 'rgba(45,255,155,.25)'; vg.fillRect(0, sy, W, 2);
      if (Math.sin(now * 6) > -0.3) { vg.font = '700 11px Orbitron,monospace'; vg.fillStyle = '#2dff9b'; vg.textAlign = 'center'; vg.fillText('INCOMING TRANSMISSION', cx, H * 0.14); vg.textAlign = 'left'; }
    }
    // HUD
    vg.font = '500 9px Orbitron,monospace'; vg.fillStyle = '#27e8ff';   // 青=機械の状態表示。緑=自分で操作しているもの
    vg.fillText('FWD CAM 01   SPD ' + (0.1 + (spd / 4) * 0.89).toFixed(2) + 'c   HDG 214.7', 8, 14);
    if (ACT && Math.floor(now * 2) % 2 === 0) { vg.textAlign = 'right'; vg.fillStyle = '#2dff9b'; vg.fillText(PRE[ACT].code + '  ON', W - 8, 14); vg.textAlign = 'left'; }   // ON の間は点滅
    if (autoMode !== 'off') { vg.textAlign = 'right'; vg.fillStyle = '#2dff9b'; vg.fillText('AUTO ' + autoMode.toUpperCase(), W - 8, ACT ? 26 : 14); vg.textAlign = 'left'; }
    vg.strokeStyle = 'rgba(39,232,255,.22)'; vg.lineWidth = 1; vg.beginPath(); vg.moveTo(cx - 16, cy); vg.lineTo(cx - 5, cy); vg.moveTo(cx + 5, cy); vg.lineTo(cx + 16, cy); vg.moveTo(cx, cy - 16); vg.lineTo(cx, cy - 5); vg.moveTo(cx, cy + 5); vg.lineTo(cx, cy + 16); vg.stroke();
    vg.restore();

    // 小さな計器(波形・スペクトル・ランプ・バー)
    drawScope(); drawSpec();
    $('lPw').classList.toggle('on', !!ctx && ctx.state === 'running'); $('lVo').classList.toggle('on', voices.size > 0);
    $('lEc').classList.toggle('on', e.mix > 0.05); $('lOv').classList.toggle('on', lvl > 0.8); $('lAc').classList.toggle('on', !!ACT);
    $('tT').textContent = Math.round(300 + lvl * 180 + (thrOn ? 60 : 0)) + 'K';
    requestAnimationFrame(frame);
  }
  const sc = $('scope'), sg = sc.getContext('2d'), sp = $('spec'), spg = sp.getContext('2d');
  function size(c) { const d = Math.min(window.devicePixelRatio || 1, 2), w = c.clientWidth * d, h = c.clientHeight * d; if (c.width !== w || c.height !== h) { c.width = w; c.height = h; } return d; }
  function drawScope() {
    const d = size(sc); sg.clearRect(0, 0, sc.width, sc.height);
    sg.strokeStyle = '#27e8ff'; sg.lineWidth = 1.4 * d; sg.beginPath();
    let start = 0; const n = 512;
    if (analyser) for (let i = 1; i < n; i++) if (tbuf[i - 1] < 128 && tbuf[i] >= 128) { start = i; break; }
    for (let i = 0; i < n; i++) { const v = analyser ? tbuf[start + i] : 128, x = i / (n - 1) * sc.width, y = (1 - v / 255) * sc.height; i ? sg.lineTo(x, y) : sg.moveTo(x, y); }
    sg.stroke();
  }
  function drawSpec() {
    const d = size(sp); spg.clearRect(0, 0, sp.width, sp.height);
    if (analyser) analyser.getByteFrequencyData(fbuf);
    const B = 56, bw = sp.width / B;
    for (let i = 0; i < B; i++) {
      const v = analyser ? fbuf[Math.floor(Math.pow(i / B, 2) * 360) + 1] / 255 : 0;
      spg.fillStyle = i % 7 === 0 ? '#ff2d8a' : '#27e8ff'; spg.fillRect(i * bw + d, sp.height * (1 - v), bw - 2 * d, sp.height * v);
    }
  }

  initSeq(); buildKeys(); buildKnobs(); fit(); requestAnimationFrame(frame);
  window.__ss = { p, E, setAuto, press, release, get autoMode() { return autoMode; }, arpHeld, arpNotes, get ACT() { return ACT; }, get LOCKED() { return LOCKED; }, voices, events, activate, stopPreset, get seqSrc() { return seqSrc; }, userGrid, PGRID, PAT, setSelf, SCF };
})();
