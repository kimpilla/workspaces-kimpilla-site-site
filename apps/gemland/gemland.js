// ほうせきの くにの ぼうけん: ぷにまるが じどうで すすむ。ドレミの ボタンを おすと、その たかさまで ジャンプして、おなじ いろの ほうせきを とる
(() => {
  const $ = (id) => document.getElementById(id);
  const NOTES = [['ド', '#ff6b6b', 261.63], ['レ', '#ff9f43', 293.66], ['ミ', '#f2c200', 329.63], ['ファ', '#4cc77a', 349.23], ['ソ', '#26b5e8', 392.0], ['ラ', '#5b7cff', 440.0], ['シ', '#9b6bff', 493.88], ['ド', '#ff6fb5', 523.25]];
  const C_MAJ = [0, 2, 4, 5, 7, 9, 11];
  const STAGES = [
    { name: 'ドミソ', keys: [0, 2, 4], seq: [0, 2, 4, 2, 0], gap: 230, scale: true, hint: 0 },
    { name: 'ドレミファソ', keys: [0, 1, 2, 3, 4], seq: [0, 1, 2, 3, 4, 3, 2, 1, 0], gap: 210, scale: true, hint: 0 },
    { name: 'ドレミ〜ド', keys: [0, 1, 2, 3, 4, 5, 6, 7], seq: [0, 1, 2, 3, 4, 5, 6, 7, 6, 5, 4, 3, 2, 1, 0], gap: 200, scale: true, hint: 3 },
    { name: 'きらきらぼし', keys: [0, 1, 2, 3, 4, 5, 6, 7], seq: [0, 0, 4, 4, 5, 5, 4, 3, 3, 2, 2, 1, 1, 0], gap: 190, scale: false, hint: 3 },
    { name: 'ちょうちょう', keys: [0, 1, 2, 3, 4, 5, 6, 7], seq: [4, 2, 2, 3, 1, 1, 0, 1, 2, 3, 4, 4, 4], gap: 190, scale: false, hint: 3 }
  ];
  const cv = $('gc'), g = cv.getContext('2d');
  let W = 320, H = 400, U = 1, groundY = 340, kC = 0.5, SP = 36, H0 = 28, G = 1800, cx = 90;
  const hOf = (k) => H0 + k * SP;                                       // ボタンの たかさ → ジャンプの たかさ
  const S = { st: 0, x: 0, h: 0, vy: 0, gems: [], got: 0, finishX: 0, t: 0, cheer: 0, land: 0, blink: 0, wait: 0, done: 0, sparks: [], pops: [], conf: [], banner: 4, air: false, hintK: -1 };
  let cleared = [];
  try { cleared = JSON.parse(localStorage.getItem('gemland.cleared') || '[]'); } catch (e) { cleared = []; }

  // ---- おんせい ----
  let ctx = null, out = null;
  function ensure() {
    if (!ctx) { ctx = new (window.AudioContext || window.webkitAudioContext)(); out = ctx.createGain(); out.gain.value = 0.3; out.connect(ctx.destination); }
    if (ctx.state !== 'running' && ctx.state !== 'closed') { const p = ctx.resume(); if (p && p.catch) p.catch(() => {}); }
  }
  ['pointerdown', 'touchend', 'keydown'].forEach((ev) => document.addEventListener(ev, () => { if (ctx) ensure(); }, { passive: true, capture: true }));
  document.addEventListener('visibilitychange', () => { if (!document.hidden && ctx) ensure(); });
  function tone(f, t, dur, vol) {
    const o = ctx.createOscillator(), o2 = ctx.createOscillator(), a = ctx.createGain(), b = ctx.createGain();
    o.type = 'sine'; o.frequency.value = f; o2.type = 'sine'; o2.frequency.value = f * 2; b.gain.value = 0.22;
    a.gain.setValueAtTime(0.0001, t); a.gain.exponentialRampToValueAtTime(vol, t + 0.012); a.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(a); o2.connect(b); b.connect(a); a.connect(out); o.start(t); o2.start(t); o.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
  }
  const degHz = (d) => 261.63 * Math.pow(2, (C_MAJ[d % 7] + 12 * Math.floor(d / 7)) / 12);
  function sndJump(k) { ensure(); tone(NOTES[k][2], ctx.currentTime + 0.01, 0.22, 0.16); }
  function sndGet(k) {
    ensure(); const t = ctx.currentTime + 0.02;
    if (STAGES[S.st].scale && k > 0) { for (let d = 0; d <= k; d++) tone(degHz(d), t + d * 0.06, d === k ? 0.9 : 0.2, d === k ? 0.42 : 0.26); }
    else tone(NOTES[k][2], t, 0.8, 0.42);
  }
  function sndClear(all) {
    ensure(); const t = ctx.currentTime + 0.05;
    [0, 2, 4, 7].forEach((d, i) => tone(degHz(d), t + i * 0.12, 0.5, 0.3));
    [0, 2, 4, 7].forEach((d, i) => tone(degHz(d + 7) * (i ? 1 : 1), t + 0.55, 1.6, i === 0 ? 0.38 : 0.2));
    if (all) [4, 7, 9, 11].forEach((d, i) => tone(degHz(d + 7), t + 0.75 + i * 0.1, 1.2, 0.16));
  }

  // ---- がめん ----
  function layout() {
    const r = cv.parentNode.getBoundingClientRect(), dpr = devicePixelRatio || 1;
    W = Math.max(200, Math.round(r.width)); H = Math.max(200, Math.round(r.height));
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    U = H / 440; kC = 0.5 * U; groundY = H - 46 * U; cx = W * 0.27; G = 4.3 * H;
    H0 = 26 * U; const top = 34 * U;                                      // いちばん たかい ボタンでも、がめんの うえに はみ出さない
    SP = (groundY - 49 * kC - top - H0) / 7;
  }
  window.addEventListener('resize', layout);
  if (window.ResizeObserver) new ResizeObserver(layout).observe(cv.parentNode);

  // ---- ステージ ----
  const keysEl = $('keys'), keyBtns = [], stgEl = $('stg'), stgBtns = [];
  NOTES.forEach(([name, col], k) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'key' + (k === 7 ? ' hi' : ''); b.textContent = k === 7 ? name + '↑' : name; b.style.background = col;
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); press(k); b.classList.add('on'); setTimeout(() => b.classList.remove('on'), 120); });
    keysEl.appendChild(b); keyBtns.push(b);
  });
  STAGES.forEach((s, i) => {
    const b = document.createElement('button'); b.type = 'button'; b.addEventListener('click', () => loadStage(i)); stgEl.appendChild(b); stgBtns.push(b);
  });
  function paintStages() { stgBtns.forEach((b, i) => { b.textContent = (cleared.includes(i) ? '★' : '') + (i + 1); b.classList.toggle('sel', i === S.st); b.setAttribute('aria-label', 'ステージ' + (i + 1) + ' ' + STAGES[i].name); }); }
  function loadStage(i) {
    const s = STAGES[i]; S.st = i; S.x = 0; S.h = 0; S.vy = 0; S.got = 0; S.done = 0; S.cheer = 0; S.wait = 0; S.sparks = []; S.pops = []; S.conf = []; S.banner = 5; S.hintK = -1; S.air = false;
    const first = 260, gp = s.gap;
    S.gems = s.seq.map((k, n) => ({ k, wx: (first + n * gp) * U, got: false, t: Math.random() * 6 }));
    S.finishX = (first + (s.seq.length - 1) * gp + 330) * U;
    keyBtns.forEach((b) => { b.classList.remove('hint'); });
    keysEl.style.setProperty('--n', 8);                                  // ボタンは いつも 8こ、1れつの けんばん
    $('clear').classList.remove('show'); paintStages(); hud();
  }
  const hud = () => { $('cnt').textContent = '💎 ' + S.got + '/' + S.gems.length; };

  // ---- ジャンプ ----
  function press(k) {
    ensure(); const s = STAGES[S.st];
    if (S.done) return;
    const target = hOf(k);
    if (target > S.h + 2) { S.vy = Math.sqrt(2 * G * (target - S.h)); S.air = true; }
    else if (S.vy > 0) S.vy = 0;
    sndJump(k);
  }
  document.addEventListener('keydown', (e) => { if (e.key >= '1' && e.key <= '8') press(+e.key - 1); });

  // ---- ぷにまる ----
  function drawPuni(x, feetY, k) {
    const sy0 = S.air ? 1 + Math.min(0.16, Math.abs(S.vy) / (G * 0.7) * 0.16) : 1, lz = S.land > 0 ? S.land / 0.18 : 0;
    const sy = sy0 * (1 - 0.2 * lz), sx = (1 / sy0) * (1 + 0.22 * lz);
    g.save(); g.translate(x, feetY); g.scale(k * sx, k * sy); g.translate(0, -59);
    const body = '#b79cff', line = '#8f72e6', light = '#d8c8ff', run = S.air ? 0 : Math.sin(S.t * 12);
    g.lineWidth = 3.5; g.lineJoin = 'round'; g.strokeStyle = line; g.fillStyle = body;
    [[-12, 52 - (S.air ? 4 : Math.max(0, run) * 5)], [12, 52 - (S.air ? 4 : Math.max(0, -run) * 5)]].forEach(([px, py]) => { g.beginPath(); g.ellipse(px, py, 11, 7, 0, 0, 7); g.fill(); g.stroke(); });
    g.beginPath(); g.ellipse(0, 30, 27, 24, 0, 0, 7); g.fill(); g.stroke();
    g.fillStyle = light; g.beginPath(); g.ellipse(0, 34, 15, 14, 0, 0, 7); g.fill(); g.fillStyle = body;
    const up = S.air || S.cheer > 0, ay = up ? -4 + (S.cheer > 0 ? 6 * Math.sin(S.t * 16) : 0) : 30 + run * 2;
    [-1, 1].forEach((s) => { g.beginPath(); g.ellipse(s * 29, ay, 8, 11, s * (up ? -0.9 : 0.5), 0, 7); g.fill(); g.stroke(); });
    g.beginPath(); g.arc(0, -8, 37, 0, 7); g.fill(); g.stroke();
    g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.ellipse(-18, -28, 9, 5, -0.6, 0, 7); g.fill();
    g.strokeStyle = '#4caf50'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, -44); g.quadraticCurveTo(-2, -54, 5, -58); g.stroke();
    g.fillStyle = '#6fd36f'; g.beginPath(); g.ellipse(9, -58, 8, 4, -0.5, 0, 7); g.fill();
    const bl = S.blink > 0 ? 0.15 : 1;
    [-14, 14].forEach((px) => { g.fillStyle = '#fff'; g.beginPath(); g.ellipse(px, -10, 8.5, 9 * bl, 0, 0, 7); g.fill(); g.fillStyle = '#2b2150'; g.beginPath(); g.ellipse(px + 3, -8, 4.5, 5 * bl, 0, 0, 7); g.fill(); if (bl > 0.5) { g.fillStyle = '#fff'; g.beginPath(); g.arc(px + 1.5, -10, 1.6, 0, 7); g.fill(); } });
    g.fillStyle = 'rgba(255,120,150,.5)'; [-26, 26].forEach((px) => { g.beginPath(); g.ellipse(px, 4, 7, 4.5, 0, 0, 7); g.fill(); });
    g.strokeStyle = '#7a2b3b'; g.lineWidth = 3; g.lineCap = 'round'; g.beginPath();
    if (S.air || S.cheer > 0) g.ellipse(0, 9, 7, 6, 0, 0, 7); else g.arc(0, 6, 7, 0.2, Math.PI - 0.2);
    g.stroke(); g.restore();
  }
  function drawGem(x, y, r, col, rot, label, glow) {
    g.save(); g.translate(x, y); g.rotate(rot || 0);
    if (glow) { g.shadowColor = col; g.shadowBlur = 18 * glow; }
    const poly = (pts) => { g.beginPath(); pts.forEach((q, i) => { const a = q[0] * r, b = q[1] * r; i ? g.lineTo(a, b) : g.moveTo(a, b); }); g.closePath(); };
    const o = [[-0.78, -0.5], [-0.4, -1], [0.4, -1], [0.78, -0.5], [0, 1.05]];
    poly(o); g.fillStyle = col; g.fill(); g.shadowBlur = 0;
    poly([[-0.4, -1], [0.4, -1], [0.78, -0.5], [-0.78, -0.5]]); g.fillStyle = 'rgba(255,255,255,.45)'; g.fill();
    poly([[0, -0.5], [0.78, -0.5], [0, 1.05]]); g.fillStyle = 'rgba(0,0,0,.14)'; g.fill();
    poly(o); g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = Math.max(1.5, r * 0.09); g.lineJoin = 'round'; g.stroke();
    g.restore();
    if (label) { g.fillStyle = 'rgba(255,255,255,.97)'; g.font = 'bold ' + Math.round(r * 0.6) + 'px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.shadowColor = 'rgba(0,0,0,.4)'; g.shadowBlur = 3; g.fillText(label, x, y + r * 0.1); g.shadowBlur = 0; }
  }
  function sparks(x, y, col, n, sp) { for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, v = (sp || 1) * (60 + Math.random() * 160) * U; S.sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 50 * U, life: 0.6 + Math.random() * 0.4, col }); } }

  // ---- こうしん ----
  const bodyY = (h) => groundY - h - 49 * kC;                              // からだの まんなかの たかさ(ほうせきも おなじ ばしょ)
  function update(dt) {
    S.t += dt; S.blink -= dt; if (Math.random() < dt * 0.4) S.blink = 0.12;
    if (S.cheer > 0) S.cheer -= dt; if (S.land > 0) S.land -= dt; if (S.banner > 0) S.banner -= dt;
    // じゃんぷ
    if (S.air) {
      S.vy -= G * dt; S.h += S.vy * dt;
      if (S.h <= 0) { S.h = 0; S.vy = 0; S.air = false; S.land = 0.18; }
    }
    const s = STAGES[S.st];
    // ほうせきの てまえで とまって まつ
    const nextG = S.gems.find((q) => !q.got);
    if (!S.done) {
      let mv = 105 * U * dt;
      if (nextG) { const room = nextG.wx - S.x - 4 * U; mv = Math.max(0, Math.min(mv, room)); S.wait = mv === 0 ? S.wait + dt : 0; }
      else { const room = S.finishX - 118 * U - S.x; mv = Math.max(0, Math.min(mv, room)); if (mv === 0) finish(); }
      S.x += mv;
    }
    // とれたか
    const vyTol = 0.5 * Math.sqrt(2 * G * SP);
    S.gems.forEach((q) => {
      if (q.got) return;
      const dx = cx + (q.wx - S.x) - cx, dh = S.h - hOf(q.k);
      if (Math.abs(dx) < 44 * U && Math.abs(dh) < 0.48 * SP && Math.abs(S.vy) < vyTol) {
        q.got = true; S.got++; S.cheer = 0.7; hud(); sndGet(q.k);
        const gx = cx + (q.wx - S.x), gy = bodyY(hOf(q.k)); sparks(gx, gy, NOTES[q.k][1], 22, 1.1); S.pops.push({ x: gx, y: gy, txt: NOTES[q.k][0], col: NOTES[q.k][1], life: 0.9 });
      }
    });
    // ヒント
    const nk = nextG && !S.done ? nextG.k : -1, show = nk >= 0 && (s.hint === 0 || S.wait > s.hint);
    const hk = show ? nk : -1;
    if (hk !== S.hintK) { keyBtns.forEach((b, k) => b.classList.toggle('hint', k === hk)); S.hintK = hk; }
    S.sparks.forEach((p) => { p.vy += 500 * U * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; }); S.sparks = S.sparks.filter((p) => p.life > 0);
    S.pops.forEach((p) => { p.y -= 40 * U * dt; p.life -= dt; }); S.pops = S.pops.filter((p) => p.life > 0);
    S.conf.forEach((p) => { p.vy += 260 * U * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.r += dt * 6; }); S.conf = S.conf.filter((p) => p.y < H + 20);
  }
  function finish() {
    if (S.done) return; S.done = 1; S.cheer = 99; S.vy = 0;
    const all = S.got === S.gems.length; sndClear(all);
    for (let i = 0; i < 80; i++) S.conf.push({ x: Math.random() * W, y: -Math.random() * H * 0.6, vx: (Math.random() - 0.5) * 80 * U, vy: 40 * U + Math.random() * 120 * U, col: NOTES[i % 8][1], r: Math.random() * 6 });
    if (!cleared.includes(S.st)) { cleared.push(S.st); try { localStorage.setItem('gemland.cleared', JSON.stringify(cleared)); } catch (e) { /* ほぞん できない たんまつ */ } }
    paintStages();
    $('clT').textContent = S.st === STAGES.length - 1 ? 'ぜんぶ クリア!' : 'ステージクリア!';
    $('clS').textContent = '💎 ' + S.got + ' こ ゲット!';
    $('clNext').style.display = S.st === STAGES.length - 1 ? 'none' : '';
    setTimeout(() => { if (S.done) $('clear').classList.add('show'); }, 1400);
  }

  // ---- え ----
  function draw() {
    // ---- どうくつ(いわの かべ・つらら・いしだたみの ゆか・あかりの ついた きの はしら) ----
    const hash = (n) => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
    const wall = g.createLinearGradient(0, 0, 0, groundY); wall.addColorStop(0, '#2a211d'); wall.addColorStop(1, '#5a4636'); g.fillStyle = wall; g.fillRect(0, 0, W, H);
    // いわの かべ(ごつごつした いわを ならべる。おくは ゆっくり うごく)
    [[0.2, 90, 0.07, 60], [0.4, 60, 0.12, 45]].forEach(([par, sz, al, seed], li) => {
      for (let i = -1; i < W / (sz * U) + 2; i++) for (let r = 0; r < Math.ceil(groundY / (sz * 0.8 * U)); r++) {
        const idx = i + Math.floor(S.x * par / (sz * U)), hh = hash(idx * 7 + r * 13 + seed), x = i * sz * U - ((S.x * par) % (sz * U)) + (r % 2) * sz * 0.5 * U, y = r * sz * 0.8 * U;
        g.fillStyle = 'rgba(' + (hh > 0.5 ? '255,235,210' : '0,0,0') + ',' + (al * (0.4 + hh)) + ')';
        g.beginPath(); g.moveTo(x + 4, y + 6); g.lineTo(x + sz * U * 0.8, y + 2); g.lineTo(x + sz * U * 0.95, y + sz * 0.6 * U); g.lineTo(x + sz * U * 0.4, y + sz * 0.78 * U); g.lineTo(x + 2, y + sz * 0.5 * U); g.closePath(); g.fill();
      }
    });
    // おくの いしじゅう(せきじゅん) — ゆかから のびる
    g.fillStyle = '#3b2e27';
    for (let i = -1; i < W / (120 * U) + 2; i++) {
      const idx = i + Math.floor(S.x * 0.45 / (120 * U)), hh = hash(idx * 3.3), x = i * 120 * U - ((S.x * 0.45) % (120 * U)) + 30 * U, hgt = (40 + hh * 70) * U, wd = (16 + hh * 16) * U;
      g.beginPath(); g.moveTo(x - wd, groundY); g.lineTo(x, groundY - hgt); g.lineTo(x + wd, groundY); g.closePath(); g.fill();
    }
    // かべに うまった けっしょう(ひかる)
    for (let i = 0; i < 9; i++) {
      const gap = 150 * U, idx = Math.floor((S.x * 0.6) / gap), k = idx + i - 1, x = k * gap - S.x * 0.6 + hash(k) * 90 * U + 40 * U, y = (70 + hash(k + 9) * 180) * U;
      if (y > groundY - 40 * U || x < -40 || x > W + 40) continue;
      const c = NOTES[Math.floor(hash(k + 3) * 8)][1], tw = 0.7 + 0.3 * Math.sin(S.t * 2 + k);
      g.save(); g.translate(x, y); g.shadowColor = c; g.shadowBlur = 16 * tw; g.fillStyle = c;
      [[-9, 4, -0.5, 18], [0, 0, 0, 26], [9, 5, 0.5, 16]].forEach(([dx, dy, rot, hh2]) => { g.save(); g.translate(dx * U, dy * U); g.rotate(rot); g.beginPath(); g.moveTo(-5 * U, 6 * U); g.lineTo(0, -hh2 * U); g.lineTo(5 * U, 6 * U); g.closePath(); g.fill(); g.restore(); });
      g.shadowBlur = 0; g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.moveTo(-2 * U, 4 * U); g.lineTo(0, -22 * U); g.lineTo(1 * U, 4 * U); g.fill(); g.restore();
    }
    // てんじょうの つらら(おおきい)
    for (const [par, col, big] of [[0.5, '#3a2d27', 0.8], [1, '#4a3a31', 1]]) {
      g.fillStyle = col; g.beginPath(); g.moveTo(-60, -2);
      for (let k = -2; k < W / (46 * U) + 3; k++) { const idx = k + Math.floor(S.x * par / (46 * U)), hh = hash(idx * 2.1 + par * 10), x = k * 46 * U - ((S.x * par) % (46 * U)), len = (14 + hh * hh * 90) * U * big; g.lineTo(x, -2); g.lineTo(x + 23 * U, len); g.lineTo(x + 46 * U, -2); }
      g.lineTo(W + 60, -2); g.closePath(); g.fill();
    }
    // ゆか(ごつごつした いわ。ふちは でこぼこ)
    g.fillStyle = '#6e5a49'; g.fillRect(0, groundY + 6 * U, W, H - groundY);
    g.fillStyle = '#8a7360'; g.beginPath(); g.moveTo(0, groundY + 10 * U);
    for (let x = 0; x <= W + 16; x += 14) { const idx = Math.floor((x + S.x) / 14); g.lineTo(x, groundY + (hash(idx * 1.7) * 6 - 1) * U); }
    g.lineTo(W, groundY + 12 * U); g.closePath(); g.fill();
    for (let i = -1; i < W / (90 * U) + 2; i++) {                               // ゆかの いし(こいし)
      const idx = i + Math.floor(S.x / (90 * U)), hh = hash(idx * 5.5), x = i * 90 * U - (S.x % (90 * U)) + hh * 40 * U, y = groundY + (14 + hh * 22) * U, r = (4 + hh * 7) * U;
      g.fillStyle = hh > 0.5 ? 'rgba(60,44,34,.55)' : 'rgba(170,148,124,.45)'; g.beginPath(); g.ellipse(x, y, r * 1.5, r, 0, 0, 7); g.fill();
    }
    for (let i = -1; i < W / (140 * U) + 2; i++) {                               // ゆかに ころがる ほうせき
      const idx = i + Math.floor(S.x / (140 * U)), x = i * 140 * U - (S.x % (140 * U)) + 30 * U, c = NOTES[((idx % 8) + 8) % 8][1];
      g.fillStyle = c; g.globalAlpha = 0.9; g.beginPath(); g.moveTo(x, groundY + 30 * U); g.lineTo(x + 7 * U, groundY + 22 * U); g.lineTo(x + 14 * U, groundY + 30 * U); g.lineTo(x + 7 * U, groundY + 39 * U); g.fill(); g.globalAlpha = 1;
    }
    // ふちを くらく(どうくつの おくゆき)
    const vg = g.createRadialGradient(W / 2, H * 0.55, Math.min(W, H) * 0.35, W / 2, H * 0.55, Math.max(W, H) * 0.8); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.5)'); g.fillStyle = vg; g.fillRect(0, 0, W, H);
    // ゴール: どうくつの でぐち(ひかりが さしこむ アーチ)
    const fx = cx + (S.finishX - S.x);
    if (fx < W + 200 * U) {
      const ax = fx + 60 * U, aw = 56 * U, ah = 130 * U, light = g.createRadialGradient(ax, groundY - 60 * U, 6, ax, groundY - 60 * U, 120 * U * (S.done ? 1.4 : 1));
      light.addColorStop(0, 'rgba(255,244,190,.95)'); light.addColorStop(1, 'rgba(255,244,190,0)'); g.fillStyle = light; g.fillRect(ax - 140 * U, groundY - 200 * U, 280 * U, 200 * U);
      g.fillStyle = '#fff6c8'; g.beginPath(); g.moveTo(ax - aw, groundY);
      for (let k = 0; k <= 12; k++) { const t = k / 12, ang = Math.PI * (1 - t), rr = aw * (1 + 0.14 * Math.sin(k * 2.7)); g.lineTo(ax + Math.cos(ang) * rr, groundY - ah + aw - Math.sin(ang) * (ah - aw + 10 * U) * (0.92 + 0.08 * Math.cos(k * 1.9))); }
      g.lineTo(ax + aw, groundY); g.closePath(); g.fill();
      g.strokeStyle = '#2f241e'; g.lineWidth = 14 * U; g.lineJoin = 'round'; g.beginPath(); g.moveTo(ax - aw - 7 * U, groundY);
      for (let k = 0; k <= 12; k++) { const t = k / 12, ang = Math.PI * (1 - t), rr = (aw + 7 * U) * (1 + 0.14 * Math.sin(k * 2.7)); g.lineTo(ax + Math.cos(ang) * rr, groundY - ah + aw - Math.sin(ang) * (ah - aw + 14 * U) * (0.92 + 0.08 * Math.cos(k * 1.9))); }
      g.lineTo(ax + aw + 7 * U, groundY); g.stroke();
      drawGem(ax, groundY - ah - 16 * U, 14 * U, '#ff6fb5', Math.sin(S.t * 2) * 0.15, '', S.done ? 1 : 0.5);
    }
    // ほうせき
    const nextG = S.gems.find((q) => !q.got);
    S.gems.forEach((q) => {
      if (q.got) return; const x = cx + (q.wx - S.x); if (x < -40 || x > W + 40) return;
      const y = bodyY(hOf(q.k)) + Math.sin(S.t * 3 + q.t) * 3 * U, r = 17 * U, isNext = q === nextG;
      if (isNext) { g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 3; g.setLineDash([5, 5]); g.beginPath(); g.arc(x, y, r * 1.5 + Math.sin(S.t * 6) * 2, 0, 7); g.stroke(); g.setLineDash([]); }
      drawGem(x, y, r, NOTES[q.k][1], Math.sin(S.t * 2 + q.t) * 0.12, NOTES[q.k][0], isNext ? 1.3 : 0.7);
    });
    // ぷにまる(かげ→からだ)
    g.fillStyle = 'rgba(0,0,0,.12)'; g.beginPath(); g.ellipse(cx, groundY + 3 * U, (24 - Math.min(10, S.h / (SP * 0.6) * 3)) * U, 6 * U, 0, 0, 7); g.fill();
    drawPuni(cx, groundY - S.h, kC);
    S.sparks.forEach((p) => { g.globalAlpha = Math.max(0, Math.min(1, p.life * 2)); g.fillStyle = p.col; g.beginPath(); g.arc(p.x, p.y, 3.5 * U, 0, 7); g.fill(); }); g.globalAlpha = 1;
    S.pops.forEach((p) => { g.globalAlpha = Math.min(1, p.life * 2); g.fillStyle = p.col; g.font = 'bold ' + Math.round(26 * U) + 'px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 4; g.strokeStyle = '#fff'; g.strokeText(p.txt, p.x, p.y - 26 * U); g.fillText(p.txt, p.x, p.y - 26 * U); }); g.globalAlpha = 1;
    S.conf.forEach((p) => { g.fillStyle = p.col; g.save(); g.translate(p.x, p.y); g.rotate(p.r); g.fillRect(-4, -2, 8, 4); g.restore(); });
    if (S.banner > 0 && !S.done) { g.globalAlpha = Math.min(1, S.banner); g.fillStyle = 'rgba(255,255,255,.88)'; const bw = Math.min(W - 24, 330 * U), bh = 48 * U; g.beginPath(); g.roundRect ? g.roundRect((W - bw) / 2, 12 * U, bw, bh, 14) : g.rect((W - bw) / 2, 12 * U, bw, bh); g.fill(); g.fillStyle = '#5a4fcf'; g.font = 'bold ' + Math.round(15 * U) + 'px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(S.st < 2 ? 'ひかっている いろの ボタンを おしてね' : STAGES[S.st].name + (S.st >= 3 ? ' を ひいてみよう' : ''), W / 2, 12 * U + bh / 2); g.globalAlpha = 1; }
  }
  let last = performance.now();
  function frame(now) { const dt = Math.min(0.033, (now - last) / 1000); last = now; update(dt); draw(); requestAnimationFrame(frame); }

  $('again0').addEventListener('click', () => loadStage(S.st));
  $('clAgain').addEventListener('click', () => loadStage(S.st));
  $('clNext').addEventListener('click', () => loadStage(Math.min(STAGES.length - 1, S.st + 1)));
  layout(); loadStage(0); requestAnimationFrame(frame);
  window.__gl = { S, STAGES, press, loadStage, hOf };
})();
