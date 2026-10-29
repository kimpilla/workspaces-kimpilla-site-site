// シャッフルと裏拍: ベースとドラムのハネを別々に動かす / 当てっこ / 裏拍をたたく練習
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const store = { get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* なくても動く */ } } };
  let ctx = null, master = null, noiseBuf = null;
  function ensureAudio() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      const comp = ctx.createDynamicsCompressor(); master = ctx.createGain(); master.gain.value = 0.8; master.connect(comp); comp.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
  }
  // ---- 音色 ----
  const env = (g, t, a, peak, dur) => { g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0005, t + dur); };
  function osc(type, f0, f1, t, dur, peak, dest) { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.8); env(g, t, 0.002, peak, dur); o.connect(g); g.connect(dest || master); o.start(t); o.stop(t + dur + 0.03); }
  function noise(t, dur, type, freq, peak) { const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = noiseBuf; f.type = type; f.frequency.value = freq; env(g, t, 0.001, peak, dur); s.connect(f); f.connect(g); g.connect(master); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.03); }
  const kick = (t) => { osc('sine', 150, 45, t, 0.2, 1.0); };
  const snare = (t) => { noise(t, 0.14, 'highpass', 1800, 0.55); osc('triangle', 200, 140, t, 0.09, 0.4); };
  const hat = (t, acc) => noise(t, 0.045, 'highpass', 7500, acc ? 0.32 : 0.2);
  function bassNote(t, semi, dur) {
    const f = 55 * Math.pow(2, semi / 12), o = ctx.createOscillator(), o2 = ctx.createOscillator(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = 'sawtooth'; o2.type = 'sine'; o.frequency.value = f; o2.frequency.value = f; fl.type = 'lowpass'; fl.frequency.value = 700; fl.Q.value = 1.2;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.5, t + 0.006); g.gain.setValueAtTime(0.5, t + Math.max(0.01, dur - 0.04)); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(fl); o2.connect(g); fl.connect(g); g.connect(master); o.start(t); o2.start(t); o.stop(t + dur + 0.03); o2.stop(t + dur + 0.03);
  }
  const click = (t, acc) => osc('triangle', acc ? 2000 : 1400, 0, t, 0.06, acc ? 0.9 : 0.6);
  const tickSoft = (t) => osc('triangle', 3000, 0, t, 0.04, 0.25);
  const BASSL = [0, 4, 0, 7, 0, 9, 0, 10];                      // ブギー: 表=ルート / ウラ=3度・5度・6度・♭7度

  // ====================== ハネを聴く / 当てっこ ======================
  const P = { bpm: 100, rB: 0.5, rD: 0.5, mB: false, mD: false, link: false, playing: false };
  const vis = [];                                               // {t, lane, off}
  let nextBeat = 0, beatN = 0, timer = null;
  const beatDur = () => 60 / P.bpm;
  function schedBeat(t, n) {
    const b = n % 4, bd = beatDur();
    const tOffD = t + P.rD * bd, tOffB = t + P.rB * bd;
    if (!P.mD) {
      hat(t, b === 0); hat(tOffD, false);
      if (b === 0 || b === 2) kick(t); else snare(t);
      if (b === 2) kick(tOffD);                                  // 3のウラのキック(ハネが分かりやすい)
    }
    if (!P.mB) {
      bassNote(t, BASSL[b * 2], Math.max(0.05, (P.rB * bd) * 0.92));
      bassNote(tOffB, BASSL[b * 2 + 1], Math.max(0.05, ((1 - P.rB) * bd) * 0.92));
    }
    vis.push({ t, lane: 'D', off: false }, { t: tOffD, lane: 'D', off: true }, { t, lane: 'B', off: false }, { t: tOffB, lane: 'B', off: true });
  }
  function pump() {
    while (nextBeat < ctx.currentTime + 0.2) { schedBeat(nextBeat, beatN); nextBeat += beatDur(); beatN++; }
  }
  function startPlay() {
    ensureAudio(); if (P.playing) return;
    P.playing = true; nextBeat = ctx.currentTime + 0.15; beatN = 0; pump(); timer = setInterval(pump, 25); rafVis();
    $('playBtn').textContent = '■ とめる'; $('playBtn').classList.add('on');
  }
  function stopPlay() {
    if (!P.playing) return; P.playing = false; clearInterval(timer); vis.length = 0;
    $('playBtn').textContent = '▶ なる'; $('playBtn').classList.remove('on');
  }
  function rafVis() {
    if (!P.playing) return;
    const now = ctx.currentTime;
    while (vis.length && vis[0].t <= now) { const e = vis.shift(); const el = (e.lane === 'D' ? laneD : laneB).querySelector(e.off ? '.dot.off' : '.dot:not(.off)'); if (el && now - e.t < 0.1) { el.classList.add('fl'); setTimeout(() => el.classList.remove('fl'), 90); } }
    requestAnimationFrame(rafVis);
  }
  const laneD = $('laneD'), laneB = $('laneB');
  function drawLane(el, r, hidden) {
    const lbl = (x, s) => '<span class="lbl" style="left:' + x + '%' + (x <= 0 ? ';transform:none' : x >= 100 ? ';transform:translateX(-100%)' : '') + '">' + s + '</span>';
    el.innerHTML = [0, 25, 50, 75, 100].map((x) => '<span class="tick" style="left:' + x + '%;opacity:' + (x % 50 ? .4 : 1) + '"></span>').join('') +
      '<span class="dot" style="left:0%;margin-left:9px"></span>' + (hidden ? '' : '<span class="dot off" style="left:' + (r * 100) + '%"></span>' + lbl(r * 100, Math.round(r * 1000) / 10 + '%')) + lbl(0, '表') + lbl(100, '次の表');
    if (hidden) el.insertAdjacentHTML('beforeend', '<span class="lbl" style="left:50%">?</span>');
  }
  const ms = (r) => Math.round(r * beatDur() * 1000);
  function refreshPlay() {
    $('bpmOut').textContent = P.bpm; $('swBo').textContent = (Math.round(P.rB * 1000) / 10) + '%'; $('swDo').textContent = (Math.round(P.rD * 1000) / 10) + '%';
    $('swB').value = P.rB * 100; $('swD').value = P.rD * 100;
    const hid = gState.on && gState.view === 'secret' && !gState.answered;
    drawLane(laneD, P.rD, hid && gState.part === 'D'); drawLane(laneB, P.rB, hid && gState.part === 'B');
    const diff = (P.rB - P.rD) * beatDur() * 1000, e = ms(P.rD), f = ms(P.rB);
    $('gapBox').innerHTML = hid ? 'ウラの位置は、まだ ひみつ。耳で あててみて。' :
      'ドラムのウラは 表から <b>' + e + ' ms</b> あと、ベースのウラは <b>' + f + ' ms</b> あと。<br>' +
      (Math.abs(diff) < 3 ? 'ふたつの ウラは <b>そろっている</b>。' : 'ベースのウラは ドラムより <b>' + Math.abs(Math.round(diff)) + ' ms ' + (diff > 0 ? 'おそい(もたる)' : 'はやい(つんのめる)') + '</b>。');
    $('linkBtn').textContent = '🔗 ふたつを同じにする: ' + (P.link ? 'あり' : 'なし'); $('linkBtn').classList.toggle('on', P.link);
    $('muteB').textContent = 'ベース: ' + (P.mB ? 'けす' : 'なる'); $('muteD').textContent = 'ドラム: ' + (P.mD ? 'けす' : 'なる'); $('muteB').classList.toggle('on', P.mB); $('muteD').classList.toggle('on', P.mD);
  }
  $('bpm').oninput = (e) => { P.bpm = +e.target.value; refreshPlay(); };
  $('swB').oninput = (e) => { P.rB = e.target.value / 100; if (P.link) P.rD = P.rB; refreshPlay(); };
  $('swD').oninput = (e) => { P.rD = e.target.value / 100; if (P.link) P.rB = P.rD; refreshPlay(); };
  $('linkBtn').onclick = () => { P.link = !P.link; if (P.link) P.rD = P.rB; refreshPlay(); };
  $('muteB').onclick = () => { P.mB = !P.mB; refreshPlay(); };
  $('muteD').onclick = () => { P.mD = !P.mD; refreshPlay(); };
  $('playBtn').onclick = () => (P.playing ? stopPlay() : startPlay());
  const PRESETS = [['ストレート', 50, 50], ['3連シャッフル', 66.7, 66.7], ['ベースだけハネる', 66.7, 50], ['ドラムだけハネる', 50, 66.7], ['ベースがもたる', 70, 62], ['ベースが走る', 58, 66.7]];
  $('chipsPlay').innerHTML = PRESETS.map(([n], i) => '<button type="button" data-i="' + i + '">' + n + '</button>').join('');
  $('chipsPlay').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; const [, rb, rd] = PRESETS[+b.dataset.i]; P.link = false; P.rB = rb / 100; P.rD = rd / 100; refreshPlay(); };

  // ---- 当てっこ ----
  const gState = { on: false, part: 'B', secret: 0.6, view: 'secret', answered: false, hist: store.get('swinglab.guess', []) };
  const rnd = () => Math.round((0.5 + Math.random() * 0.25) * 200) / 200;     // 50〜75%、0.5%刻み
  $('gPart').innerHTML = '<button type="button" data-p="B">ベースを当てる</button><button type="button" data-p="D">ドラムを当てる</button>';
  const gRender = () => {
    [...$('gPart').children].forEach((b) => b.classList.toggle('on', b.dataset.p === gState.part));
    $('gSwo').textContent = (Math.round(+$('gSw').value * 10) / 10) + '%';
    const h = gState.hist.slice(0, 20); $('gStat').textContent = h.length ? 'さいきん ' + h.length + '問の 平均ズレ: ' + (h.reduce((a, b) => a + b, 0) / h.length).toFixed(1) + ' ポイント(1ポイント=1拍の1%)' : '';
    $('gRes').hidden = !gState.answered;
  };
  const gApply = () => {                                          // いまの設定を、演奏に反映
    const other = 0.5;                                            // 当てないほうは、ストレート
    const r = gState.view === 'secret' ? gState.secret : +$('gSw').value / 100;
    P.link = false; if (gState.part === 'B') { P.rB = r; P.rD = other; } else { P.rD = r; P.rB = other; }
    refreshPlay();
  };
  function gNew() { P.mB = false; P.mD = false; gState.secret = rnd(); gState.answered = false; gState.view = 'secret'; gApply(); gRender(); }
  $('gPart').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; gState.part = b.dataset.p; gNew(); };
  $('gSw').oninput = () => { gRender(); if (gState.view === 'guess') gApply(); };
  $('gA').onclick = () => { gState.view = 'secret'; gApply(); startPlay(); };
  $('gStop').onclick = stopPlay;
  $('gB').onclick = () => { gState.view = 'guess'; gApply(); startPlay(); };
  $('gAns').onclick = () => {
    const g = +$('gSw').value / 100, s = gState.secret, d = (g - s) * 100;
    if (!gState.answered) { gState.hist.unshift(Math.abs(d)); gState.hist = gState.hist.slice(0, 50); store.set('swinglab.guess', gState.hist); }
    gState.answered = true; gState.view = 'secret'; gApply();
    const lab = gState.part === 'B' ? 'ベース' : 'ドラム', abs = Math.abs(d);
    $('gRes').innerHTML = '<b>こたえ: ' + (Math.round(s * 1000) / 10) + '%</b> / あなたの予想: ' + (Math.round(g * 1000) / 10) + '%<br>ズレは ' + (d >= 0 ? '+' : '−') + abs.toFixed(1) + ' ポイント(' + Math.round(abs / 100 * beatDur() * 1000) + ' ms)。' + (abs < 2 ? 'ほぼ ぴったり!' : abs < 5 ? 'いい感じ。' : lab + 'のウラを ' + (d > 0 ? 'もたる方に' : 'はしる方に') + ' 予想しすぎた。');
    gRender();
  };
  $('gNext').onclick = gNew;

  // ====================== 裏拍をたたく ======================
  const SWT = [['ストレート', 0.5], ['ゆるい 58%', 0.58], ['3連 67%', 2 / 3], ['ハネ強め 75%', 0.75]];
  const MODES = [['ウラをたたく', 'ura'], ['2と4をたたく', 'back']];
  const LEADS = [['2小節', 2], ['4小節', 4], ['8小節', 8]], HUSHES = [['なし', 0], ['4小節', 4], ['8小節', 8], ['16小節', 16]];
  const T = { bpm: 100, mode: 'ura', sw: 0.5, lead: 4, hush: 4 };
  Object.assign(T, store.get('swinglab.tap', {}));
  // 目標位置(拍単位、小節内)。ura: 各拍のウラ / back: 2拍目と4拍目
  const targets = (mode, sw) => (mode === 'ura' ? [0 + sw, 1 + sw, 2 + sw, 3 + sw] : [1, 3]);
  const clickPos = (mode) => (mode === 'ura' ? [0, 1, 2, 3] : [0, 2]);
  function analyzeTap(taps, p) {
    const bd = 60000 / p.bpm, tg = targets(p.mode, p.sw), per = tg.length, slots = [];
    const nBars = p.lead + p.hush;
    for (let bar = 1; bar <= nBars; bar++) tg.forEach((x) => slots.push({ t: (bar * 4 + x) * bd, phase: bar <= p.lead ? 'lead' : 'hush' }));
    const gaps = []; const sorted = tg.slice(); for (let i = 0; i < sorted.length; i++) gaps.push(((sorted[(i + 1) % sorted.length] - sorted[i]) + 4) % 4 || 4); const half = Math.min(...gaps) * bd / 2;
    const used = new Map(); let extra = 0;
    for (const t of taps) {
      const rel = t - p.t0; let bi = -1, bd2 = Infinity;
      for (let i = 0; i < slots.length; i++) { const d = Math.abs(rel - slots[i].t); if (d < bd2) { bd2 = d; bi = i; } }
      if (bi < 0 || bd2 > half) continue;
      const dev = rel - slots[bi].t;
      if (!used.has(bi) || Math.abs(dev) < Math.abs(used.get(bi))) { if (used.has(bi)) extra++; used.set(bi, dev); } else extra++;
    }
    const rows = slots.map((s, i) => ({ i, phase: s.phase, t: s.t, dev: used.has(i) ? used.get(i) : null }));
    const med = (a) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
    const leadRows = rows.filter((r) => r.phase === 'lead'), nl = leadRows.length;
    const ld = leadRows.filter((r) => r.i >= nl / 2 && r.dev !== null).map((r) => r.dev);
    // 遅れの補正は「表を聴いてたたく」ura/back とも、クリックありの後半の中央値を使う(ura/back はクリックと目標が別の位置なので、はじめの小節のくせも含む)
    const lat = ld.length >= 4 ? med(ld) : 0;
    rows.forEach((r) => { if (r.dev !== null) r.dev -= lat; });
    const sc = p.hush > 0 ? rows.filter((r) => r.phase === 'hush') : leadRows.filter((r) => r.i >= nl / 2);
    const hit = sc.filter((r) => r.dev !== null);
    const out = { rows, lat, latOk: ld.length >= 4, slots: sc.length, hits: hit.length, missed: sc.length - hit.length, extra, scoredPhase: p.hush > 0 ? 'hush' : 'lead' };
    if (hit.length < 3) { out.tooFew = true; out.score = 0; out.rank = '-'; return out; }
    const devs = hit.map((r) => r.dev), mean = devs.reduce((a, b) => a + b, 0) / devs.length, rms = Math.sqrt(devs.reduce((a, b) => a + b * b, 0) / devs.length);
    const xs = hit.map((r) => r.t / 1000), mx = xs.reduce((a, b) => a + b, 0) / xs.length; let sxy = 0, sxx = 0; xs.forEach((x, i) => { sxy += (x - mx) * (devs[i] - mean); sxx += (x - mx) * (x - mx); });
    const b = sxx > 0 ? sxy / sxx : 0, jit = Math.sqrt(devs.reduce((a, d, i) => a + Math.pow(d - (mean + b * (xs[i] - mx)), 2), 0) / devs.length);
    out.mean = mean; out.rms = rms; out.jitter = jit; out.slope = b; out.mx = mx; out.driftBpm = p.bpm / (1 + b / 1000) - p.bpm; out.cover = hit.length / sc.length;
    out.ratio = p.mode === 'ura' ? p.sw + mean / bd : null;      // たたいたウラの位置(拍の何割)
    out.score = Math.round(100 * Math.exp(-rms / 50) * Math.pow(out.cover, 1.5)); out.rank = out.score >= 88 ? 'S' : out.score >= 78 ? 'A' : out.score >= 62 ? 'B' : out.score >= 45 ? 'C' : 'D';
    return out;
  }
  window.__analyzeTap = analyzeTap;

  let run = null; const pad = $('pad'), pMain = $('pMain'), pSub = $('pSub'), pbar = $('pbar'), beatsEl = $('beats');
  const nowMs = () => performance.now();
  function startTap() {
    ensureAudio(); const bd = 60 / T.bpm, tStart = ctx.currentTime + 0.6, perf0 = nowMs(), ctx0 = ctx.currentTime, t0 = perf0 + (tStart - ctx0) * 1000;
    const cp = clickPos(T.mode), tg = targets(T.mode, T.sw);
    for (let bar = 0; bar <= T.lead; bar++) {
      for (let b = 0; b < 4; b++) { const t = tStart + (bar * 4 + b) * bd;
        if (bar === 0) click(t, b === 0);                          // 1小節め: ぜんぶ鳴らす(お手本)
        else if (cp.includes(b)) click(t, b === 0); }
      if (bar === 0) tg.forEach((x) => { tickSoft(tStart + x * bd); });  // お手本: たたく位置に小さな音
    }
    const nBars = 1 + T.lead + T.hush; run = { p: { bpm: T.bpm, mode: T.mode, sw: T.sw, lead: T.lead, hush: T.hush, t0 }, taps: [], t0ms: t0, bd: bd * 1000, endMs: t0 + nBars * 4 * bd * 1000 };
    $('tRes').hidden = true; $('stopBtn').hidden = false; document.body.classList.add('running');
    run.raf = requestAnimationFrame(tFrame); run.timer = setTimeout(finishTap, run.endMs - nowMs() + 250);
  }
  function tFrame() {
    if (!run) return; const t = nowMs(), el = t - run.t0ms, barMs = run.bd * 4, bi = Math.floor(el / barMs), leadEnd = (1 + run.p.lead) * barMs;
    pbar.style.width = Math.max(0, Math.min(100, el / (run.endMs - run.t0ms) * 100)) + '%';
    const what = run.p.mode === 'ura' ? 'クリックの あいだ(ウラ)を たたく' : '2と4を たたく(クリックは 1と3)';
    if (el < 0) { pMain.textContent = 'じゅんび…'; pSub.textContent = ''; pad.className = ''; }
    else if (el < barMs) { pMain.textContent = 'きく'; pSub.textContent = '1小節め: お手本。小さい音が たたく位置'; pad.className = 'click'; }
    else if (el < leadEnd) { pMain.textContent = 'たたく'; pSub.textContent = what + '(のこり ' + (1 + run.p.lead - bi) + '小節)'; pad.className = 'click'; }
    else { pMain.textContent = '🔇 クリックなし'; pSub.textContent = 'そのまま つづける(のこり ' + Math.max(1, Math.ceil((run.endMs - t) / barMs)) + '小節)'; pad.className = 'hush'; }
    const show = el >= 0 && el < leadEnd; beatsEl.style.visibility = show ? 'visible' : 'hidden';
    if (show) { const b = Math.floor(el / run.bd) % 4; [...beatsEl.children].forEach((e, i) => e.classList.toggle('on', i === b)); }
    run.raf = requestAnimationFrame(tFrame);
  }
  function stopTap() { if (run) { cancelAnimationFrame(run.raf); clearTimeout(run.timer); run = null; } $('stopBtn').hidden = true; document.body.classList.remove('running'); pad.className = ''; pMain.textContent = 'タップではじめる'; pSub.textContent = T.mode === 'ura' ? 'クリックの あいだ(ウラ)を たたく練習' : '2拍め・4拍めを たたく練習(バックビート)'; pbar.style.width = '0'; beatsEl.style.visibility = 'hidden'; }
  function finishTap() { if (!run) return; const r = run; stopTap(); showTap(analyzeTap(r.taps, r.p), r.p); }
  function onTap(e) { e.preventDefault(); if (!run) { startTap(); return; } run.taps.push(e.timeStamp || nowMs()); osc('sine', 190, 90, ctx.currentTime, 0.09, 0.35); pad.classList.add('hit'); setTimeout(() => pad.classList.remove('hit'), 70); }
  pad.addEventListener('pointerdown', onTap); $('stopBtn').onclick = stopTap;
  document.addEventListener('keydown', (e) => { if (e.code === 'Space' && !/INPUT|BUTTON/.test(e.target.tagName) && !$('tTap').hidden) { e.preventDefault(); if (!e.repeat) onTap(e); } });
  const f1 = (v) => (Math.round(v * 10) / 10).toFixed(1), sg = (v) => (v >= 0 ? '+' : '') + f1(v);
  function showTap(a, p) {
    $('tRes').hidden = false;
    if (a.tooFew) { $('rank').textContent = '—'; $('verdict').textContent = 'たたいた数が少なくて 測れなかった。'; $('kv').innerHTML = ''; drawTap(a); return; }
    $('rank').textContent = a.rank + '  ' + a.score + '点'; const v = [];
    v.push(Math.abs(a.mean) < 8 ? '狙いの位置に だいたい ジャスト' : a.mean < 0 ? '全体に はしりぎみ' : '全体に もたりぎみ');
    if (Math.abs(a.driftBpm) >= 0.5 && p.hush > 0) v.push('だんだん ' + (a.driftBpm > 0 ? 'はやく' : 'おそく') + '(' + sg(a.driftBpm) + ' BPM)');
    if (a.missed / a.slots > 0.05) v.push('たたきわすれ ' + a.missed + '回');
    $('verdict').textContent = v.join(' / ');
    const rows = [['ズレ(RMS)', f1(a.rms) + ' ms'], ['ばらつき', f1(a.jitter) + ' ms'], ['走り(−)・もたり(+)の平均', sg(a.mean) + ' ms']];
    if (a.ratio !== null) rows.push(['たたいた ウラの位置', f1(a.ratio * 100) + '%(ねらい ' + f1(p.sw * 100) + '%)']);
    rows.push(['たたけた数', a.hits + ' / ' + a.slots + (a.extra ? '(よぶん ' + a.extra + ')' : '')], ['採点した部分', a.scoredPhase === 'hush' ? 'クリックなし' : 'クリックあり(後半)'], ['端末の遅れ(自動で引いた)', a.latOk ? sg(a.lat) + ' ms' : '測れず(0とした)']);
    $('kv').innerHTML = rows.map(([k, x]) => '<span>' + k + '</span><b>' + x + '</b>').join(''); drawTap(a);
  }
  function drawTap(a) {
    const W = 600, H = 190, mid = H / 2, rows = a.rows, n = rows.length; if (!n) { $('chart').innerHTML = ''; return; }
    const mx = Math.max(60, Math.ceil(Math.max(0, ...rows.filter((r) => r.dev !== null).map((r) => Math.abs(r.dev))) / 20) * 20);
    const X = (i) => 10 + (W - 20) * (i + 0.5) / n, Y = (d) => mid + d / mx * (mid - 14), nl = rows.filter((r) => r.phase === 'lead').length;
    let s = '<line x1="0" x2="' + W + '" y1="' + mid + '" y2="' + mid + '" stroke="currentColor" stroke-opacity=".6"/>';
    [-0.5, 0.5].forEach((q) => { s += '<line x1="0" x2="' + W + '" y1="' + Y(q * mx) + '" y2="' + Y(q * mx) + '" stroke="currentColor" stroke-opacity=".15" stroke-dasharray="3 4"/><text x="3" y="' + (Y(q * mx) - 2) + '" font-size="9" fill="currentColor" fill-opacity=".6">' + (q > 0 ? '+' : '−') + (mx / 2) + 'ms</text>'; });
    if (nl && nl < n) s += '<line x1="' + X(nl - 0.5) + '" x2="' + X(nl - 0.5) + '" y1="0" y2="' + H + '" stroke="currentColor" stroke-opacity=".5" stroke-dasharray="4 3"/><text x="' + (X(nl - 0.5) + 4) + '" y="12" font-size="10" fill="currentColor" fill-opacity=".7">クリックなし →</text>';
    rows.forEach((r) => { if (r.dev === null) { if (r.phase === 'hush' || a.scoredPhase === 'lead') s += '<path d="M' + (X(r.i) - 2.5) + ' ' + (H - 6) + ' l5 5 m0 -5 l-5 5" stroke="#d0021b" stroke-width="1.2" fill="none"/>'; return; } const y = Math.max(6, Math.min(H - 6, Y(r.dev))); s += r.phase === 'lead' ? '<circle cx="' + X(r.i) + '" cy="' + y + '" r="3" fill="none" stroke="currentColor" stroke-opacity=".6"/>' : '<circle cx="' + X(r.i) + '" cy="' + y + '" r="3.2" fill="#d0021b"/>'; });
    $('chart').innerHTML = s;
  }
  function segT(id, list, key, after) { const el = $(id); el.innerHTML = list.map(([l, v]) => '<button type="button" data-v="' + v + '">' + l + '</button>').join(''); const sync = () => [...el.children].forEach((b) => b.classList.toggle('on', String(b.dataset.v) === String(T[key]) || (key === 'sw' && Math.abs(+b.dataset.v - T.sw) < 1e-6))); el.onclick = (e) => { const b = e.target.closest('button'); if (!b || run) return; T[key] = isNaN(+b.dataset.v) ? b.dataset.v : +b.dataset.v; store.set('swinglab.tap', T); sync(); if (after) after(); }; sync(); }
  const tModeAfter = () => { $('tSwRow').hidden = T.mode !== 'ura'; stopTap(); };
  segT('tMode', MODES, 'mode', tModeAfter); segT('tSw', SWT, 'sw'); segT('tLead', LEADS, 'lead'); segT('tHush', HUSHES, 'hush');
  $('tbpm').value = T.bpm; $('tbpmOut').textContent = T.bpm; $('tbpm').oninput = (e) => { if (run) { e.target.value = T.bpm; return; } T.bpm = +e.target.value; $('tbpmOut').textContent = T.bpm; store.set('swinglab.tap', T); };
  $('tSwRow').hidden = T.mode !== 'ura'; stopTap();

  // ====================== タブ ======================
  function showTab(t) {
    stopPlay(); stopTap();
    [...$('tabs').children].forEach((b) => b.classList.toggle('on', b.dataset.t === t));
    $('tPlay').hidden = !(t === 'play' || t === 'guess'); $('tGuess').hidden = t !== 'guess'; $('tTap').hidden = t !== 'tap';
    $('swingRows').hidden = t === 'guess'; $('chipsPlay').hidden = t === 'guess'; $('linkBtn').parentElement.hidden = t === 'guess'; $('playBtn').parentElement.hidden = t === 'guess';
    gState.on = t === 'guess';
    if (t === 'guess') gNew(); else { if (!P.link && t === 'play') { /* そのまま */ } refreshPlay(); }
    if (t === 'play') { P.rB = Math.min(P.rB, 0.75); refreshPlay(); }
  }
  $('tabs').onclick = (e) => { const b = e.target.closest('button'); if (b) showTab(b.dataset.t); };
  refreshPlay(); gRender();
})();
