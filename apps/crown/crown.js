// クリスタルの おうかん: ぷにまるが じどうで はしる。ジャンプだけで、クリスタルを 12こ あつめると、おうかんが かんせい
(() => {
  const $ = (id) => document.getElementById(id);
  const COLS = ['#ff6b6b', '#ff9f43', '#f2c200', '#4cc77a', '#26b5e8', '#5b7cff', '#9b6bff', '#ff6fb5'];
  const C_MAJ = [0, 2, 4, 5, 7, 9, 11];
  const KANA = ['いち', 'に', 'さん', 'よん', 'ご', 'ろく', 'なな', 'はち', 'きゅう', 'じゅう', 'じゅういち', 'じゅうに'];
  const GOAL = 12;
  const cv = $('gc'), g = cv.getContext('2d');
  let W = 320, H = 400, U = 1, groundY = 340, cx = 90;
  const S = { x: 0, h: 0, vy: 0, air: false, held: false, holdT: 0, t: 0, got: 0, items: [], gen: 0, gi: 0, stun: 0, blink: 0, land: 0, cheer: 0, done: 0, fin: 0, sparks: [], pops: [], conf: [], hint: 6 };
  const P = { speed: 95, v0: 640, v2: 560, vs: 704, vstomp: 520, G: 1500, holdG: 0.45, holdMax: 0.28 };      // ぜんぶ U(がめんの おおきさ)ばいで つかう
  let voiceOn = true;
  try { voiceOn = localStorage.getItem('crown.voice') !== '0'; } catch (e) { /* ignore */ }

  // ---- おんせい ----
  let ctx = null, out = null;
  function ensure() {
    if (!ctx) { ctx = new (window.AudioContext || window.webkitAudioContext)(); out = ctx.createGain(); out.gain.value = 0.3; out.connect(ctx.destination); }
    if (ctx.state !== 'running' && ctx.state !== 'closed') { const p = ctx.resume(); if (p && p.catch) p.catch(() => {}); }
  }
  ['pointerdown', 'touchend', 'keydown'].forEach((ev) => document.addEventListener(ev, () => { if (ctx) ensure(); }, { passive: true, capture: true }));
  document.addEventListener('visibilitychange', () => { if (!document.hidden && ctx) ensure(); });
  function tone(f, t, dur, vol, f2) {
    const o = ctx.createOscillator(), o2 = ctx.createOscillator(), a = ctx.createGain(), b = ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur * 0.8);
    o2.type = 'sine'; o2.frequency.setValueAtTime(f * 2, t); if (f2) o2.frequency.exponentialRampToValueAtTime(f2 * 2, t + dur * 0.8); b.gain.value = 0.22;
    a.gain.setValueAtTime(0.0001, t); a.gain.exponentialRampToValueAtTime(vol, t + 0.012); a.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(a); o2.connect(b); b.connect(a); a.connect(out); o.start(t); o2.start(t); o.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
  }
  const degHz = (d) => 261.63 * Math.pow(2, (C_MAJ[d % 7] + 12 * Math.floor(d / 7)) / 12);
  function sndJump() { ensure(); tone(420, ctx.currentTime + 0.01, 0.16, 0.12, 760); }
  function sndJump2() { ensure(); tone(620, ctx.currentTime + 0.01, 0.16, 0.12, 1180); }
  function sndSpring() { ensure(); const t = ctx.currentTime + 0.01; tone(300, t, 0.3, 0.18, 1000); tone(600, t + 0.05, 0.25, 0.1, 1500); }
  function sndStomp() { ensure(); const t = ctx.currentTime + 0.01; tone(700, t, 0.12, 0.2, 350); tone(1050, t + 0.07, 0.2, 0.18, 1400); }
  function sndHeart() { ensure(); const t = ctx.currentTime + 0.01; [0, 4, 7].forEach((d, i) => tone(degHz(d + 7), t + i * 0.08, 0.4, 0.2)); }
  function sndGem(n) { ensure(); const t = ctx.currentTime + 0.01; tone(degHz(n - 1), t, 0.7, 0.34); tone(degHz(n - 1) * 2, t + 0.05, 0.4, 0.1); }
  function sndPoyon() { ensure(); const t = ctx.currentTime + 0.01; tone(520, t, 0.28, 0.22, 200); tone(300, t + 0.1, 0.2, 0.14, 480); }
  function sndCrown() {
    ensure(); const t = ctx.currentTime + 0.05;
    [0, 2, 4, 7, 9, 11, 14].forEach((d, i) => tone(degHz(d), t + i * 0.1, 0.5, 0.26));
    [0, 4, 7, 14].forEach((d, i) => tone(degHz(d + 7), t + 0.85, 1.8, i === 0 ? 0.34 : 0.18));
  }
  function say(txt) {
    if (!voiceOn || !window.speechSynthesis) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(txt); u.lang = 'ja-JP'; u.rate = 1.0; u.pitch = 1.15;
      const v = speechSynthesis.getVoices().find((x) => /^ja/i.test(x.lang)); if (v) u.voice = v;
      speechSynthesis.speak(u);
    } catch (e) { /* ignore */ }
  }
  $('snd').textContent = voiceOn ? '🔊' : '🔇';
  $('snd').addEventListener('click', () => {
    voiceOn = !voiceOn; $('snd').textContent = voiceOn ? '🔊' : '🔇';
    try { localStorage.setItem('crown.voice', voiceOn ? '1' : '0'); } catch (e) { /* ignore */ }
    if (!voiceOn && window.speechSynthesis) speechSynthesis.cancel();
  });

  // ---- がめん ----
  function layout() {
    const r = cv.parentNode.getBoundingClientRect(), dpr = devicePixelRatio || 1;
    W = Math.max(200, Math.round(r.width)); H = Math.max(200, Math.round(r.height));
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    U = H / 440; groundY = H - 46 * U; cx = W * 0.27;
  }
  window.addEventListener('resize', layout);
  if (window.ResizeObserver) new ResizeObserver(layout).observe(cv.parentNode);

  // ---- ゲーム ----
  const hashr = (n) => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
  const HP = 3;
  const GAP = 170;
  // ステージ: 1=ジャンプと いわ / 2=ばねだい / 3=コウモリ・ダブルジャンプ。ならびは きまっていて、12こに とどくまで くりかえす
  const STAGES = [
    { name: 'はじめての どうくつ', tip: 'ジャンプで クリスタルを とろう', seq: ['one', 'one', 'rockArc', 'one', 'rockArc', 'rocks2', 'rockArc', 'one', 'rockArc'] },
    { name: 'ばねの どうくつ', tip: 'ばねに のると たかく とべるよ', seq: ['one', 'spring', 'rockArc', 'spring', 'rocks2', 'rockArc', 'spring', 'rocks2'] },
    { name: 'コウモリの どうくつ', tip: 'コウモリは したを くぐろう。そらで もういちど おすと 2かい とべるよ', seq: ['one', 'batRun', 'spring', 'rockArc', 'batRun', 'stair', 'rocks2', 'spring', 'stair'] }
  ];
  let stage = 0, cleared = [];
  try { cleared = JSON.parse(localStorage.getItem('crown.cleared') || '[]'); } catch (e) { cleared = []; }
  function reset() {
    Object.assign(S, { x: 0, h: 0, vy: 0, air: false, held: false, holdT: 0, jumps: 0, got: 0, gotT: 9, hp: HP, inv: 0, over: 0, items: [], pi: 0, gi: 0, stun: 0, land: 0, cheer: 0, done: 0, fin: 0, sparks: [], pops: [], conf: [], hint: 6, tip: 0, tipTxt: '' });
    S.gen = W * 0.8; $('clear').classList.remove('show'); $('clNext').style.display = 'none'; paintStages(); if (stage > 0 || true) showTip(STAGES[stage].tip, 6);
    $('clT').textContent = 'おうかんが できた!'; $('clS').textContent = 'クリスタルを 12こ あつめたよ';
    if (window.speechSynthesis) speechSynthesis.cancel();
  }
  const stgEl = $('stg'), stgBtns = [];
  STAGES.forEach((st, i) => { const b = document.createElement('button'); b.type = 'button'; b.addEventListener('click', () => { stage = i; reset(); }); stgEl.appendChild(b); stgBtns.push(b); });
  function paintStages() { stgBtns.forEach((b, i) => { b.textContent = (cleared.includes(i) ? '★' : '') + (i + 1); b.classList.toggle('sel', i === stage); b.setAttribute('aria-label', 'ステージ' + (i + 1) + ' ' + STAGES[i].name); }); }
  // ---- ならびかた(パターン)。どれも「かわしながら ぜんぶ とれる」ように きめてある ----
  const gem = (x, dx, h) => { S.items.push({ type: 'gem', wx: x + dx * U, h: h * U, c: COLS[S.gi % 8], t: S.gi * 1.7 }); S.gi++; };
  const foe = (type, x, dx, h) => S.items.push({ type, wx: x + dx * U, h: h * U, t: dx, rot: 0 });
  const PATS = {
    one: (x) => { gem(x, 0, 28); return 60; },
    rockArc: (x) => { foe('rock', x, 45, 20); gem(x, 22, 123); gem(x, 45, 161); gem(x, 67, 124); return 110; },
    batRun: (x) => { foe('bat', x, 60, 125); gem(x, 60, 28); gem(x, 115, 28); return 150; },
    stair: (x) => { gem(x, 0, 150); gem(x, 60, 215); gem(x, 120, 150); return 150; },
    spring: (x) => { S.items.push({ type: 'spring', wx: x, h: 0, cd: 0 }); gem(x, 24, 154); gem(x, 45, 190); gem(x, 66, 150); return 100; },
    rocks2: (x) => { foe('rock', x, 0, 20); gem(x, 120, 28); foe('rock', x, 220, 20); return 240; }
  };
  function genAhead() {
    while (S.gen < S.x + W + 320 * U) {
      const i = S.pi++, sq = STAGES[stage].seq, name = sq[i % sq.length];
      if (i > 2 && S.hp < HP && i % 3 === 0) { S.items.push({ type: 'heart', wx: S.gen, h: 28 * U, t: i }); S.gen += 70 * U; }
      const len = PATS[name](S.gen);
      S.gen += (len + GAP + 25) * U;
    }
  }
  function jumpStart() {
    ensure(); S.held = true;
    if (S.done || S.over || S.stun > 0.3) return;
    if (!S.air) { S.vy = P.v0 * U; S.air = true; S.holdT = 0; S.jumps = 1; S.hint = 0; sndJump(); }
    else if (S.jumps < 2) { S.vy = P.v2 * U; S.jumps = 2; S.holdT = 9; S.hint = 0; sparks(cx, groundY - S.h - 5 * U, '#ffffff', 10, 0.6); sndJump2(); }
  }
  function jumpEnd() { S.held = false; }
  const jb = $('jump');
  jb.addEventListener('pointerdown', (e) => { e.preventDefault(); jb.classList.add('on'); jumpStart(); });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => jb.addEventListener(ev, () => { jb.classList.remove('on'); jumpEnd(); }));
  cv.addEventListener('pointerdown', (e) => { e.preventDefault(); jumpStart(); });
  ['pointerup', 'pointercancel'].forEach((ev) => cv.addEventListener(ev, jumpEnd));
  document.addEventListener('keydown', (e) => { if ((e.code === 'Space' || e.code === 'ArrowUp') && !e.repeat) { e.preventDefault(); jb.classList.add('on'); jumpStart(); } });
  document.addEventListener('keyup', (e) => { if (e.code === 'Space' || e.code === 'ArrowUp') { jb.classList.remove('on'); jumpEnd(); } });

  function sparks(x, y, col, n, v) { for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, s = (60 + Math.random() * 140) * U * (v || 1); S.sparks.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40 * U, life: 0.6 + Math.random() * 0.4, col }); } }
  function confetti() { for (let i = 0; i < 70; i++) S.conf.push({ x: Math.random() * W, y: -Math.random() * H * 0.5, vx: (Math.random() - 0.5) * 60 * U, vy: (60 + Math.random() * 120) * U, r: Math.random() * 6, vr: (Math.random() - 0.5) * 8, col: COLS[i % 8] }); }
  function showTip(txt, sec) { S.tip = sec || 5; S.tipTxt = txt; }

  function update(dt) {
    S.t += dt; S.gotT += dt; S.blink = S.blink > 0 ? S.blink - dt : (Math.random() < dt * 0.4 ? 0.12 : 0);
    if (S.land > 0) S.land -= dt; if (S.cheer > 0) S.cheer -= dt; if (S.inv > 0) S.inv -= dt; if (S.tip > 0) S.tip -= dt;
    if (S.air) {                                                              // ジャンプ(おしつづけると すこし たかく とぶ)
      let gg = P.G * U;
      if (S.held && S.vy > 0 && S.holdT < P.holdMax) { gg *= P.holdG; S.holdT += dt; }
      S.vy -= gg * dt; S.h += S.vy * dt;
      if (S.h <= 0) { S.h = 0; S.vy = 0; S.air = false; S.jumps = 0; S.land = 0.18; }
    }
    if (S.stun > 0) { S.stun -= dt; S.x -= (S.stun > 0.3 ? 110 : 0) * U * dt; } else if (S.over) { /* とまる */ } else if (!S.done) S.x += P.speed * U * dt;
    else S.x += P.speed * U * dt * Math.max(0, 1 - S.fin / 1.2);
    if (S.x < 0) S.x = 0;
    genAhead();
    const px = cx, py = groundY - S.h - 25 * U;
    for (const q of S.items) {
      if (q.gone) continue;
      const sx = cx + (q.wx - S.x);
      q.y = q.type === 'bat' ? groundY - q.h + Math.sin(S.t * 3 + q.t) * 22 * U : groundY - q.h;
      if (q.type === 'rock') q.rot = -S.x / (20 * U);
      if (q.cd > 0) q.cd -= dt;
      if (S.done || S.over) continue;
      const d = Math.hypot(px - sx, py - q.y);
      if (q.type === 'gem' && d < 40 * U) {
        q.gone = true; S.got++; S.gotT = 0; sparks(sx, q.y, q.c, 22, 1.1); sndGem(S.got); say(KANA[S.got - 1]);
        S.pops.push({ x: sx, y: q.y, txt: String(S.got), col: q.c, life: 0.9 }); S.cheer = 0.35;
        if (S.got === 6 && stage === 0) showTip('いわは うえから ふむと やっつけられるよ');
        if (S.got >= GOAL) { S.done = 1; S.fin = 0; S.cheer = 6; S.shown = 0; if (!cleared.includes(stage)) { cleared.push(stage); try { localStorage.setItem('crown.cleared', JSON.stringify(cleared)); } catch (e) { /* ignore */ } paintStages(); } setTimeout(() => { sndCrown(); confetti(); }, 700); }
      } else if (q.type === 'heart' && d < 40 * U) {
        q.gone = true; S.hp = Math.min(HP, S.hp + 1); sparks(sx, q.y, '#ff6b8a', 16, 0.9); sndHeart();
      } else if (q.type === 'spring') {
        if (q.cd <= 0 && Math.abs(px - sx) < 22 * U && S.h < 20 * U && S.vy <= 0) { S.vy = P.vs * U; S.air = true; S.jumps = 1; S.holdT = 9; q.cd = 0.6; q.boing = 0.3; sndSpring(); sparks(sx, groundY, '#ffd24a', 10, 0.6); }
        if (q.boing > 0) q.boing -= dt;
      } else if (q.type === 'bat' || q.type === 'rock') {
        const rr = q.type === 'bat' ? 30 : 34;
        if (d < rr * U) {
          if (S.vy < -40 * U && py < q.y - 4 * U) {                           // うえから ふんだ
            q.gone = true; S.vy = P.vstomp * U; S.jumps = 1; S.holdT = 9; S.air = true; sparks(sx, q.y, '#ffffff', 16, 0.9); sndStomp();
          } else if (S.inv <= 0) {                                              // あたった
            S.hp--; S.inv = 1.4; S.stun = 0.7; S.vy = 420 * U; S.air = true; S.jumps = 1; S.holdT = 9; sparks(sx, q.y, '#ffffff', 12, 0.7); sndPoyon(); q.gone = true;
            if (S.hp <= 0) { S.over = 1; S.fin = 0; $('clT').textContent = 'あれれ…'; $('clS').textContent = 'ハートが なくなっちゃった'; setTimeout(() => { if (S.over) { $('clear').classList.add('show'); say('もういちど'); } }, 900); }
          }
        }
      }
    }
    S.items = S.items.filter((q) => !q.gone && cx + (q.wx - S.x) > -60 * U);
    if (S.done) { S.fin += dt; if (S.fin > 3.2 && !S.shown) { S.shown = 1; $('clear').classList.add('show'); $('clNext').style.display = stage < STAGES.length - 1 ? '' : 'none'; $('clS').textContent = stage < STAGES.length - 1 ? 'クリスタルを 12こ あつめたよ' : 'ぜんぶの どうくつを クリア!'; } }
    S.sparks.forEach((p) => { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 300 * U * dt; p.life -= dt; }); S.sparks = S.sparks.filter((p) => p.life > 0);
    S.pops.forEach((p) => { p.y -= 40 * U * dt; p.life -= dt; }); S.pops = S.pops.filter((p) => p.life > 0);
    S.conf.forEach((p) => { p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.vr * dt; }); S.conf = S.conf.filter((p) => p.y < H + 20);
  }

  // ---- え ----
  function drawGem(x, y, r, col, rot, glow) {
    g.save(); g.translate(x, y); g.rotate(rot || 0);
    if (glow) { g.shadowColor = col; g.shadowBlur = 18 * glow; }
    const poly = (pts) => { g.beginPath(); pts.forEach((q, i) => { const a = q[0] * r, b = q[1] * r; i ? g.lineTo(a, b) : g.moveTo(a, b); }); g.closePath(); };
    const o = [[-0.78, -0.5], [-0.4, -1], [0.4, -1], [0.78, -0.5], [0, 1.05]];
    poly(o); g.fillStyle = col; g.fill(); g.shadowBlur = 0;
    poly([[-0.4, -1], [0.4, -1], [0.78, -0.5], [-0.78, -0.5]]); g.fillStyle = 'rgba(255,255,255,.45)'; g.fill();
    poly([[0, -0.5], [0.78, -0.5], [0, 1.05]]); g.fillStyle = 'rgba(0,0,0,.14)'; g.fill();
    poly(o); g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = Math.max(1.5, r * 0.09); g.lineJoin = 'round'; g.stroke();
    g.restore();
  }
  function drawPuni(x, feetY, k) {
    const sy0 = S.air ? 1 + Math.min(0.16, Math.abs(S.vy) / (P.G * U * 0.7) * 0.16) : 1, lz = S.land > 0 ? S.land / 0.18 : 0;
    const sy = sy0 * (1 - 0.2 * lz), sx = (1 / sy0) * (1 + 0.22 * lz);
    if ((S.stun > 0 || S.inv > 0) && Math.floor(S.t * 20) % 2) g.globalAlpha = 0.55;
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
    [-14, 14].forEach((px) => { g.fillStyle = '#fff'; g.beginPath(); g.ellipse(px, -10, 8.5, 9 * bl, 0, 0, 7); g.fill(); g.fillStyle = '#2b2150'; g.beginPath(); g.ellipse(px + 3, -8, 4.5, 5 * bl, 0, 0, 7); g.fill(); });
    g.fillStyle = 'rgba(255,120,150,.5)'; [-26, 26].forEach((px) => { g.beginPath(); g.ellipse(px, 4, 7, 4.5, 0, 0, 7); g.fill(); });
    g.strokeStyle = '#7a2b3b'; g.lineWidth = 3; g.lineCap = 'round'; g.beginPath();
    if (S.air || S.cheer > 0) g.ellipse(0, 9, 7, 6, 0, 0, 7); else g.arc(0, 6, 7, 0.2, Math.PI - 0.2);
    g.stroke(); g.restore(); g.globalAlpha = 1;
  }
  function drawBat(x, y, u) {
    const fl = Math.sin(S.t * 14 + x * 0.05);
    g.save(); g.translate(x, y); g.scale(u, u);
    g.fillStyle = '#6b4a8a'; g.strokeStyle = '#3f2a57'; g.lineWidth = 3; g.lineJoin = 'round';
    [-1, 1].forEach((s) => { g.beginPath(); g.moveTo(s * 10, 0); g.quadraticCurveTo(s * 30, -26 - fl * 14, s * 46, -6 - fl * 8); g.quadraticCurveTo(s * 38, 4, s * 32, 8); g.quadraticCurveTo(s * 24, 0, s * 18, 10); g.quadraticCurveTo(s * 12, 8, s * 10, 12); g.closePath(); g.fill(); g.stroke(); });
    g.beginPath(); g.ellipse(0, 2, 15, 17, 0, 0, 7); g.fill(); g.stroke();
    [-1, 1].forEach((s) => { g.beginPath(); g.moveTo(s * 5, -13); g.lineTo(s * 12, -26); g.lineTo(s * 14, -10); g.closePath(); g.fill(); g.stroke(); });
    g.fillStyle = '#fff'; [-6, 6].forEach((px) => { g.beginPath(); g.ellipse(px, -2, 4.5, 5.5, 0, 0, 7); g.fill(); });
    g.fillStyle = '#2b2150'; [-5, 7].forEach((px) => { g.beginPath(); g.arc(px, -1, 2.4, 0, 7); g.fill(); });
    g.restore();
  }
  function drawRock(x, y, u, rot) {
    g.save(); g.translate(x, y); g.scale(u, u); g.rotate(rot);
    g.fillStyle = '#9a8f86'; g.strokeStyle = '#5f564f'; g.lineWidth = 3.5; g.lineJoin = 'round';
    g.beginPath(); for (let i = 0; i < 9; i++) { const a = i / 9 * 6.283, r = 21 + (i % 3) * 2.5; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.fill(); g.stroke();
    g.fillStyle = 'rgba(255,255,255,.28)'; g.beginPath(); g.ellipse(-7, -8, 7, 4, -0.6, 0, 7); g.fill();
    g.fillStyle = 'rgba(0,0,0,.2)'; [[6, 6, 4], [-8, 8, 3], [9, -6, 2.5]].forEach(([a, b, r]) => { g.beginPath(); g.arc(a, b, r, 0, 7); g.fill(); });
    g.restore();
  }
  // おうかん: 12この クリスタルの パーツ(したの おび 7こ + うえの とげ 5こ)。とるたびに 1こずつ ひかって はまる
  const PIECES = (() => {
    const a = [];
    for (let i = 0; i < 7; i++) { const x0 = -56 + i * 16; a.push({ band: 1, pts: [[x0 + 0.5, 47], [x0 + 15.5, 47], [x0 + 15.5, 70], [x0 + 0.5, 70]], x: x0 + 8, cy: 60 }); }
    [[-48, 16], [-24, 6], [0, -8], [24, 6], [48, 16]].forEach(([x, ty]) => a.push({ band: 0, pts: [[x - 12, 48], [x, ty], [x + 12, 48]], x, ty, cy: 34 }));
    return a;
  })();
  const pPath = (p) => { g.beginPath(); p.pts.forEach((q, i) => (i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]))); g.closePath(); };
  function star(x, y, r, a) {
    g.save(); g.translate(x, y); g.globalAlpha = a; g.fillStyle = '#fff'; g.shadowColor = '#fff'; g.shadowBlur = 6;
    [0, Math.PI / 2].forEach((rot) => { g.save(); g.rotate(rot); g.beginPath(); g.moveTo(0, -r); g.lineTo(r * 0.16, 0); g.lineTo(0, r); g.lineTo(-r * 0.16, 0); g.closePath(); g.fill(); g.restore(); });
    g.restore();
  }
  // おうかん: Noto Emoji(Apache-2.0)の おうかんの かたちを、クリスタルの いろに ぬりなおしたもの
  const CROWN_SVG = "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 128 128\"><defs>\n<linearGradient id=\"ice\" x1=\"0\" y1=\"0\" x2=\"1\" y2=\"1\"><stop offset=\"0\" stop-color=\"#f4fdff\"/><stop offset=\".3\" stop-color=\"#9fe3ff\"/><stop offset=\".6\" stop-color=\"#8fa4ff\"/><stop offset=\"1\" stop-color=\"#d9a8ff\"/></linearGradient>\n<linearGradient id=\"iceD\" x1=\"0\" y1=\"0\" x2=\"0\" y2=\"1\"><stop offset=\"0\" stop-color=\"#6fc8ff\"/><stop offset=\"1\" stop-color=\"#7a6cf0\"/></linearGradient>\n<linearGradient id=\"shine\" x1=\"0\" y1=\"0\" x2=\"1\" y2=\"0\"><stop offset=\"0\" stop-color=\"#fff\" stop-opacity=\"0\"/><stop offset=\".5\" stop-color=\"#fff\" stop-opacity=\".75\"/><stop offset=\"1\" stop-color=\"#fff\" stop-opacity=\"0\"/></linearGradient>\n</defs><path fill=\"url(#iceD)\" d=\"M94.52 21.81c2.44-1.18 4.13-3.67 4.13-6.56a7.28 7.28 0 0 0-14.56 0c0 2.93 1.73 5.44 4.22 6.6c-2.88 15.6-7.3 27.21-23.75 29.69c0 0 4.43 22.15 25.15 22.15s22.82-21.93 22.82-21.93c-16.81.86-18.23-20.27-18.01-29.95\"/><path fill=\"url(#iceD)\" d=\"M34.74 21.81c-2.44-1.18-4.13-3.67-4.13-6.56a7.28 7.28 0 0 1 14.56 0c0 2.93-1.73 5.44-4.22 6.6c2.88 15.6 7.3 27.21 23.75 29.69c0 0-4.43 22.15-25.15 22.15S16.74 51.77 16.74 51.77c16.8.85 18.22-20.28 18-29.96\"/><path fill=\"url(#ice)\" d=\"M89.43 73.69c.09 0 .18.01.27.01c5.71 0 10-1.67 13.22-4.08z\"/><path fill=\"url(#ice)\" d=\"M119.24 16.86c-3.33-.45-6.51 2.72-7.09 7.06c-.36 2.71.37 5.24 1.78 6.87l-2.4 9.95s-3.67 23.51-22.21 28.15C74.5 72.6 69.13 45.47 67.83 37.09c2.82-1.4 4.77-4.3 4.77-7.67c0-4.73-3.83-8.56-8.56-8.56s-8.56 3.83-8.56 8.56c0 3.39 1.98 6.32 4.85 7.7c-1.03 8.27-5.57 34.5-21.57 31.76c-16.24-2.79-23.33-30.14-24.97-37.58c1.95-1.6 3.04-4.42 2.64-7.45c-.58-4.35-4.02-7.47-7.68-6.98s-6.15 4.41-5.57 8.75c.42 3.16 2.36 5.67 4.79 6.62l12.72 79.03s11.1 8.77 43.35 8.77s43.35-8.77 43.35-8.77l12.75-79.24c2.06-1.08 3.68-3.51 4.08-6.49c.59-4.35-1.64-8.23-4.98-8.68\"/><ellipse cx=\"64.44\" cy=\"88.3\" fill=\"#ff6fb5\" rx=\"9.74\" ry=\"11.61\"/><path fill=\"#ffd6ec\" d=\"M64.44 79.56c.38.42.72 1.19 0 2.69s-4.6 3.53-5.31 3.94c-.71.42-1.18.23-1.4.06c-1.05-.84-.65-2.74.03-3.9c1.46-2.51 4.55-5.1 6.68-2.79\"/><path fill=\"#b0307a\" d=\"M63.72 92.63c-1.1.53-4.71 2.14-3.52 4.05c.7 1.13 2.15 1.61 3.48 1.67s2.64-.36 3.82-.97c5.6-2.9 6.05-10.52 4.96-11.1c-1.12-.6-1.88.95-2.46 1.61a20.3 20.3 0 0 1-6.28 4.74\"/><path fill=\"#ff6fb5\" d=\"M118.09 78.8c1.56-8.63-4.24-10.79-4.24-10.79s-3.74-.68-5.5 9.03c-1.76 9.7 1.98 10.38 1.98 10.38s6.19.01 7.76-8.62\"/><path fill=\"#ffd6ec\" d=\"M115.51 70.96c1.36 1.82-.25 4.51-2.86 6.3c-.77.53-1.79.33-1.94-.11c-.42-1.26-.24-2.69.32-3.9c1.66-3.63 3.79-3.21 4.48-2.29\"/><path fill=\"#ff6fb5\" d=\"M9.76 79.06C8.19 70.44 14 68.27 14 68.27s3.74-.68 5.5 9.03c1.76 9.7-1.98 10.38-1.98 10.38s-6.2.01-7.76-8.62\"/><path fill=\"#ffd6ec\" d=\"M15.78 71.2c1.34 1 .79 2.31-.22 3.22c-1.15 1.05-2.03 2.2-3.01 3.39c-.15.18-.32.38-.56.43c-.46.1-.83-.37-.98-.82c-.43-1.26-.35-2.74.29-3.9c1.82-3.31 3.96-2.71 4.48-2.32\"/><path fill=\"#5b7cff\" d=\"M99.99 87.16c-.69 3.93-3.84 6.66-7.05 6.1s-3.65-3.91-2.96-7.84s2.24-6.94 5.44-6.38c3.21.56 5.26 4.2 4.57 8.12m-69.56 0c.69 3.93 3.84 6.66 7.05 6.1s3.65-3.91 2.96-7.84s-2.24-6.94-5.44-6.38s-5.25 4.2-4.57 8.12\"/><path fill=\"#d6deff\" d=\"M35.08 84.54c-.73.82-2.51 2.47-3.14 1.21c-.86-1.72.33-4.32 1.69-5.18s2.47-.18 2.66.59c.23.98-.56 2.64-1.21 3.38m56.9 2.51c-.99-.15-1.1-3.56 1.56-6.24c1.27-1.28 3.09.24 2.63 2.29c-.44 1.95-2.38 4.23-4.19 3.95\"/><path fill=\"url(#ice)\" d=\"M109.15 98.21c-5.99 3-19.73 10.99-45.1 10.99s-39.11-7.99-45.1-10.99c0 0-2.15 1.15-2.15 2.35v9.21c0 1.23.65 2.36 1.71 2.99c4.68 2.76 18.94 9.28 45.55 9.28s40.87-6.52 45.55-9.28a3.48 3.48 0 0 0 1.71-2.99v-9.21c-.02-1.2-2.17-2.35-2.17-2.35\"/><path fill=\"#ffffff\" d=\"M39.6 110.84c2.8.55 3.65.79 3.46 2.35c-.39 3.07-6.76 2.34-10.53 1.35c-7.79-2.05-9.37-4.21-9.37-6.14c0-1.77 1.36-1.98 3.46-1.24c2.51.89 6.39 2.39 12.98 3.68\"/><path fill=\"none\" stroke=\"#7a8cff\" stroke-linecap=\"round\" stroke-miterlimit=\"10\" stroke-width=\"4\" d=\"M109.15 100.23s-16.57 9.38-45.1 9.38s-45.1-9.38-45.1-9.38\"/><path fill=\"url(#ice)\" d=\"M26.97 49.57c5.32-3.8 8.18-10.61 8.43-21.45c.02-.98.3-1.27.83-1.33c.85-.09.99.68.98 1.23c-.24 11.7-1.73 19.01-7.63 23.13c-.29.2-2.36 1.46-3.24.59c-1.05-1.02.29-1.93.63-2.17m4.87-34.03c-.17-1.81.25-5.07 5-6.55c1.39-.43 2.25.25 2.41.78c.4 1.32-.76 1.84-1.29 2.01c-3.65 1.18-3.83 3-4.58 4.16s-1.48.15-1.54-.4m46.38 31.63c4.81-4.27 8-9.04 10.1-19.9c.19-.96.47-1.22.99-1.2c.85.02.89.81.8 1.35c-1.78 11.58-3.47 14.88-9.4 21.45c-.67.74-2.3 1.41-3.22.64c-.83-.69.13-1.8.73-2.34m7.08-31.54c-.17-1.81.25-5.07 5-6.55c1.39-.43 2.25.25 2.41.78c.4 1.32-.76 1.84-1.29 2.01c-3.65 1.18-3.83 3-4.58 4.16c-.74 1.16-1.48.15-1.54-.4\"/><path fill=\"#ffffff\" d=\"M31.59 71.62C19.97 66.35 16.55 52.6 14.73 46.63c-.24-.79-.12-1.54.67-1.78s1.26.27 1.51 1.06c1.32 4.33 6.45 18.79 17.04 22.9c.77.3 1.97 1.03 1.32 2.28c-.43.81-1.81 1.38-3.68.53M12.68 24.63c-.56-1.16-.79-2.26-3.84-3.53c-.77-.32-1.28-1.03-1.07-1.83s1.01-1.4 2.17-1.2c3.77.65 4.59 4.48 4.75 5.81c.15 1.28-1.44 1.91-2.01.75m84.19 46.99c11.62-5.27 15.04-19.02 16.86-24.99c.24-.79.12-1.54-.67-1.78s-1.26.27-1.51 1.06c-1.32 4.33-6.45 18.79-17.04 22.9c-.77.3-1.97 1.03-1.32 2.28c.43.81 1.81 1.38 3.68.53m18.91-46.99c.56-1.16.79-2.26 3.84-3.53c.77-.32 1.28-1.03 1.07-1.83s-1.01-1.4-2.17-1.2c-3.77.65-4.59 4.48-4.75 5.81c-.15 1.28 1.45 1.91 2.01.75m-56.4 4.92c.61-1.25 1.68-2.96 5.17-3.68c1.34-.28 1.73-.86 1.61-1.74c-.24-1.83-2.52-1.7-3.75-1.41c-4.1.96-5.01 4.6-5.18 6.04c-.17 1.37 1.55 2.04 2.15.79\"/><path d=\"M60 22L72 22L50 118L38 118Z\" fill=\"url(#shine)\" opacity=\".5\"/></svg>";
  const CROWN_IMG = new Image(); CROWN_IMG.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(CROWN_SVG);
  function drawCrown(x, y, k, n, glow) {
    const t = S.t, full = n >= GOAL, d = 104 * k, f = Math.min(1, n / GOAL), x0 = x - d / 2, y0 = y - 6 * k;
    if (!CROWN_IMG.complete || !CROWN_IMG.naturalWidth) return;
    g.save();
    g.globalAlpha = full ? 0 : 0.22; g.drawImage(CROWN_IMG, x0, y0, d, d);                  // まだ ない ぶぶん(うすく)
    g.globalAlpha = 1;
    if (n > 0) {
      g.save(); g.beginPath(); g.rect(x0 - 4, y0 + d * (1 - f * 0.88) - d * 0.06, d + 8, d); g.clip();   // したから そろっていく
      g.shadowColor = '#9fe3ff'; g.shadowBlur = (full ? 26 : 10) * (0.7 + 0.3 * Math.sin(t * 4)); g.drawImage(CROWN_IMG, x0, y0, d, d); g.restore();
    }
    if (n > 0 && !full) { const ey = y0 + d * (1 - f * 0.88) - d * 0.06; star(x0 + d * (0.2 + 0.6 * ((t * 0.8) % 1)), ey, 6 * k + 2, 0.9); }
    if (S.gotT < 0.5) { g.globalAlpha = 1 - S.gotT * 2; g.fillStyle = '#fff'; g.shadowColor = '#fff'; g.shadowBlur = 20; g.beginPath(); g.ellipse(x, y0 + d * 0.55, d * 0.5, d * 0.32, 0, 0, 7); g.globalAlpha = (1 - S.gotT * 2) * 0.25; g.fill(); }
    g.restore();
    if (full) {
      g.save(); g.beginPath(); g.rect(x0, y0, d, d); g.restore();
      [[0.22, 0.22], [0.5, 0.1], [0.78, 0.22], [0.12, 0.5], [0.9, 0.5], [0.35, 0.62], [0.65, 0.62], [0.5, 0.4]].forEach(([px, py], j) => star(x0 + d * px, y0 + d * py, (7 + 6 * hashr(j * 3.3)) * k + 2, Math.max(0, Math.sin(t * 4 + j * 2.1))));
    }
  }
  function drawHeart(x, y, r, col, a) {
    g.save(); g.translate(x, y); g.globalAlpha = a == null ? 1 : a; g.fillStyle = col; g.strokeStyle = '#fff'; g.lineWidth = Math.max(2, r * 0.18); g.lineJoin = 'round';
    g.beginPath(); g.moveTo(0, r * 0.9); g.bezierCurveTo(-r * 1.5, -r * 0.1, -r * 0.7, -r * 1.2, 0, -r * 0.45); g.bezierCurveTo(r * 0.7, -r * 1.2, r * 1.5, -r * 0.1, 0, r * 0.9); g.closePath(); g.stroke(); g.fill();
    g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.ellipse(-r * 0.5, -r * 0.4, r * 0.22, r * 0.14, -0.6, 0, 7); g.fill(); g.restore();
  }
  function drawSpring(x, y, boing) {
    const sq = boing > 0 ? 0.55 : 1, hh = 26 * U * sq;
    g.save(); g.translate(x, y); g.fillStyle = '#ff6b6b'; g.strokeStyle = '#a83a3a'; g.lineWidth = 3;
    g.beginPath(); g.roundRect ? g.roundRect(-20 * U, -5 * U, 40 * U, 8 * U, 4) : g.rect(-20 * U, -5 * U, 40 * U, 8 * U); g.fill(); g.stroke();
    g.strokeStyle = '#ffd24a'; g.lineWidth = 5 * U; g.lineCap = 'round'; g.beginPath(); g.moveTo(-14 * U, -5 * U);
    for (let i = 0; i < 4; i++) { g.lineTo(14 * U, -5 * U - hh * (i + 0.5) / 4); g.lineTo(-14 * U, -5 * U - hh * (i + 1) / 4); }
    g.stroke();
    g.fillStyle = '#ff6b6b'; g.strokeStyle = '#a83a3a'; g.lineWidth = 3; g.beginPath(); g.roundRect ? g.roundRect(-20 * U, -5 * U - hh - 6 * U, 40 * U, 9 * U, 4) : g.rect(-20 * U, -5 * U - hh - 6 * U, 40 * U, 9 * U); g.fill(); g.stroke();
    g.restore();
  }
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
      const c = COLS[Math.floor(hash(k + 3) * 8)], tw = 0.7 + 0.3 * Math.sin(S.t * 2 + k);
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
      const idx = i + Math.floor(S.x / (140 * U)), x = i * 140 * U - (S.x % (140 * U)) + 30 * U, c = COLS[((idx % 8) + 8) % 8];
      g.fillStyle = c; g.globalAlpha = 0.9; g.beginPath(); g.moveTo(x, groundY + 30 * U); g.lineTo(x + 7 * U, groundY + 22 * U); g.lineTo(x + 14 * U, groundY + 30 * U); g.lineTo(x + 7 * U, groundY + 39 * U); g.fill(); g.globalAlpha = 1;
    }
    // ふちを くらく(どうくつの おくゆき)
    const vg = g.createRadialGradient(W / 2, H * 0.55, Math.min(W, H) * 0.35, W / 2, H * 0.55, Math.max(W, H) * 0.8); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.5)'); g.fillStyle = vg; g.fillRect(0, 0, W, H);
    // クリスタル・てき
    const nextG = S.items.find((q) => q.type === 'gem');
    S.items.forEach((q) => {
      const x = cx + (q.wx - S.x); if (x < -50 || x > W + 50) return;
      if (q.type === 'gem') {
        const y = q.y + Math.sin(S.t * 3 + q.t) * 3 * U;
        if (q === nextG && S.hint > 0 && S.got === 0) { g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 3; g.setLineDash([5, 5]); g.beginPath(); g.arc(x, y, 30 * U + Math.sin(S.t * 6) * 2, 0, 7); g.stroke(); g.setLineDash([]); }
        drawGem(x, y, 18 * U, q.c, Math.sin(S.t * 2 + q.t) * 0.12, 1.1);
      } else if (q.type === 'heart') drawHeart(x, q.y + Math.sin(S.t * 4 + q.t) * 3 * U, 15 * U, '#ff6b8a');
      else if (q.type === 'spring') drawSpring(x, groundY + 6 * U, q.boing);
      else if (q.type === 'bat') drawBat(x, q.y, U * 0.95);
      else drawRock(x, q.y, U * 1, q.rot);
    });
    g.fillStyle = 'rgba(0,0,0,.12)'; g.beginPath(); g.ellipse(cx, groundY + 3 * U, (24 - Math.min(10, S.h / (60 * U) * 3)) * U, 6 * U, 0, 0, 7); g.fill();
    drawPuni(cx, groundY - S.h, 0.5 * U);
    S.sparks.forEach((p) => { g.globalAlpha = Math.max(0, Math.min(1, p.life * 2)); g.fillStyle = p.col; g.beginPath(); g.arc(p.x, p.y, 3.5 * U, 0, 7); g.fill(); }); g.globalAlpha = 1;
    S.pops.forEach((p) => { g.globalAlpha = Math.min(1, p.life * 2); g.fillStyle = p.col; g.font = 'bold ' + Math.round(30 * U) + 'px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 5; g.strokeStyle = '#fff'; g.strokeText(p.txt, p.x, p.y - 30 * U); g.fillText(p.txt, p.x, p.y - 30 * U); }); g.globalAlpha = 1;
    for (let i = 0; i < HP; i++) drawHeart(18 * U + i * 24 * U, 18 * U, 9 * U, i < S.hp ? '#ff6b8a' : '#cdd6e6', 1);
    // うえの おうかん・かず
    if (!S.done) {
      const ck = Math.min(1.1 * U, W / 190);
      drawCrown(W / 2, 8 * U, ck, S.got, 0);
      g.fillStyle = '#5a4fcf'; g.font = 'bold ' + Math.round(22 * U) + 'px sans-serif'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.lineWidth = 4; g.strokeStyle = '#fff';
      const tx = W / 2 + 66 * ck + 8, ty = 8 * U + 36 * ck; g.strokeText(S.got + ' / ' + GOAL, tx, ty); g.fillText(S.got + ' / ' + GOAL, tx, ty);
    } else {
      const f = Math.min(1, S.fin / 1.0), ease = 1 - Math.pow(1 - f, 3), ck = (1.1 * U) + ease * Math.max(0, W * 0.0055 - 1.1 * U);
      const x = W / 2, y = 8 * U + ease * (H * 0.14 - 8 * U);
      g.save(); g.translate(x, y + 36 * ck); g.globalAlpha = 0.5 * ease; for (let i = 0; i < 12; i++) { g.rotate(Math.PI / 6); g.fillStyle = i % 2 ? 'rgba(255,240,170,.6)' : 'rgba(255,255,255,.35)'; g.beginPath(); g.moveTo(0, 0); g.lineTo(-18 * U, -W * 0.7); g.lineTo(18 * U, -W * 0.7); g.closePath(); g.fill(); } g.restore();
      drawCrown(x, y, ck, GOAL, 1);
      for (let i = 0; i < 6; i++) { const a = S.t * 2 + i * 1.05, rr = (70 + 12 * Math.sin(S.t * 3 + i)) * ck; g.fillStyle = 'rgba(255,255,255,.9)'; g.beginPath(); g.arc(x + Math.cos(a) * rr * 1.1, y + 36 * ck + Math.sin(a) * rr * 0.55, 3.2 * U, 0, 7); g.fill(); }
    }
    S.conf.forEach((p) => { g.fillStyle = p.col; g.save(); g.translate(p.x, p.y); g.rotate(p.r); g.fillRect(-4, -2, 8, 4); g.restore(); });
    if (S.tip > 0 && !S.done && !S.over) { g.globalAlpha = Math.min(1, S.tip); g.fillStyle = 'rgba(255,255,255,.92)'; const bw = Math.min(W - 24, 320 * U), bh = 40 * U, by = 120 * U; g.beginPath(); g.roundRect ? g.roundRect((W - bw) / 2, by, bw, bh, 14) : g.rect((W - bw) / 2, by, bw, bh); g.fill(); g.fillStyle = '#5a4fcf'; g.font = 'bold ' + Math.round(14 * U) + 'px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(S.tipTxt, W / 2, by + bh / 2); g.globalAlpha = 1; }
  }
  let last = performance.now();
  function frame(now) { const dt = Math.min(0.033, (now - last) / 1000); last = now; update(dt); draw(); requestAnimationFrame(frame); }
  $('again0').addEventListener('click', reset);
  $('clAgain').addEventListener('click', reset);
  $('clNext').addEventListener('click', () => { stage = Math.min(STAGES.length - 1, stage + 1); reset(); });
  layout(); reset(); requestAnimationFrame(frame);
  window.__cr = { S, P, PATS, reset, update, jumpStart, jumpEnd, get U() { return U; }, get groundY() { return groundY; } };
})();
