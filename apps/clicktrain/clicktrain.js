// 体内クリック: クリックが途中で消えたあとも、同じテンポで画面をたたき続けて、ズレを測る
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const BEATS = 4;                                              // 1小節 = 4拍
  const SUBS = [['4分', 1], ['8分', 2], ['3連', 3], ['16分', 4]];
  const LEADS = [['2小節', 2], ['4小節', 4], ['8小節', 8]];
  const HUSHES = [['4小節', 4], ['8小節', 8], ['16小節', 16], ['32小節', 32]];
  const cfg = { bpm: 120, sub: 1, lead: 4, hush: 8, tapSnd: true };
  const store = { get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 保存できなくても動く */ } } };
  Object.assign(cfg, store.get('clicktrain.cfg', {}));

  // ---------- 解析(音や画面に依存しない) ----------
  // taps: ゲーム時計(ms)での、たたいた時刻。t0: 最初のクリックの時刻(ms)。
  // 小節0は聞くだけ。小節1〜lead が「クリックあり」、そのあと hush 小節が「クリックなし」。
  function analyze(taps, p) {
    const iv = 60000 / p.bpm / p.sub, perBar = BEATS * p.sub, n0 = perBar, nLead = p.lead * perBar, nAll = nLead + p.hush * perBar;
    const slot = new Map(), extra = [];
    for (const t of taps) {
      const k = Math.round((t - p.t0) / iv);
      if (k < n0 || k >= n0 + nAll) continue;
      const dev = t - p.t0 - k * iv;
      if (Math.abs(dev) > iv / 2 + 1e-9) continue;
      if (!slot.has(k) || Math.abs(dev) < Math.abs(slot.get(k))) { if (slot.has(k)) extra.push(k); slot.set(k, dev); } else extra.push(k);
    }
    const rows = [];                                            // {i(0〜), dev, phase('lead'|'hush'), t(ms)}
    for (let k = n0; k < n0 + nAll; k++) rows.push({ i: k - n0, phase: k - n0 < nLead ? 'lead' : 'hush', dev: slot.has(k) ? slot.get(k) : null, t: k * iv });
    const med = (a) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
    const leadDevs = rows.filter((r) => r.phase === 'lead' && r.dev !== null && r.i >= nLead / 2).map((r) => r.dev);   // 後半(なれたころ)で、端末の遅れを見る
    const lat = leadDevs.length >= 4 ? med(leadDevs) : 0;
    rows.forEach((r) => { if (r.dev !== null) r.dev -= lat; });
    const hush = rows.filter((r) => r.phase === 'hush');
    const hit = hush.filter((r) => r.dev !== null);
    const out = { rows, lat, latOk: leadDevs.length >= 4, hushSlots: hush.length, hits: hit.length, missed: hush.length - hit.length, extra: extra.length };
    if (hit.length < 3) { out.score = 0; out.rank = '-'; out.tooFew = true; return out; }
    const devs = hit.map((r) => r.dev), mean = devs.reduce((a, b) => a + b, 0) / devs.length;
    const rms = Math.sqrt(devs.reduce((a, b) => a + b * b, 0) / devs.length);
    // 直線近似(時間がたつほど、ズレがどう変わるか) → テンポのドリフト
    const xs = hit.map((r) => r.t / 1000), mx = xs.reduce((a, b) => a + b, 0) / xs.length;
    let sxy = 0, sxx = 0; xs.forEach((x, i) => { sxy += (x - mx) * (devs[i] - mean); sxx += (x - mx) * (x - mx); });
    const b = sxx > 0 ? sxy / sxx : 0;                          // ms / 秒
    const resid = Math.sqrt(devs.reduce((a, d, i) => a + Math.pow(d - (mean + b * (xs[i] - mx)), 2), 0) / devs.length);
    const ratio = 1 + b / 1000, userBpm = p.bpm / ratio;
    const cover = hit.length / hush.length;
    out.mean = mean; out.rms = rms; out.jitter = resid; out.slope = b; out.userBpm = userBpm; out.driftBpm = userBpm - p.bpm; out.mx = mx; out.cover = cover;
    out.score = Math.round(100 * Math.exp(-rms / 50) * Math.pow(cover, 1.5));
    out.rank = out.score >= 88 ? 'S' : out.score >= 78 ? 'A' : out.score >= 62 ? 'B' : out.score >= 45 ? 'C' : 'D';
    return out;
  }
  window.__analyze = analyze;

  // ---------- 音 ----------
  let ctx = null, ctx0 = 0, perf0 = 0;
  function ensureAudio() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
  }
  function click(t, accent) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'triangle'; o.frequency.value = accent ? 2000 : 1400;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(accent ? 0.9 : 0.6, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.06);
    o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + 0.08);
  }
  function thump() {
    if (!cfg.tapSnd || !ctx) return;
    const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(190, t); o.frequency.exponentialRampToValueAtTime(90, t + 0.07);
    g.gain.setValueAtTime(0.35, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + 0.1);
  }

  // ---------- 進行 ----------
  let run = null;                                               // {p, taps, endTimer, raf}
  const pad = $('pad'), main = $('padMain'), sub = $('padSub'), bar = $('bar'), beatsEl = $('beats');
  beatsEl.innerHTML = '<i></i><i></i><i></i><i></i>';
  const nowMs = () => performance.now();

  function start() {
    ensureAudio();
    const beat = 60 / cfg.bpm, tStart = ctx.currentTime + 0.6;
    ctx0 = ctx.currentTime; perf0 = nowMs();
    const t0ms = perf0 + (tStart - ctx0) * 1000;                // 最初のクリックの時刻(ゲーム時計)
    const clickBeats = (1 + cfg.lead) * BEATS;
    for (let i = 0; i < clickBeats; i++) click(tStart + i * beat, i % BEATS === 0);
    const totalBars = 1 + cfg.lead + cfg.hush, endMs = t0ms + totalBars * BEATS * beat * 1000;
    run = { p: { bpm: cfg.bpm, sub: cfg.sub, lead: cfg.lead, hush: cfg.hush, t0: t0ms }, taps: [], endMs, t0ms, beat: beat * 1000 };
    $('result').hidden = true; $('stopBtn').hidden = false; document.body.classList.add('running');
    run.raf = requestAnimationFrame(frame);
    run.timer = setTimeout(finish, endMs - nowMs() + 250);
  }
  function frame() {
    if (!run) return;
    const t = nowMs(), el = t - run.t0ms, barMs = run.beat * BEATS, barIdx = Math.floor(el / barMs);
    const leadEnd = (1 + run.p.lead) * barMs;
    bar.style.width = Math.max(0, Math.min(100, el / (run.endMs - run.t0ms) * 100)) + '%';
    if (el < 0) { main.textContent = 'じゅんび…'; sub.textContent = ''; pad.className = ''; }
    else if (el < barMs) { main.textContent = 'きく'; sub.textContent = 'さいしょの 1小節は きくだけ'; pad.className = 'click'; }
    else if (el < leadEnd) { main.textContent = 'たたく'; sub.textContent = 'クリックに あわせて(のこり ' + (1 + run.p.lead - barIdx) + '小節)'; pad.className = 'click'; }
    else { main.textContent = '🔇 クリックなし'; sub.textContent = 'そのまま たたきつづける(のこり ' + Math.max(1, Math.ceil((run.endMs - t) / barMs)) + '小節)'; pad.className = 'hush'; }
    const showBeats = el >= 0 && el < leadEnd;
    beatsEl.style.visibility = showBeats ? 'visible' : 'hidden';
    if (showBeats) { const b = Math.floor(el / run.beat) % BEATS; [...beatsEl.children].forEach((e, i) => e.classList.toggle('on', i === b)); }
    run.raf = requestAnimationFrame(frame);
  }
  function stopRun() {
    if (!run) return;
    cancelAnimationFrame(run.raf); clearTimeout(run.timer); run = null;
    $('stopBtn').hidden = true; document.body.classList.remove('running');
    pad.className = ''; main.textContent = 'タップではじめる'; sub.textContent = 'クリックに合わせてたたき始める'; bar.style.width = '0'; beatsEl.style.visibility = 'hidden';
  }
  function finish() {
    if (!run) return;
    const r = run; stopRun();
    show(analyze(r.taps, r.p), r.p);
  }
  function onTap(e) {
    e.preventDefault();
    if (!run) { start(); return; }
    run.taps.push(e.timeStamp || nowMs());
    thump(); pad.classList.add('hit'); setTimeout(() => pad.classList.remove('hit'), 70);
  }
  pad.addEventListener('pointerdown', onTap);
  pad.addEventListener('keydown', (e) => { if (e.code === 'Space' || e.code === 'Enter') onTap(e); });
  pad.tabIndex = 0;
  document.addEventListener('keydown', (e) => { if (e.code === 'Space' && !/INPUT|BUTTON|SELECT/.test(e.target.tagName)) { e.preventDefault(); if (!e.repeat) { if (run) { run.taps.push(e.timeStamp || nowMs()); thump(); pad.classList.add('hit'); setTimeout(() => pad.classList.remove('hit'), 70); } else start(); } } });
  $('stopBtn').onclick = stopRun;

  // ---------- 結果 ----------
  const f1 = (v) => (Math.round(v * 10) / 10).toFixed(1);
  const sg = (v) => (v >= 0 ? '+' : '') + f1(v);
  function show(a, p) {
    $('result').hidden = false;
    if (a.tooFew) { $('rank').textContent = '—'; $('verdict').textContent = 'たたいた数が少なくて、測れなかった。クリックなしの部分でも、たたき続けてみる。'; $('kv').innerHTML = ''; draw(a, p); return; }
    $('rank').textContent = a.rank + '  ' + a.score + '点';
    const v = [];
    if (Math.abs(a.mean) >= 8) v.push(a.mean < 0 ? '全体に はしりぎみ(はやい)' : '全体に もたりぎみ(おそい)'); else v.push('位置は だいたい ジャスト');
    if (Math.abs(a.driftBpm) >= 0.5) v.push('だんだん ' + (a.driftBpm > 0 ? 'はやく' : 'おそく') + ' なってる(' + sg(a.driftBpm) + ' BPM)'); else v.push('テンポは 安定');
    if (a.missed / a.hushSlots > 0.05) v.push('たたきわすれ ' + a.missed + '回');
    $('verdict').textContent = v.join(' / ');
    $('kv').innerHTML = [
      ['クリックなし部分のズレ(RMS)', f1(a.rms) + ' ms'],
      ['ばらつき(ゆれ)', f1(a.jitter) + ' ms'],
      ['走り(−)・もたり(+)の平均', sg(a.mean) + ' ms'],
      ['テンポのドリフト', sg(a.driftBpm) + ' BPM(' + f1(a.userBpm) + ')'],
      ['たたけた数', a.hits + ' / ' + a.hushSlots + (a.extra ? '(よぶん ' + a.extra + ')' : '')],
      ['端末の遅れ(自動で引いた)', a.latOk ? sg(a.lat) + ' ms' : '測れず(0とした)'],
    ].map(([k, x]) => '<span>' + k + '</span><b>' + x + '</b>').join('');
    draw(a, p);
    saveHist(a, p);
  }
  function draw(a, p) {
    const W = 600, H = 200, mid = H / 2, rows = a.rows, n = rows.length;
    const mx = Math.max(60, Math.ceil(Math.max(0, ...rows.filter((r) => r.dev !== null).map((r) => Math.abs(r.dev))) / 20) * 20);
    const X = (i) => 10 + (W - 20) * (i + 0.5) / n, Y = (d) => mid + d / mx * (mid - 14);                // 下=おそい(+)、上=はやい(−)
    const leadN = rows.filter((r) => r.phase === 'lead').length;
    let s = '<line x1="0" x2="' + W + '" y1="' + mid + '" y2="' + mid + '" stroke="currentColor" stroke-opacity=".6"/>';
    [-0.5, 0.5].forEach((q) => { s += '<line x1="0" x2="' + W + '" y1="' + Y(q * mx) + '" y2="' + Y(q * mx) + '" stroke="currentColor" stroke-opacity=".15" stroke-dasharray="3 4"/><text x="3" y="' + (Y(q * mx) - 2) + '" font-size="9" fill="currentColor" fill-opacity=".6">' + (q > 0 ? '+' : '−') + (mx / 2) + 'ms</text>'; });
    if (leadN && leadN < n) s += '<line x1="' + X(leadN - 0.5) + '" x2="' + X(leadN - 0.5) + '" y1="0" y2="' + H + '" stroke="currentColor" stroke-opacity=".5" stroke-dasharray="4 3"/><text x="' + (X(leadN - 0.5) + 4) + '" y="12" font-size="10" fill="currentColor" fill-opacity=".7">クリックなし →</text>';
    rows.forEach((r) => {
      if (r.dev === null) { if (r.phase === 'hush') s += '<path d="M' + (X(r.i) - 2.5) + ' ' + (H - 6) + ' l5 5 m0 -5 l-5 5" stroke="#d0021b" stroke-width="1.2" fill="none"/>'; return; }
      const y = Math.max(6, Math.min(H - 6, Y(r.dev)));
      s += r.phase === 'lead' ? '<circle cx="' + X(r.i) + '" cy="' + y + '" r="3" fill="none" stroke="currentColor" stroke-opacity=".6"/>' : '<circle cx="' + X(r.i) + '" cy="' + y + '" r="3.2" fill="#d0021b"/>';
    });
    if (a.slope !== undefined && n) {                           // ドリフトの直線
      const hushRows = rows.filter((r) => r.phase === 'hush'), r0 = hushRows[0], r1 = hushRows[hushRows.length - 1];
      const dv = (r) => a.mean + a.slope * (r.t / 1000 - a.mx);
      s += '<line x1="' + X(r0.i) + '" y1="' + Y(dv(r0)) + '" x2="' + X(r1.i) + '" y2="' + Y(dv(r1)) + '" stroke="currentColor" stroke-width="1.5" stroke-opacity=".8"/>';
    }
    $('chart').innerHTML = s;
  }

  // ---------- きろく ----------
  function saveHist(a, p) {
    const h = store.get('clicktrain.hist', []);
    const d = new Date();
    h.unshift({ d: (d.getMonth() + 1) + '/' + d.getDate() + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'), bpm: p.bpm, sub: SUBS.find((x) => x[1] === p.sub)[0], hush: p.hush, score: a.score, rms: Math.round(a.rms * 10) / 10, drift: Math.round(a.driftBpm * 10) / 10 });
    store.set('clicktrain.hist', h.slice(0, 30)); renderHist();
  }
  function renderHist() {
    const h = store.get('clicktrain.hist', []);
    $('hist').innerHTML = h.length ? '<table class="hist"><tr><th>日時</th><th>BPM</th><th>細かさ</th><th>消音</th><th>RMS</th><th>ドリフト</th><th>点</th></tr>' + h.slice(0, 12).map((x) => '<tr><td>' + x.d + '</td><td>' + x.bpm + '</td><td>' + x.sub + '</td><td>' + x.hush + '</td><td>' + x.rms + '</td><td>' + (x.drift >= 0 ? '+' : '') + x.drift + '</td><td><b>' + x.score + '</b></td></tr>').join('') + '</table>' : 'まだありません。';
  }
  $('clrHist').onclick = () => { if (confirm('きろくを ぜんぶ 消すよ。いい?')) { store.set('clicktrain.hist', []); renderHist(); } };

  // ---------- 設定UI ----------
  function seg(id, list, key) {
    const el = $(id);
    el.innerHTML = list.map(([l, v]) => '<button type="button" data-v="' + v + '">' + l + '</button>').join('');
    const sync = () => [...el.children].forEach((b) => b.classList.toggle('on', +b.dataset.v === cfg[key]));
    el.onclick = (e) => { const b = e.target.closest('button'); if (!b || run) return; cfg[key] = +b.dataset.v; store.set('clicktrain.cfg', cfg); sync(); };
    sync();
  }
  seg('subSeg', SUBS, 'sub'); seg('leadSeg', LEADS, 'lead'); seg('hushSeg', HUSHES, 'hush');
  const tsb = $('optSeg'); const syncT = () => { tsb.innerHTML = '<button type="button" class="' + (cfg.tapSnd ? 'on' : '') + '">たたく音: ' + (cfg.tapSnd ? 'あり' : 'なし') + '</button>'; };
  tsb.onclick = () => { cfg.tapSnd = !cfg.tapSnd; store.set('clicktrain.cfg', cfg); syncT(); }; syncT();
  const bpmEl = $('bpm'); bpmEl.value = cfg.bpm; $('bpmOut').textContent = cfg.bpm;
  bpmEl.oninput = () => { if (run) { bpmEl.value = cfg.bpm; return; } cfg.bpm = +bpmEl.value; $('bpmOut').textContent = cfg.bpm; store.set('clicktrain.cfg', cfg); };
  beatsEl.style.visibility = 'hidden';
  renderHist();
})();
