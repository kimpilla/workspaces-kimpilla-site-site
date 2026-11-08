// おえかき おんがく: ゆびで なぞって ブロックを ならべると、ドレミで ならせる(いろ = がっき)
(() => {
  const $ = (id) => document.getElementById(id);
  const COLS = 16, ROWS = 8;
  const NOTES = [['ド', 523.25], ['シ', 493.88], ['ラ', 440.0], ['ソ', 392.0], ['ファ', 349.23], ['ミ', 329.63], ['レ', 293.66], ['ド', 261.63]];   // うえから(たかい じゅん)
  const INST = [{ c: '#ff6b6b', e: '🎹', n: 'ピアノ' }, { c: '#5b9cff', e: '🔔', n: 'ベル' }, { c: '#f7c948', e: '🎺', n: 'ふえ' }, { c: '#4fc98a', e: '🎸', n: 'ベース' }];
  let grid = Array.from({ length: ROWS }, () => new Array(COLS).fill(0));   // 0 = からっぽ、1〜4 = いろ
  let color = 1, undoStack = [], playing = false, step = 0, ac = null, master = null, timer = null, nextT = 0, vis = [];
  const store = { get() { try { return localStorage.getItem('oekaki1'); } catch (e) { return null; } }, set(v) { try { localStorage.setItem('oekaki1', v); } catch (e) { /* */ } } };
  try { const s = JSON.parse(store.get() || 'null'); if (Array.isArray(s) && s.length === ROWS && s.every((r) => Array.isArray(r) && r.length === COLS)) grid = s.map((r) => r.map((v) => (v >= 0 && v <= 4 ? v | 0 : 0))); } catch (e) { /* */ }

  // ---- がめん ----
  const board = $('board'), cells = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) { const d = document.createElement('div'); d.className = 'c'; board.appendChild(d); cells.push(d); }
  const labels = $('labels');
  NOTES.forEach(([n, f], r) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = n; b.setAttribute('aria-label', n + 'の おと'); b.addEventListener('pointerdown', (e) => { e.preventDefault(); ensure(); voice(color, f, ac.currentTime + 0.01, 0.4); }); labels.appendChild(b); });
  const pens = $('pens');
  INST.forEach((it, i) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'pen' + (i === 0 ? ' sel' : ''); b.style.setProperty('--c', it.c); b.textContent = it.e; b.setAttribute('aria-label', it.n); b.addEventListener('click', () => pick(i + 1)); pens.appendChild(b); });
  { const b = document.createElement('button'); b.type = 'button'; b.className = 'pen eraser'; b.innerHTML = '<svg viewBox="0 0 40 40" width="30" height="30" aria-hidden="true"><g transform="rotate(-35 20 20)"><rect x="5" y="11" width="30" height="18" rx="4" fill="#fff" stroke="#8a7f70" stroke-width="2.4"/><path d="M5 15a4 4 0 0 1 4-4h8v18H9a4 4 0 0 1-4-4z" fill="#f08a9a" stroke="#8a7f70" stroke-width="2.4" stroke-linejoin="round"/></g><path d="M7 35h26" stroke="#8a7f70" stroke-width="2.4" stroke-linecap="round"/></svg><span>けしごむ</span>'; b.setAttribute('aria-label', 'けしごむ'); b.addEventListener('click', () => pick(0)); pens.appendChild(b); }
  function pick(v) { color = v; [...pens.children].forEach((b, j) => b.classList.toggle('sel', j === (v === 0 ? 4 : v - 1))); }
  function paint(r, c) { const v = grid[r][c], d = cells[r * COLS + c]; d.className = 'c' + (v ? ' f' : ''); if (v) d.style.setProperty('--c', INST[v - 1].c); else d.style.removeProperty('--c'); }
  function paintAll() { for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) paint(r, c); refresh(); }
  const empty = () => grid.every((r) => r.every((v) => !v));
  function refresh() { $('clear').disabled = empty(); $('undo').disabled = !undoStack.length; store.set(JSON.stringify(grid)); }

  // ---- おと(いろごとの がっき) ----
  function ensure() { if (ac) { if (ac.state !== 'running') ac.resume(); return; } ac = new (window.AudioContext || window.webkitAudioContext)(); const comp = ac.createDynamicsCompressor(); master = ac.createGain(); master.gain.value = 0.6; master.connect(comp); comp.connect(ac.destination); }
  function env(g, t, a, peak, d) { g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
  function osc(type, f, t, dur, g) { const o = ac.createOscillator(); o.type = type; o.frequency.value = f; o.connect(g); o.start(t); o.stop(t + dur); return o; }
  function voice(inst, f, t, len) {
    const g = ac.createGain(); g.connect(master);
    if (inst === 1) { env(g, t, 0.006, 0.34, 0.7); osc('triangle', f, t, 0.8, g); const g2 = ac.createGain(); env(g2, t, 0.004, 0.12, 0.3); g2.connect(master); osc('sine', f * 2, t, 0.4, g2); }          // ピアノ
    else if (inst === 2) { env(g, t, 0.004, 0.26, 1.3); osc('sine', f, t, 1.4, g); const g2 = ac.createGain(); env(g2, t, 0.003, 0.1, 0.5); g2.connect(master); osc('sine', f * 2.76, t, 0.6, g2); const g3 = ac.createGain(); env(g3, t, 0.003, 0.05, 0.25); g3.connect(master); osc('sine', f * 5.4, t, 0.3, g3); }   // ベル
    else if (inst === 3) {                                                                                                                   // ふえ(ゆっくり たちあがる、ふるえる)
      const d = Math.max(0.2, len * 0.95); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.28, t + 0.07); g.gain.setValueAtTime(0.28, t + d - 0.05); g.gain.linearRampToValueAtTime(0.0001, t + d + 0.08);
      const o = osc('sine', f, t, d + 0.1, g), l = ac.createOscillator(), lg = ac.createGain(); l.frequency.value = 5; lg.gain.value = f * 0.004; l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + d + 0.1);
    } else {                                                                                                                                  // ベース(1オクターブ ひくい)
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700; lp.connect(master); g.disconnect(); g.connect(lp); env(g, t, 0.008, 0.42, 0.45); osc('sawtooth', f / 2, t, 0.5, g);
      const g2 = ac.createGain(); env(g2, t, 0.008, 0.3, 0.4); g2.connect(master); osc('sine', f / 2, t, 0.45, g2);
    }
  }
  // ひとつの ますの おと(さわった ときの かくにん)
  let lastPre = 0;
  function pre(r, v) { const now = performance.now(); if (now - lastPre < 55) return; lastPre = now; ensure(); voice(v, NOTES[r][1], ac.currentTime + 0.005, 0.3); }

  // ---- なぞる ----
  let drag = null;
  const cellAt = (e) => { const b = board.getBoundingClientRect(); const c = Math.floor(((e.clientX - b.left) / b.width) * COLS), r = Math.floor(((e.clientY - b.top) / b.height) * ROWS); return (c >= 0 && c < COLS && r >= 0 && r < ROWS) ? [r, c] : null; };
  function apply(r, c) {
    const want = drag.erase ? 0 : color;
    if (grid[r][c] === want) return;
    grid[r][c] = want; paint(r, c);
    if (want) pre(r, want);
  }
  function line(a, b) { const n = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]), 1); for (let i = 1; i <= n; i++) apply(Math.round(a[0] + ((b[0] - a[0]) * i) / n), Math.round(a[1] + ((b[1] - a[1]) * i) / n)); }
  board.addEventListener('pointerdown', (e) => {
    const p = cellAt(e); if (!p) return; e.preventDefault(); ensure();
    try { board.setPointerCapture(e.pointerId); } catch (x) { /* */ }
    undoStack.push(JSON.stringify(grid)); if (undoStack.length > 30) undoStack.shift();
    drag = { erase: color === 0 || grid[p[0]][p[1]] === color, last: p, id: e.pointerId };     // なぞりはじめが おなじ いろの ブロックなら、けして いく
    const before = grid[p[0]][p[1]]; apply(p[0], p[1]);
    if (drag.erase && before) { /* けした */ } hideHint(); refresh();
  });
  board.addEventListener('pointermove', (e) => { if (!drag || e.pointerId !== drag.id) return; const p = cellAt(e); if (!p) return; if (p[0] !== drag.last[0] || p[1] !== drag.last[1]) { line(drag.last, p); drag.last = p; refresh(); } });
  const end = (e) => { if (!drag || (e && e.pointerId !== drag.id)) return; drag = null; if (JSON.stringify(grid) === undoStack[undoStack.length - 1]) undoStack.pop(); refresh(); };
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((t) => board.addEventListener(t, end));
  $('undo').onclick = () => { const s = undoStack.pop(); if (!s) return; grid = JSON.parse(s); paintAll(); };
  $('clear').onclick = () => { undoStack.push(JSON.stringify(grid)); grid = Array.from({ length: ROWS }, () => new Array(COLS).fill(0)); paintAll(); };
  function hideHint() { $('hint').textContent = ''; }

  // ---- ならす ----
  const stepSec = () => 0.42 - ($('spd').value / 100) * 0.30;               // 1マスの ながさ(0.42 〜 0.12びょう)
  function sched() {
    while (nextT < ac.currentTime + 0.12) {
      const len = stepSec();
      for (let r = 0; r < ROWS; r++) { const v = grid[r][step]; if (v) voice(v, NOTES[r][1], nextT, len); }
      vis.push({ t: nextT, c: step }); step = (step + 1) % COLS; nextT += len;
    }
  }
  function show() {
    if (!playing) return; requestAnimationFrame(show);
    while (vis.length && vis[0].t <= ac.currentTime) {
      const { c } = vis.shift(); $('head').style.left = (c * 100 / COLS) + '%';
      for (let r = 0; r < ROWS; r++) if (grid[r][c]) { const d = cells[r * COLS + c]; d.classList.remove('hit'); void d.offsetWidth; d.classList.add('hit'); }
    }
  }
  function start() { ensure(); playing = true; step = 0; vis = []; nextT = ac.currentTime + 0.06; $('head').style.display = 'block'; $('play').classList.add('on'); $('play').textContent = '■ とめる'; hideHint(); sched(); timer = setInterval(sched, 25); requestAnimationFrame(show); }
  function stop() { playing = false; clearInterval(timer); $('head').style.display = 'none'; $('play').classList.remove('on'); $('play').textContent = '▶ ならす'; cells.forEach((d) => d.classList.remove('hit')); }
  $('play').onclick = () => (playing ? stop() : start());
  paintAll();
  if (!empty()) hideHint();
})();
