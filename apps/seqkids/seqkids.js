// おとならべ — 円形のこども向けシーケンサー(ドラム3つ+メロディ)。Web Audio。
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const STEPS = 16;
  const PITCHES = [0, 2, 4, 7, 9, 12];                         // ド レ ミ ソ ラ ド(高い)  (ペンタトニック)
  const SOL = ['ド', 'レ', 'ミ', 'ソ', 'ラ', 'ド'];
  const PCOL = ['#ff6b6b', '#ff9f43', '#ffc93c', '#6bd68c', '#5b8def', '#9b6bff'];
  const BASE = 60;                                            // 真ん中のド
  const BCOL = ['#c94c4c', '#cc7a2e', '#b8921a', '#3fa866', '#3a6fc9', '#7a47d1'];   // ベースの色(メロディより こい)
  const FXN = ['ぴこ', 'ぼよん', 'きらきら', 'ぶー'], FXMARK = ['ぴ', 'ぼ', 'き', 'ぶ'], FXCOL = ['#ff5fa2', '#35c4a0', '#f5b700', '#7b61ff'];
  // リングは、外側から: メロディ, ベース, こうかおん, ハイハット, スネア, キック(kind: pitch=高さを えらぶ / fx=こうかおんを えらぶ / drum=ON・OFF)
  const RINGS = [
    { id: 'mel', name: 'メロディ', kind: 'pitch', pal: PCOL, n: 6 },
    { id: 'bass', name: 'ベース', kind: 'pitch', pal: BCOL, n: 6 },
    { id: 'fx', name: 'こうかおん', kind: 'fx', pal: FXCOL, n: 4, marks: FXMARK },
    { id: 'hat', name: '✨ ハイハット(チッ・チー)', kind: 'multi', pal: ['#5bb6ff', '#1f6fd1'], n: 2, marks: ['チ', 'ー'] },
    { id: 'snare', name: '👏 パン', kind: 'drum', color: '#ff6bb5' },
    { id: 'kick', name: '🦶 ドン', kind: 'drum', color: '#ff7a3d' },
  ];
  const kindOf = (id) => RINGS.find((r) => r.id === id).kind;
  const isOn = (id, v) => (kindOf(id) === 'drum' ? !!v : v >= 0);
  const S = { cells: { mel: Array(STEPS).fill(-1), bass: Array(STEPS).fill(-1), fx: Array(STEPS).fill(-1), hat: Array(STEPS).fill(-1), snare: Array(STEPS).fill(0), kick: Array(STEPS).fill(0) }, bpm: 100, playing: false, char: 'furarin' };
  // はじめから、少しだけ並べておく(おとが出ると、しくみが分かる)
  [0, 4, 8, 12].forEach((i) => S.cells.kick[i] = 1);
  [4, 12].forEach((i) => S.cells.snare[i] = 1);
  [0, 2, 4, 6, 8, 10, 12].forEach((i) => S.cells.hat[i] = 0); S.cells.hat[14] = 1;   // 14マス目は、あいたハイハット
  [[0, 0], [6, 0], [8, 3], [14, 2]].forEach(([i, d]) => S.cells.bass[i] = d); S.cells.fx[7] = 0;
  S.cells.mel[0] = 0; S.cells.mel[3] = 2; S.cells.mel[6] = 3; S.cells.mel[10] = 2; S.cells.mel[12] = 4;

  // ---- キャラクター(おとあそびシンセと同じ) ----
  function star(cx, cy, r1, r2, n, fill) {
    let d = '';
    for (let i = 0; i < n * 2; i++) { const a = Math.PI * i / n - Math.PI / 2, r = i % 2 ? r2 : r1; d += (i ? 'L' : 'M') + (cx + r * Math.cos(a)).toFixed(1) + ' ' + (cy + r * Math.sin(a)).toFixed(1); }
    return '<path d="' + d + 'Z" fill="' + fill + '" stroke="' + fill + '" stroke-width="4" stroke-linejoin="round"/>';
  }
  const WAVEPATH = { sine: 'M0 8 C6 -4 14 -4 20 8 S34 20 40 8', sawtooth: 'M0 14 L18 2 L18 14 L40 2', square: 'M0 14 V2 H13 V14 H27 V2 H40', triangle: 'M0 14 L10 2 L30 14 L40 2' };
  const CHARS = [
    { id: 'furarin', wave: 'sine', name: 'ふわりん', body: '<ellipse cx="50" cy="56" rx="40" ry="35" fill="#ff8fb1"/>', ey: 50, my: 66, wy: 72, ex: 17, gain: 0.34 },
    { id: 'gizako', wave: 'sawtooth', name: 'ギザっこ', body: star(50, 54, 44, 34, 11, '#ffc93c'), ey: 52, my: 68, wy: 74, ex: 16, gain: 0.16 },
    { id: 'kakuzo', wave: 'square', name: 'カクゾー', body: '<rect x="12" y="18" width="76" height="74" rx="8" fill="#5bb6ff"/>', ey: 48, my: 64, wy: 72, ex: 18, gain: 0.15 },
    { id: 'pyonta', wave: 'triangle', name: 'ピョンタ', body: '<path d="M50 12 L90 88 L10 88 Z" fill="#6bd68c" stroke="#6bd68c" stroke-width="8" stroke-linejoin="round"/>', ey: 58, my: 74, wy: 80, ex: 12, gain: 0.34 },
  ];
  const byId = (id) => CHARS.find((c) => c.id === id) || CHARS[0];
  const charSvg = (c) => '<svg viewBox="0 0 100 100" aria-hidden="true">' + c.body +
    '<circle cx="' + (50 - c.ex) + '" cy="' + c.ey + '" r="6.5" fill="#fff"/><circle cx="' + (50 + c.ex) + '" cy="' + c.ey + '" r="6.5" fill="#fff"/>' +
    '<circle cx="' + (50 - c.ex) + '" cy="' + (c.ey + 1) + '" r="3" fill="#2b2150"/><circle cx="' + (50 + c.ex) + '" cy="' + (c.ey + 1) + '" r="3" fill="#2b2150"/>' +
    '<ellipse class="mouth" cx="50" cy="' + c.my + '" rx="6" ry="2.6" fill="#7a2b3b"/>' +
    '<g transform="translate(30 ' + c.wy + ')"><path d="' + WAVEPATH[c.wave] + '" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" transform="scale(1 0.9)"/></g></svg>';

  // ---- 音 ----
  let ctx = null, master = null, noiseBuf = null, dSend = null, dNode = null;
  S.dly = false;
  function ensureAudio() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    const comp = ctx.createDynamicsCompressor(); master = ctx.createGain(); master.gain.value = 0.8;
    master.connect(comp); comp.connect(ctx.destination);
    dSend = ctx.createGain(); dSend.gain.value = S.dly ? 0.55 : 0;                       // やまびこ(BPMに あわせた ディレイ): メロディだけ
    dNode = ctx.createDelay(2); const fb = ctx.createGain(), lp = ctx.createBiquadFilter(); fb.gain.value = 0.38; lp.type = 'lowpass'; lp.frequency.value = 2600;
    dSend.connect(dNode); dNode.connect(lp); lp.connect(fb); fb.connect(dNode); lp.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  function noise(t, dur, type, freq, vol) {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; const f = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = type; f.frequency.value = freq; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + dur + 0.02); return g;
  }
  S.kit = { kick: 0, snare: 0, hat: 0 };
  const KITN = { kick: ['1', '2', '3', '4'], snare: ['A', 'B', 'C', 'D'], hat: ['あ', 'い', 'う'] };
  function tone(t, type, f0, f1, dur, vol, rate) {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + (rate || dur * 0.45));
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.03); return g;
  }
  function kick(t) {
    const k = S.kit.kick;
    if (k === 1) { tone(t, 'sine', 125, 40, 0.75, 1.0, 0.25); }                               // ずしん(808風: ひくくて ながい)
    else if (k === 2) { tone(t, 'triangle', 230, 52, 0.2, 1.0, 0.05); noise(t, 0.012, 'highpass', 3000, 0.5); }   // ばちっ(はっきりした ハード)
    else if (k === 3) { tone(t, 'sine', 105, 62, 0.16, 0.85, 0.05); }                            // ぽこ(かるい)
    else { tone(t, 'sine', 160, 42, 0.32, 1.0, 0.14); }                                           // ふつう
  }
  function snare(t) {
    const k = S.kit.snare;
    if (k === 1) { [0, 0.011, 0.022].forEach((d) => noise(t + d, 0.025, 'bandpass', 1500, 0.5)); noise(t + 0.03, 0.14, 'bandpass', 1400, 0.45); }   // クラップ
    else if (k === 2) { tone(t, 'triangle', 1700, 1200, 0.03, 0.5, 0.02); noise(t, 0.03, 'bandpass', 3200, 0.35); }      // カッ(リムショット)
    else if (k === 3) { tone(t, 'sine', 210, 105, 0.22, 0.8, 0.12); noise(t, 0.03, 'bandpass', 900, 0.15); }              // タム
    else { noise(t, 0.16, 'bandpass', 1800, 0.55); tone(t, 'triangle', 220, 140, 0.1, 0.45, 0.08); }                      // スネア
  }
  function metal(t, dur, vol) {                                // 金属っぽい ハイハット(四角い波を いくつか かさねて)
    const g = ctx.createGain(), f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000;
    [205, 296, 369, 421, 553].forEach((fr) => { const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = fr * 1.7; o.connect(f); o.start(t); o.stop(t + dur + 0.02); });
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); f.connect(g); g.connect(master); return g;
  }
  let openG = null;                                           // 鳴っている「あいたハイハット」(とじたハイハットで止まる)
  function hat(t, open) {
    const k = S.kit.hat;
    if (open) { openG = k === 1 ? metal(t, 0.28, 0.09) : k === 2 ? noise(t, 0.36, 'bandpass', 5000, 0.3) : noise(t, 0.3, 'highpass', 6500, 0.3); return; }
    if (openG) { try { openG.gain.cancelScheduledValues(t); openG.gain.setValueAtTime(openG.gain.value, t); openG.gain.linearRampToValueAtTime(0.0001, t + 0.012); } catch (e) {} openG = null; }
    if (k === 1) metal(t, 0.045, 0.09); else if (k === 2) noise(t, 0.09, 'bandpass', 5000, 0.3); else noise(t, 0.045, 'highpass', 7500, 0.28);
  }
  function melody(t, deg) {
    const c = byId(S.char), o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter(), dur = Math.max(0.16, stepDur() * 2.2);
    o.type = c.wave; o.frequency.value = 440 * Math.pow(2, (BASE + PITCHES[deg] - 69) / 12);
    f.type = 'lowpass'; f.frequency.value = 3800; f.Q.value = 0.8;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(c.gain, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(f); f.connect(g); g.connect(master); g.connect(dSend); dNode.delayTime.setValueAtTime(stepDur() * 3, t); o.start(t); o.stop(t + dur + 0.02);   // 3マス = 付点8ぶおんぷ
  }
  function bass(t, deg) {
    const dur = Math.max(0.2, stepDur() * 2.6), f = 440 * Math.pow(2, (36 + PITCHES[deg] - 69) / 12);
    const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), fl = ctx.createBiquadFilter();
    o.type = 'sawtooth'; o2.type = 'sine'; o.frequency.value = f; o2.frequency.value = f;
    fl.type = 'lowpass'; fl.frequency.setValueAtTime(900, t); fl.frequency.exponentialRampToValueAtTime(260, t + dur); fl.Q.value = 2;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.4, t + 0.008); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(fl); o2.connect(g); fl.connect(g); g.connect(master); o.start(t); o2.start(t); o.stop(t + dur + 0.02); o2.stop(t + dur + 0.02);
  }
  function blip(t, type, f0, f1, dur, vol, mid) {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t);
    if (mid) { o.frequency.exponentialRampToValueAtTime(mid, t + dur * 0.4); }
    o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02); return o;
  }
  function fxSound(t, k) {
    if (k === 0) blip(t, 'sine', 900, 1900, 0.11, 0.32);                                  // ぴこ
    else if (k === 1) blip(t, 'sine', 180, 160, 0.34, 0.4, 520);                          // ぼよん
    else if (k === 2) [1568, 2093, 2637].forEach((f, i) => blip(t + i * 0.055, 'sine', f, f, 0.14, 0.16));   // きらきら
    else { const o = blip(t, 'square', 110, 105, 0.3, 0.22); }                           // ぶー
  }
  const stepDur = () => 60 / S.bpm / 4;
  function playCell(id, v, t) { if (id === 'kick' && v) kick(t); else if (id === 'snare' && v) snare(t); else if (id === 'hat' && v >= 0) hat(t, v === 1); else if (id === 'mel' && v >= 0) melody(t, v); else if (id === 'bass' && v >= 0) bass(t, v); else if (id === 'fx' && v >= 0) fxSound(t, v); }

  // ---- 時計(先読みスケジューラ) ----
  const RANGES = { all: [0, STEPS], front: [0, STEPS / 2], back: [STEPS / 2, STEPS] };
  // パート(楽器のグループ)ごとの、くりかえす はんい と ミュート
  const GROUP = { mel: 0, bass: 1, fx: 2, hat: 3, snare: 3, kick: 3 };
  S.range = ['all', 'all', 'all', 'all']; S.mute = [false, false, false, false];
  const stepOf = (g, n) => { const [lo, hi] = RANGES[S.range[g]]; return lo + n % (hi - lo); };      // 時計の n 番目に、パートgが 鳴らす マス
  let nextT = 0, tick = 0, timer = null; const queue = [];      // queue: {t, tick}
  function schedule() {
    while (nextT < ctx.currentTime + 0.12) {
      RINGS.forEach((r) => { const g = GROUP[r.id]; if (!S.mute[g]) playCell(r.id, S.cells[r.id][stepOf(g, tick)], nextT); });
      queue.push({ t: nextT, tick });
      nextT += stepDur(); tick++;
    }
  }
  function start() { ensureAudio(); S.playing = true; tick = 0; nextT = ctx.currentTime + 0.06; queue.length = 0; schedule(); timer = setInterval(schedule, 25); $('playBtn').textContent = '⏹ とめる'; $('playBtn').classList.add('on'); }
  function stop() { S.playing = false; clearInterval(timer); queue.length = 0; $('playBtn').textContent = '▶ はじめる'; $('playBtn').classList.remove('on'); curTick = -1; S.rec = false; if (typeof syncRec === 'function') syncRec(); }
  $('playBtn').onclick = () => (S.playing ? stop() : start());
  document.addEventListener('visibilitychange', () => { if (document.hidden && S.playing) stop(); });

  // ---- 円のばん ----
  const cv = $('ring'), g2 = cv.getContext('2d');
  let W = 0, curTick = -1, flash = {};           // flash[id+step] = 光った時刻
  const geo = () => { const R = W / 2 - 3, r0 = W * 0.15, th = (R - r0) / RINGS.length; return { R, r0, th }; };
  function resize() { const dpr = window.devicePixelRatio || 1; W = cv.clientWidth; cv.width = W * dpr; cv.height = W * dpr; g2.setTransform(dpr, 0, 0, dpr, 0, 0); }
  window.addEventListener('resize', resize);
  const stepAng = (i) => -Math.PI / 2 + 2 * Math.PI * i / STEPS;
  function draw(now) {
    if (!W) resize();
    const c = W / 2, { R, r0, th } = geo(), gap = 0.03;
    g2.clearRect(0, 0, W, W);
    // 今の時刻に合わせた「いまの マス」(音が鳴る時刻と、画面の時刻を合わせる)
    let pos = -1;
    if (S.playing && ctx) {
      while (queue.length > 1 && queue[1].t <= ctx.currentTime) queue.shift();
      if (queue.length && queue[0].t <= ctx.currentTime) {
        const q = queue[0]; pos = q.tick % STEPS + (ctx.currentTime - q.t) / stepDur();
        if (q.tick !== curTick) {
          curTick = q.tick;
          RINGS.forEach((r) => { const g = GROUP[r.id], st = stepOf(g, curTick); if (!S.mute[g] && isOn(r.id, S.cells[r.id][st])) flash[r.id + st] = now; });
          dance(curTick);
          if (!S.mute[0] && S.cells.mel[stepOf(0, curTick)] >= 0) { const ce = $('center'); ce.classList.add('hit'); const m = ce.querySelector('.mouth'); if (m) m.style.transform = 'scaleY(3)'; clearTimeout(ce._t); ce._t = setTimeout(() => { ce.classList.remove('hit'); if (m) m.style.transform = ''; }, Math.max(120, stepDur() * 1500)); }
        }
      }
    }
    RINGS.forEach((r, ri) => {
      const ro = R - ri * th, ri2 = ro - th + 4;
      for (let i = 0; i < STEPS; i++) {
        const a0 = stepAng(i) + gap, a1 = stepAng(i + 1) - gap, v = S.cells[r.id][i], on = isOn(r.id, v);
        const fl = flash[r.id + i] ? Math.max(0, 1 - (now - flash[r.id + i]) / 260) : 0;
        g2.beginPath(); g2.arc(c, c, ro, a0, a1); g2.arc(c, c, ri2, a1, a0, true); g2.closePath();
        g2.fillStyle = on ? (r.kind === 'drum' ? r.color : r.pal[v]) : (i % 4 === 0 ? '#f1e2b8' : '#fff');
        g2.fill();
        g2.lineWidth = 2; g2.strokeStyle = on ? 'rgba(0,0,0,.12)' : '#e8d49a'; g2.stroke();
        if (fl > 0) { g2.fillStyle = 'rgba(255,255,255,' + (0.75 * fl).toFixed(2) + ')'; g2.fill(); }
        if (r.kind !== 'drum' && on) { const am = (a0 + a1) / 2, rm = (ro + ri2) / 2; g2.fillStyle = '#fff'; g2.font = 'bold ' + Math.round(th * 0.5) + 'px sans-serif'; g2.textAlign = 'center'; g2.textBaseline = 'middle'; g2.fillText(r.marks ? r.marks[v] : SOL[v], c + rm * Math.cos(am), c + rm * Math.sin(am) + 1); }
      }
      const g = GROUP[r.id];                                  // くりかえさない はんぶん・ミュートを、うすく
      const dim = (x0, x1) => { g2.beginPath(); g2.arc(c, c, ro + 1, stepAng(x0), stepAng(x1)); g2.arc(c, c, ri2 - 1, stepAng(x1), stepAng(x0), true); g2.closePath(); g2.fillStyle = 'rgba(255,247,224,.72)'; g2.fill(); };
      if (S.mute[g]) dim(0, STEPS); else if (S.range[g] === 'front') dim(STEPS / 2, STEPS); else if (S.range[g] === 'back') dim(0, STEPS / 2);
    });
    if (pos >= 0) {                        // 針(いまの ばしょ)
      const a = stepAng(pos); g2.strokeStyle = '#3a2a12'; g2.lineWidth = 4; g2.lineCap = 'round'; g2.beginPath(); g2.moveTo(c + r0 * Math.cos(a), c + r0 * Math.sin(a)); g2.lineTo(c + (R + 1) * Math.cos(a), c + (R + 1) * Math.sin(a)); g2.stroke();
      g2.fillStyle = '#ff7a3d'; g2.beginPath(); g2.arc(c + (R - 2) * Math.cos(a), c + (R - 2) * Math.sin(a), 6, 0, 7); g2.fill();
    }
    drawGrid(now);
    blocksTick();
    requestAnimationFrame(draw);
  }

  // ---- しかくい ばん(グリッド): ゆびで おしやすいように、楽器ごとの タブ + 8マスずつ 2だんに わけて、大きく ----
  const gc = $('grid'), gg = gc.getContext('2d');
  const ROWH = 38, LBL = 56, HDR = 22, GAP = 6, HALF = STEPS / 2;
  const GROWS = [];                                         // メロディ(6)、ベース(6)、こうかおん(4)、ドラム(4)
  const GTITLE = ['メロディ', 'ベース', 'こうかおん', 'ドラム'], GTAB = ['🎹 メロディ', '🎸 ベース', '✨ こうかおん', '🥁 ドラム'];
  for (let d = PITCHES.length - 1; d >= 0; d--) GROWS.push({ id: 'mel', val: d, group: 0, label: SOL[d] + (d === 5 ? '↑' : ''), color: PCOL[d] });
  for (let d = PITCHES.length - 1; d >= 0; d--) GROWS.push({ id: 'bass', val: d, group: 1, label: SOL[d] + (d === 5 ? '↑' : ''), color: BCOL[d] });
  FXN.forEach((n, k) => GROWS.push({ id: 'fx', val: k, group: 2, label: n, color: FXCOL[k], small: n.length > 2 }));
  GROWS.push({ id: 'hat', val: 0, group: 3, label: '✨', color: '#5bb6ff' }, { id: 'hat', val: 1, group: 3, label: '💫', color: '#1f6fd1' });
  [['snare', '👏', '#ff6bb5'], ['kick', '🦶', '#ff7a3d']].forEach(([id, label, color]) => GROWS.push({ id, val: 1, group: 3, label, color }));
  let gGroup = 0;
  const vrows = () => GROWS.filter((r) => r.group === gGroup);
  const blockH = () => HDR + vrows().length * ROWH;
  const gH = () => 2 * blockH() + GAP + 4;
  let GW = 0;
  function gResize() { const dpr = window.devicePixelRatio || 1; GW = gc.clientWidth; gc.style.height = gH() + 'px'; gc.width = GW * dpr; gc.height = gH() * dpr; gg.setTransform(dpr, 0, 0, dpr, 0, 0); }
  window.addEventListener('resize', gResize);
  const blockY = (half) => half * (blockH() + GAP);
  function drawGrid(now) {
    if (!GW) gResize();
    const cw = (GW - LBL) / HALF, vr = vrows();
    gg.clearRect(0, 0, GW, gH());
    for (let half = 0; half < 2; half++) {
      const y0 = blockY(half);
      gg.fillStyle = '#7a4b00'; gg.font = 'bold 13px sans-serif'; gg.textAlign = 'left'; gg.textBaseline = 'alphabetic';
      gg.fillText(half ? '▼ うしろ はんぶん (9〜16)' : '▼ まえ はんぶん (1〜8)', 4, y0 + HDR - 6);
      vr.forEach((r, ri) => {
        const y = y0 + HDR + ri * ROWH;
        gg.fillStyle = r.color; gg.beginPath(); gg.roundRect ? gg.roundRect(2, y + 3, LBL - 8, ROWH - 6, 9) : gg.rect(2, y + 3, LBL - 8, ROWH - 6); gg.fill();
        gg.fillStyle = '#fff'; gg.font = 'bold ' + (r.small ? 12 : 16) + 'px sans-serif'; gg.textAlign = 'center'; gg.textBaseline = 'middle'; gg.fillText(r.label, 2 + (LBL - 8) / 2, y + ROWH / 2 + 1);
        for (let c = 0; c < HALF; c++) {
          const i = half * HALF + c, v = S.cells[r.id][i], on = kindOf(r.id) === 'drum' ? !!v : v === r.val, x = LBL + c * cw;
          const fl = flash[r.id + i] && on ? Math.max(0, 1 - (now - flash[r.id + i]) / 260) : 0;
          gg.fillStyle = on ? r.color : (Math.floor(i / 4) % 2 ? '#f6ecd0' : '#fff');
          gg.strokeStyle = on ? 'rgba(0,0,0,.15)' : '#e8d49a'; gg.lineWidth = 1.5;
          gg.beginPath(); gg.roundRect ? gg.roundRect(x + 2, y + 2.5, cw - 4, ROWH - 5, 8) : gg.rect(x + 2, y + 2.5, cw - 4, ROWH - 5); gg.fill(); gg.stroke();
          if (fl > 0) { gg.fillStyle = 'rgba(255,255,255,' + (0.75 * fl).toFixed(2) + ')'; gg.fill(); }
        }
      });
    }
    gg.fillStyle = 'rgba(255,247,224,.72)';
    if (S.mute[gGroup]) { gg.fillRect(0, 0, GW, gH()); gg.fillStyle = '#7a4b00'; gg.font = 'bold 16px sans-serif'; gg.textAlign = 'center'; gg.textBaseline = 'middle'; gg.fillText('🔇 おやすみ ちゅう', GW / 2, gH() / 2); }
    else if (S.range[gGroup] !== 'all') { const hf = S.range[gGroup] === 'front' ? 1 : 0; gg.fillRect(0, blockY(hf) + HDR - 2, GW, vr.length * ROWH + 4); }
    if (S.playing && curTick >= 0 && !S.mute[gGroup]) {                       // いまの 列
      const cs = stepOf(gGroup, curTick), half = Math.floor(cs / HALF), c = cs % HALF;
      gg.strokeStyle = '#3a2a12'; gg.lineWidth = 3; gg.beginPath(); gg.rect(LBL + c * cw + 1, blockY(half) + HDR - 1, cw - 2, vr.length * ROWH + 2); gg.stroke();
    }
  }
  function gHit(ev) {
    const b = gc.getBoundingClientRect(), x = (ev.clientX - b.left) * GW / b.width, y = (ev.clientY - b.top) * GW / b.width;
    const cw = (GW - LBL) / HALF; if (x < LBL) return null;
    const c = Math.min(HALF - 1, Math.floor((x - LBL) / cw)), vr = vrows();
    for (let half = 0; half < 2; half++) {
      const y0 = blockY(half) + HDR;
      if (y >= y0 && y < y0 + vr.length * ROWH) return { row: vr[Math.floor((y - y0) / ROWH)], step: half * HALF + c };
    }
    return null;
  }
  // タブ(楽器えらび)
  function buildMutes() {
    $('mutes').innerHTML = GTAB.map((t, i) => '<button type="button" class="mbtn' + (S.mute[i] ? ' off' : '') + '" data-g="' + i + '" aria-pressed="' + S.mute[i] + '">' + (S.mute[i] ? '🤫 しー' : '🔊 なる') + '</button>').join('');
    $('mutes').querySelectorAll('.mbtn').forEach((el) => el.onclick = () => { S.mute[+el.dataset.g] = !S.mute[+el.dataset.g]; buildMutes(); });
  }
  function buildTabs() {
    buildMutes();
    $('gtabs').innerHTML = GTAB.map((t, i) => '<button type="button" class="gtab' + (i === gGroup ? ' sel' : '') + '" data-g="' + i + '">' + t.replace(' ', '<br>') + (S.range[i] === 'front' ? ' ↻前' : S.range[i] === 'back' ? ' ↻後' : '') + '</button>').join('');
    $('gtabs').querySelectorAll('.gtab').forEach((el) => el.onclick = () => { const g = +el.dataset.g;
      gGroup = g; gPaint = null; gResize(); syncPart(); });
  }
  let gPaint = null;
  function gTap(h, first) {
    const r = h.row, arr = S.cells[r.id];
    if (kindOf(r.id) !== 'drum') {                                       // メロディ・ベース・こうかおん: 1マスに1つ
      if (first) gPaint = { id: r.id, erase: arr[h.step] === r.val };
      if (!gPaint || gPaint.id !== r.id) return;
      if (gPaint.erase) { if (arr[h.step] === r.val) arr[h.step] = -1; }
      else if (arr[h.step] !== r.val) { arr[h.step] = r.val; ensureAudio(); playCell(r.id, r.val, ctx.currentTime + 0.01); }
    } else {
      if (first) gPaint = { id: r.id, value: arr[h.step] ? 0 : 1 };
      if (!gPaint || gPaint.id !== r.id || arr[h.step] === gPaint.value) return;
      arr[h.step] = gPaint.value; if (gPaint.value) { ensureAudio(); playCell(r.id, 1, ctx.currentTime + 0.01); }
    }
  }
  gc.addEventListener('pointerdown', (e) => { e.preventDefault(); gc.setPointerCapture(e.pointerId); const h = gHit(e); if (h) gTap(h, true); });
  gc.addEventListener('pointermove', (e) => { if (!gPaint) return; const h = gHit(e); if (h) gTap(h, false); });
  ['pointerup', 'pointercancel'].forEach((ev) => gc.addEventListener(ev, () => { gPaint = null; }));

  // ---- タッチ(まるい ばん) ----
  let paint = null;                          // ドラッグでぬる: {id, value}
  function hit(ev) {
    const b = cv.getBoundingClientRect(), x = ev.clientX - b.left - b.width / 2, y = ev.clientY - b.top - b.height / 2, sc = W / b.width;
    const rad = Math.hypot(x, y) * sc, { R, r0, th } = geo();
    if (rad < r0 || rad > R) return null;
    const ri = Math.min(RINGS.length - 1, Math.floor((R - rad) / th));
    let a = Math.atan2(y, x) + Math.PI / 2; if (a < 0) a += 2 * Math.PI;
    return { ring: RINGS[ri], step: Math.floor(a / (2 * Math.PI) * STEPS) % STEPS };
  }
  function tapAt(h, first) {
    const id = h.ring.id, arr = S.cells[id];
    if (h.ring.kind !== 'drum') {
      if (!first) return;
      const max = h.ring.n - 1;
      arr[h.step] = arr[h.step] >= max ? -1 : arr[h.step] + 1;
      if (arr[h.step] >= 0) { ensureAudio(); playCell(id, arr[h.step], ctx.currentTime + 0.01); }
    } else {
      if (first) paint = { id, value: arr[h.step] ? 0 : 1 };
      if (!paint || paint.id !== id) return;
      if (arr[h.step] === paint.value) return;
      arr[h.step] = paint.value;
      if (paint.value) { ensureAudio(); playCell(id, 1, ctx.currentTime + 0.01); }
    }
  }
  cv.addEventListener('pointerdown', (e) => { e.preventDefault(); cv.setPointerCapture(e.pointerId); const h = hit(e); if (h) tapAt(h, true); });
  cv.addEventListener('pointermove', (e) => { if (!paint) return; const h = hit(e); if (h) tapAt(h, false); });
  ['pointerup', 'pointercancel'].forEach((ev) => cv.addEventListener(ev, () => { paint = null; }));

  // ---- そのほかの ボタン ----
  $('tempo').oninput = () => { S.bpm = +$('tempo').value; $('tempoOut').textContent = S.bpm; };
  // タップテンポ: タッチの間隔(=1拍)の平均から、はやさを決める。2秒あいたら、数えなおし
  let taps = [];
  $('tapBtn').addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const now = performance.now(); if (taps.length && now - taps[taps.length - 1] > 2000) taps = [];
    taps.push(now); taps = taps.slice(-6);
    const b = $('tapBtn'); b.classList.add('pulse'); setTimeout(() => b.classList.remove('pulse'), 90);
    if (taps.length < 2) return;
    const iv = (taps[taps.length - 1] - taps[0]) / (taps.length - 1);
    let bpm = Math.round(60000 / iv);
    if (bpm < 60) { bpm = Math.min(180, bpm * 2); } else if (bpm > 180) { bpm = Math.max(60, Math.round(bpm / 2)); }
    S.bpm = Math.max(60, Math.min(180, bpm)); $('tempo').value = S.bpm; $('tempoOut').textContent = S.bpm;
  });
  let undoSnap = null;
  const snap = () => { undoSnap = JSON.stringify(S.cells); $('undoBtn').disabled = false; };
  $('undoBtn').disabled = true;
  $('undoBtn').onclick = () => { if (!undoSnap) return; const cur = JSON.stringify(S.cells); S.cells = JSON.parse(undoSnap); undoSnap = cur; };   // もういちど おすと、やりなおし
  // パートごとの くりかえし・コピー・けす・ミュート(いま えらんでいる タブの パート)
  const syncPart = () => {
    if (typeof renderBlocks === 'function') renderBlocks(true);
    $('rotBtns').innerHTML = GTAB.map((t, i) => '<button type="button" class="rot' + (S.range[i] !== 'all' ? ' on' : '') + '" data-g="' + i + '">' + t.replace(' ', '<br>') + '<br><small>' + { all: 'ぜんぶ', front: 'まえだけ ↻', back: 'うしろだけ ↻' }[S.range[i]] + '</small></button>').join('');
    $('rotBtns').querySelectorAll('.rot').forEach((el) => el.onclick = () => { const g = +el.dataset.g; S.range[g] = { all: 'front', front: 'back', back: 'all' }[S.range[g]]; syncPart(); });      // おすたびに: ぜんぶ → まえだけ → うしろだけ → ぜんぶ
    buildTabs();
  };
  const partIds = () => RINGS.filter((r) => GROUP[r.id] === gGroup).map((r) => r.id);
  // ---- ブロックで つくる(メロディ・ベース): 1小節 = 4つの スロット(4マスずつ)。スロットを タッチするたび、ブロックが かわる ----
  const PRESETS = [['おやすみ', [-1, -1, -1, -1]], ['のぼる', [0, 1, 2, 3]], ['くだる', [3, 2, 1, 0]], ['やま', [0, 2, 4, 2]], ['ぴょん', [0, -1, 3, -1]], ['ドドソソ', [0, 0, 3, 3]], ['ミ・ミ・', [2, -1, 2, -1]]];
  const BL = 4, NSLOT = STEPS / BL;
  let blocksSig = '';
  const blockId = () => (gGroup === 0 ? 'mel' : gGroup === 1 ? 'bass' : null);
  const blockPal = () => (gGroup === 1 ? BCOL : PCOL);
  const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
  const mini = (vals) => { const pal = blockPal(); return '<svg viewBox="0 0 48 30" aria-hidden="true"><rect x="0" y="0" width="48" height="30" rx="5" fill="#fff"/>' + vals.map((v, i) => v >= 0 ? '<rect x="' + (i * 12 + 1) + '" y="' + ((5 - v) * 5 + 0.5) + '" width="10" height="4" rx="1.5" fill="' + pal[v] + '"/>' : '<circle cx="' + (i * 12 + 6) + '" cy="27" r="1.6" fill="#d9ccaa"/>').join('') + '</svg>'; };
  function previewBlock(vals) { const id = blockId(); if (!id) return; ensureAudio(); const t = ctx.currentTime + 0.05; vals.forEach((v, i) => { if (v >= 0) playCell(id, v, t + i * stepDur()); }); }
  const slotVals = (s) => { const id = blockId(); return id ? S.cells[id].slice(s * BL, s * BL + BL) : []; };
  const setSlot = (s, vals) => { const arr = S.cells[blockId()]; vals.forEach((v, i) => { arr[s * BL + i] = v; }); };
  function renderBlocks(force) {
    if (padsFor !== gGroup) renderPads();
    const id = blockId(), box = $('blocksBox'); box.hidden = !id; $('drumBox').hidden = gGroup !== 3; $('voiceBox').hidden = gGroup !== 0;
    if (!id) return;
    const sig = gGroup + '|' + S.cells[id].join();
    if (!force && sig === blocksSig) return; blocksSig = sig;
    $('slots').innerHTML = Array.from({ length: NSLOT }, (_, s) => {
      const v = slotVals(s), p = PRESETS.find((x) => same(x[1], v));
      return '<div class="slot" data-s="' + s + '"><button type="button" class="sv" data-a="next" data-s="' + s + '"><b>' + (s + 1) + '</b>' + mini(v) + '<span>' + (p ? p[0] : 'じぶんの') + '</span></button><div class="sb3"><button type="button" data-a="up" data-s="' + s + '" title="たかく">⬆</button><button type="button" data-a="down" data-s="' + s + '" title="ひくく">⬇</button><button type="button" data-a="rev" data-s="' + s + '" title="ぎゃくから">↔</button></div></div>';
    }).join('');
    $('slots').querySelectorAll('button').forEach((el) => el.onclick = () => {
      const s = +el.dataset.s, a = el.dataset.a, cur = slotVals(s); snap();
      let nv;
      if (a === 'next') { const i = PRESETS.findIndex((x) => same(x[1], cur)); nv = PRESETS[(i + 1) % PRESETS.length][1].slice(); }   // つぎの ブロックへ(さいごは おやすみ→のぼる…)
      else if (a === 'up') nv = cur.map((x) => (x < 0 ? x : Math.min(5, x + 1)));
      else if (a === 'down') nv = cur.map((x) => (x < 0 ? x : Math.max(0, x - 1)));
      else nv = cur.slice().reverse();
      setSlot(s, nv); previewBlock(nv); renderBlocks(true);
    });
  }
  $('blkRand').onclick = () => {                              // おまかせ: 4つの スロットを、ブロックと たかさで ランダムに
    if (!blockId()) return; snap();
    for (let s = 0; s < NSLOT; s++) { const rest = s > 0 && Math.random() < (gGroup === 1 ? 0.5 : 0.2); const cand = rest ? [PRESETS[0]] : PRESETS.slice(1).filter((p) => gGroup !== 1 || p[1].filter((x) => x >= 0).length <= 2); let v = cand[Math.floor(Math.random() * cand.length)][1].slice(); const sh = Math.floor(Math.random() * 3) - 1; v = v.map((x) => (x < 0 ? x : Math.max(0, Math.min(5, x + sh)))); setSlot(s, v); }
    renderBlocks(true); previewBlock(slotVals(0).concat(slotVals(1)));
  };
  // ---- ひいて ろくおん: けんばん(メロディ・ベース)/ マーク(こうかおん)/ パッド(ドラム)を タップ → 音が鳴って、ろくおん中なら いまの マスに はいる ----
  S.rec = false;
  const FXICON = ['⚡', '🌀', '✨', '📯'];
  let padsFor = -1;
  function tickNow() { if (!S.playing || !ctx) return -1; let q = null; for (const it of queue) if (it.t <= ctx.currentTime) q = it; return q ? q.tick + (ctx.currentTime - q.t) / stepDur() : -1; }
  function recordHit(id, val) {
    if (!S.rec || !S.playing) return;
    const tf = tickNow(); if (tf < 0) return;
    const step = stepOf(GROUP[id], Math.round(tf)), arr = S.cells[id];
    arr[step] = kindOf(id) === 'drum' ? 1 : val;                                  // いちばん ちかい マスに いれる
    flash[id + step] = performance.now();
  }
  function syncRec() { const b = $('recBtn'); b.classList.toggle('rec', S.rec); b.textContent = S.rec ? '⏹ ろくおん ちゅう' : '⏺ ろくおん'; $('padsBox').classList.toggle('recording', S.rec); $('recHint').textContent = S.rec ? '🔴 いま ならして いる マスに、タップした おとが はいるよ。まちがえたら「もどす」' : '「⏺ ろくおん」を おして、ひくと、まるい ばんに おとが のこるよ'; }
  function renderPads() {
    padsFor = gGroup; const box = $('pads'); let items;
    if (gGroup <= 1) { const pal = blockPal(), id = blockId(); items = PITCHES.map((_, d) => ({ id, val: d, label: SOL[d] + (d === 5 ? '↑' : ''), color: pal[d] })); $('padTitle').textContent = (gGroup === 0 ? '🎹 ' : '🎸 ') + 'けんばんを ひく'; box.className = 'tpads keys'; }
    else if (gGroup === 2) { items = FXN.map((n, k) => ({ id: 'fx', val: k, label: FXICON[k] + ' ' + n, color: FXCOL[k] })); $('padTitle').textContent = '✨ マークを タップ'; box.className = 'tpads fxpads'; }
    else { items = [{ id: 'hat', val: 0, label: '✨ チッ', color: '#5bb6ff' }, { id: 'hat', val: 1, label: '💫 チー', color: '#1f6fd1' }, { id: 'snare', val: 1, label: '👏 パン', color: '#ff6bb5' }, { id: 'kick', val: 1, label: '🦶 ドン', color: '#ff7a3d' }]; $('padTitle').textContent = '🥁 パッドを たたく'; box.className = 'tpads fxpads'; }
    box.innerHTML = items.map((it, i) => '<button type="button" class="tpad" data-i="' + i + '" style="background:' + it.color + '">' + it.label + '</button>').join('');
    box.querySelectorAll('.tpad').forEach((el) => el.addEventListener('pointerdown', (e) => {
      e.preventDefault(); const it = items[+el.dataset.i]; ensureAudio();
      playCell(it.id, it.val, ctx.currentTime + 0.005); recordHit(it.id, it.val);
      el.classList.add('hit'); setTimeout(() => el.classList.remove('hit'), 110);
    }));
  }
  $('recBtn').onclick = () => { S.rec = !S.rec; if (S.rec) { snap(); if (!S.playing) start(); } syncRec(); };
  syncRec();
  // ---- ドラムの おとの いろ(おとを えらぶ) ----
  function renderKits() {
    $('kits').innerHTML = [['kick', '🦶 ドン'], ['snare', '👏 パン'], ['hat', '✨ チッ']].map(([k, n]) => '<div class="kitrow"><span>' + n + '</span>' + KITN[k].map((nm, i) => '<button type="button" class="kit' + (S.kit[k] === i ? ' sel' : '') + '" data-k="' + k + '" data-i="' + i + '">' + nm + '</button>').join('') + '</div>').join('');
    $('kits').querySelectorAll('.kit').forEach((el) => el.onclick = () => { S.kit[el.dataset.k] = +el.dataset.i; ensureAudio(); const t = ctx.currentTime + 0.02; if (el.dataset.k === 'hat') { hat(t, false); hat(t + 0.25, true); } else playCell(el.dataset.k, 1, t); renderKits(); });
  }
  renderKits();
  // ---- ドラムの パターン(ボタンで えらぶ)。K=ドン S=パン H=チッ(x=とじた o=あいた) ----
  const DPAT = [                                          // [名前, ハイハット, スネア(クラップ), キック, はやさ(BPM), いろ, えもじ]
    ['ハウス', '..o...o...o...o.', '....x.......x...', 'x...x...x...x...', 122, '#ff7eb3', '🏠'],
    ['テクノ', 'xxoxxxoxxxoxxxox', '............x...', 'x...x...x...x...', 132, '#7b61ff', '🤖'],
    ['ミニマル', 'x.x.x.x.x.x.x.x.', '................', 'x...x...x...x...', 126, '#8fa1b3', '⬜'],
    ['ブレイクビーツ', 'x.x.x.x.x.x.x.xo', '....x.......x..x', 'x.....x...x.....', 135, '#ffa51f', '🧩'],
    ['エレクトロ', 'x.x.x.x.x.x.x.x.', '....x.......x...', 'x.....x.x.......', 112, '#12b8b8', '⚡'],
    ['ダブステップ', 'x.x.x.x.x.x.x.x.', '........x.......', 'x.........x.....', 140, '#3b82f6', '🌊'],
    ['トラップ', 'x.x.xxx.x.x.xxxx', '........x.......', 'x.....x...x.....', 140, '#a855f7', '💎'],
    ['ドラムンベース', 'x.x.x.x.x.x.x.x.', '....x.......x...', 'x.........x.....', 170, '#22c55e', '🚀'],
    ['ガバ', '..o...o...o...o.', '....x.......x...', 'x...x...x...x.xx', 180, '#ef4444', '🔥'],
    ['ドンだけ', '................', '................', 'x...x...x...x...', 0, '#ff7a3d', '🥁'],
  ];
  // 見た目: まるい ばんの ミニ版(そとから ハイハット・スネア・キック)。まんなかに えもじ。はりは、そのジャンルの はやさで まわる
  const dring = (hh, ss, kk, bp, emoji) => {
    const dots = (s, r, rad, col) => [...s].map((ch, i) => { if (ch === '.') return ''; const a = (-90 + i * 22.5) * Math.PI / 180; return '<circle cx="' + (50 + rad * Math.cos(a)).toFixed(1) + '" cy="' + (50 + rad * Math.sin(a)).toFixed(1) + '" r="' + (ch === 'o' ? r + 1.4 : r) + '" fill="' + (ch === 'o' ? '#1f6fd1' : col) + '"/>'; }).join('');
    const ring = (rad) => '<circle cx="50" cy="50" r="' + rad + '" fill="none" stroke="#e8d9b0" stroke-width="0.8" stroke-dasharray="1 3.2"/>';
    return '<svg viewBox="0 0 100 100" aria-hidden="true">' + ring(41) + ring(32) + ring(23) + dots(hh, 2.9, 41, '#5bb6ff') + dots(ss, 3.5, 32, '#ff6bb5') + dots(kk, 4.1, 23, '#ff7a3d') +
      '<g class="needle" style="animation-duration:' + (240 / (bp || 100)).toFixed(2) + 's"><line x1="50" y1="50" x2="50" y2="7" stroke="#3a2a1255" stroke-width="2" stroke-linecap="round"/><circle cx="50" cy="8" r="3" fill="#3a2a12"/></g>' +
      '<g class="emo" style="animation-duration:' + (60 / (bp || 100)).toFixed(2) + 's"><text x="50" y="52" text-anchor="middle" dominant-baseline="central" font-size="34">' + emoji + '</text></g></svg>';
  };
  $('drumPats').innerHTML = DPAT.map(([n, hh, ss, kk, bp, col, em], i) => '<button type="button" class="dpat" data-i="' + i + '" style="--c:' + col + '">' + dring(hh, ss, kk, bp, em) + '<span>' + n + (bp ? '<small> ' + bp + '</small>' : '') + '</span></button>').join('');
  $('drumPats').querySelectorAll('.dpat').forEach((el) => el.onclick = () => {
    const [, hh, ss, kk, bp] = DPAT[+el.dataset.i]; snap();
    if (bp) { S.bpm = bp; $('tempo').value = bp; $('tempoOut').textContent = bp; }                 // そのジャンルに ちょうど いい はやさに する
    S.cells.hat = [...hh].map((ch) => (ch === 'x' ? 0 : ch === 'o' ? 1 : -1)); S.cells.snare = [...ss].map((ch) => (ch === 'x' ? 1 : 0)); S.cells.kick = [...kk].map((ch) => (ch === 'x' ? 1 : 0));
    document.querySelectorAll('.dpat').forEach((b) => b.classList.toggle('sel', b === el));
    if (!S.playing) { ensureAudio(); const t = ctx.currentTime + 0.05; for (let i = 0; i < 8; i++) RINGS.forEach((r) => { if (GROUP[r.id] === 3) playCell(r.id, S.cells[r.id][i], t + i * stepDur()); }); }   // とまっている ときは、はじめの 8マスを きかせる
  });
  function blocksTick() {
    renderBlocks(false);
    if (!blockId()) return;
    const now = S.playing && curTick >= 0 && !S.mute[gGroup] ? Math.floor(stepOf(gGroup, curTick) / BL) : -1;
    $('slots').querySelectorAll('.slot').forEach((el, s) => el.classList.toggle('now', s === now));
  }
  $('clearPart').onclick = () => { if (!confirm('このタブの おとを ぜんぶ けすよ。いい?\n(「もどす」で もどせるよ)')) return; snap(); partIds().forEach((id) => S.cells[id].fill(kindOf(id) === 'drum' ? 0 : -1)); };
  $('clearBtn').onclick = () => { if (!confirm('ぜんぶの タブの おとを けすよ。ほんとに いい?\n(「もどす」で もどせるよ)')) return; snap(); RINGS.forEach((r) => S.cells[r.id].fill(r.kind === 'drum' ? 0 : -1)); };
  $('randBtn').onclick = () => {
    snap();
    const pick = (p) => Math.random() < p ? 1 : 0;
    const bRoot = [0, 0, 2, 4][Math.floor(Math.random() * 4)], bAlt = [3, 3, 5, 0][Math.floor(Math.random() * 4)];
    for (let i = 0; i < STEPS; i++) {
      S.cells.kick[i] = i % 4 === 0 ? 1 : pick(0.12); S.cells.snare[i] = (i === 4 || i === 12) ? 1 : pick(0.1); S.cells.hat[i] = i % 2 === 0 ? (Math.random() < 0.12 ? 1 : 0) : (Math.random() < 0.3 ? (Math.random() < 0.3 ? 1 : 0) : -1);
      S.cells.mel[i] = Math.random() < 0.4 ? Math.floor(Math.random() * PITCHES.length) : -1;
      S.cells.bass[i] = i === 0 ? bRoot : i === 8 ? (Math.random() < 0.7 ? bRoot : bAlt) : (i === 6 || i === 14) ? (Math.random() < 0.35 ? bAlt : -1) : -1;   // ベースは すくなく ながく: 1ぱく めと 3ぱく めが中心
      S.cells.fx[i] = Math.random() < 0.08 ? Math.floor(Math.random() * FXN.length) : -1;
    }
  };
  // ---- テキストで ほぞん・よみこみ ----
  function toText() {
    const mel = S.cells.mel.map((v) => (v < 0 ? '.' : String(v))).join(''), dr = (id) => S.cells[id].map((v) => (v ? 'x' : '.')).join('');
    return ['おとならべ', 'はやさ: ' + S.bpm, 'こえ: ' + byId(S.char).name, 'メロ: ' + mel + '   (0=ド 1=レ 2=ミ 3=ソ 4=ラ 5=高いド)', 'ベース: ' + S.cells.bass.map((v) => (v < 0 ? '.' : String(v))).join(''), 'こうか: ' + S.cells.fx.map((v) => (v < 0 ? '.' : String(v))).join('') + '   (0=ぴこ 1=ぼよん 2=きらきら 3=ぶー)', 'チッ: ' + S.cells.hat.map((v) => (v < 0 ? '.' : v ? 'o' : 'x')).join('') + '   (x=とじた o=あいた)', 'パン: ' + dr('snare'), 'ドン: ' + dr('kick') + '\nやまびこ: ' + (S.dly ? 'あり' : 'なし') + '\nおとの いろ: ドン=' + S.kit.kick + ' パン=' + S.kit.snare + ' チッ=' + S.kit.hat].join('\n');
  }
  function fromText(txt) {
    const get = (key) => { const m = txt.match(new RegExp('^\\s*' + key + '\\s*[:：]\\s*(.*)$', 'm')); return m ? m[1] : null; };
    const pat = (key, ok) => { const v = get(key); if (v == null) return null; const s = v.replace(/\s.*$/, ''); return s.length === STEPS && [...s].every((ch) => ok.includes(ch)) ? s : false; };
    const bs = pat('ベース', '.012345'), fxp = pat('こうか', '.0123'), mel = pat('メロ', '.012345'), hat = pat('チッ', 'xo.'), sn = pat('パン', 'x.'), ki = pat('ドン', 'x.');
    if ([mel, bs, fxp, hat, sn, ki].some((v) => v === false)) return '16文字ぴったりの ならびに なっていないところが あるよ';
    if ([mel, bs, fxp, hat, sn, ki].every((v) => v === null)) return 'よみこめる もじが みつからなかったよ';
    if (bs) S.cells.bass = [...bs].map((ch) => (ch === '.' ? -1 : +ch));
    if (fxp) S.cells.fx = [...fxp].map((ch) => (ch === '.' ? -1 : +ch));
    if (mel) S.cells.mel = [...mel].map((ch) => (ch === '.' ? -1 : +ch));
    if (hat) S.cells.hat = [...hat].map((ch) => (ch === 'x' ? 0 : ch === 'o' ? 1 : -1));
    if (sn) S.cells.snare = [...sn].map((ch) => (ch === 'x' ? 1 : 0));
    if (ki) S.cells.kick = [...ki].map((ch) => (ch === 'x' ? 1 : 0));
    { const dl = get('やまびこ'); S.dly = !!dl && dl.trim().startsWith('あり'); buildDly(); }
    { const kl = get('おとの いろ'); if (kl) { const m = (k) => { const r = kl.match(new RegExp(k + '=(\\d)')); return r && +r[1] < KITN[{ 'ドン': 'kick', 'パン': 'snare', 'チッ': 'hat' }[k]].length ? +r[1] : null; }; [['ドン', 'kick'], ['パン', 'snare'], ['チッ', 'hat']].forEach(([n, k]) => { const v = m(n); if (v != null) S.kit[k] = v; }); renderKits(); } }
    const bpm = get('はやさ'); if (bpm && +bpm >= 60 && +bpm <= 180) { S.bpm = +bpm; $('tempo').value = S.bpm; $('tempoOut').textContent = S.bpm; }
    const vo = get('こえ'); const c = vo && CHARS.find((x) => vo.trim().startsWith(x.name)); if (c) { S.char = c.id; buildChars(); }
    return null;
  }
  $('saveBtn').onclick = () => {
    const t = toText(); $('saveText').value = t;
    const done = () => { $('saveMsg').textContent = '✅ コピーしたよ!'; };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(done, () => { $('saveText').select(); $('saveMsg').textContent = '👆 もじを えらんだよ。コピーして ね'; });
    else { $('saveText').select(); $('saveMsg').textContent = '👆 もじを えらんだよ。コピーして ね'; }
  };
  $('loadBtn').onclick = () => { snap(); const err = fromText($('saveText').value); $('saveMsg').textContent = err ? '⚠️ ' + err : '✅ よみこんだよ!'; };
  const buildDly = () => { const b = $('dlyBtn'); b.textContent = S.dly ? '🔁 やまびこ: あり' : '🔁 やまびこ: なし'; b.classList.toggle('on', S.dly); if (dSend) dSend.gain.setTargetAtTime(S.dly ? 0.55 : 0, ctx.currentTime, 0.02); };
  let dDir = 1;                                                // おどるキャラ: ドンで ジャンプ、パンで かたむく、チッで ちいさく ゆれる、メロディで おくちが あく
  function dance(tk) {
    const el = $('dancer'), svg = el.firstElementChild; if (!svg || !svg.animate) return;
    const on = (id) => { const g = GROUP[id]; return !S.mute[g] && isOn(id, S.cells[id][stepOf(g, tk)]); };
    const d = Math.max(140, stepDur() * 1800);
    if (on('kick')) svg.animate([{ transform: 'translateY(0) scale(1.12,.86)' }, { transform: 'translateY(-9px) scale(.94,1.08)', offset: .4 }, { transform: 'translateY(0) scale(1)' }], { duration: d, easing: 'ease-out' });
    else if (on('snare')) { dDir = -dDir; svg.animate([{ transform: 'rotate(' + 16 * dDir + 'deg)' }, { transform: 'rotate(0)' }], { duration: d, easing: 'ease-out' }); }
    else if (on('hat')) svg.animate([{ transform: 'translateX(' + 3 * dDir + 'px) rotate(' + 5 * dDir + 'deg)' }, { transform: 'none' }], { duration: d * .8, easing: 'ease-out' });
    const m = svg.querySelector('.mouth');
    if (m && !S.mute[0] && S.cells.mel[stepOf(0, tk)] >= 0) { m.style.transform = 'scaleY(3)'; clearTimeout(el._t); el._t = setTimeout(() => { m.style.transform = ''; }, Math.max(120, stepDur() * 1500)); }
  }
  $('dlyBtn').onclick = () => { S.dly = !S.dly; ensureAudio(); buildDly(); if (S.dly) melody(ctx.currentTime + 0.01, 2); };
  function buildChars() {
    $('chars').innerHTML = CHARS.map((c) => '<button type="button" class="char' + (c.id === S.char ? ' sel' : '') + '" data-id="' + c.id + '">' + charSvg(c) + '<div>' + c.name + '</div></button>').join('');
    $('center').innerHTML = charSvg(byId(S.char)); $('dancer').innerHTML = charSvg(byId(S.char));
    $('chars').querySelectorAll('.char').forEach((el) => el.onclick = () => { S.char = el.dataset.id; buildChars(); ensureAudio(); melody(ctx.currentTime + 0.01, 0); });
  }
  $('legend').innerHTML = RINGS.map((r, i) => '<span><i style="background:' + (r.kind === 'drum' ? r.color : 'linear-gradient(90deg,' + r.pal.slice(0, 5).join(',') + ')') + '"></i>' + r.name + (i === 0 ? '(いちばん そと)' : '') + '</span>').join('');
  syncPart(); buildChars(); requestAnimationFrame(draw);
})();
