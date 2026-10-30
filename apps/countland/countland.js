// かずの くに: おなじ かずを、4つの くに(十進法・0の ない かぞえかた・八進法・二進法)で かぞえる
(() => {
  const $ = (id) => document.getElementById(id);
  const MAX = 199;

  // ---- キャラ(ほかの こども向けページと おなじ なかま。タコは この ページ用) ----
  function starBody(cx, cy, r1, r2, n, fill) {
    let d = '';
    for (let i = 0; i < n * 2; i++) { const a = Math.PI * i / n - Math.PI / 2, r = i % 2 ? r2 : r1; d += (i ? 'L' : 'M') + (cx + r * Math.cos(a)).toFixed(1) + ' ' + (cy + r * Math.sin(a)).toFixed(1); }
    return '<path d="' + d + 'Z" fill="' + fill + '" stroke="' + fill + '" stroke-width="4" stroke-linejoin="round"/>';
  }
  function takoBody() {
    let legs = '';
    for (let i = 0; i < 8; i++) {                                   // あし 8ぽん
      const x = 14 + i * 10.3, dir = i % 2 ? 1 : -1;
      legs += '<path d="M' + x + ' 62 q' + (dir * 6) + ' 14 0 22 q' + (-dir * 5) + ' 6 ' + (dir * 3) + ' 10" fill="none" stroke="#b07ce8" stroke-width="7" stroke-linecap="round"/>';
    }
    return legs + '<ellipse cx="50" cy="44" rx="38" ry="32" fill="#b07ce8"/>';
  }
  const CH = {
    fuwa: { body: '<ellipse cx="50" cy="56" rx="40" ry="35" fill="#ff8fb1"/>', ey: 50, my: 66, ex: 17 },
    giza: { body: starBody(50, 54, 44, 34, 11, '#ffc93c'), ey: 52, my: 68, ex: 16 },
    kaku: { body: '<rect x="12" y="18" width="76" height="74" rx="8" fill="#5bb6ff"/>', ey: 48, my: 64, ex: 18 },
    pyon: { body: '<path d="M50 12 L90 88 L10 88 Z" fill="#6bd68c" stroke="#6bd68c" stroke-width="8" stroke-linejoin="round"/>', ey: 58, my: 74, ex: 12 },
    tako: { body: takoBody(), ey: 40, my: 54, ex: 15 },
  };
  const charSvg = (k) => {
    const c = CH[k];
    return '<svg viewBox="0 0 100 100" aria-hidden="true">' + c.body +
      '<circle cx="' + (50 - c.ex) + '" cy="' + c.ey + '" r="6.5" fill="#fff"/><circle cx="' + (50 + c.ex) + '" cy="' + c.ey + '" r="6.5" fill="#fff"/>' +
      '<circle cx="' + (50 - c.ex) + '" cy="' + (c.ey + 1) + '" r="3" fill="#2b2150"/><circle cx="' + (50 + c.ex) + '" cy="' + (c.ey + 1) + '" r="3" fill="#2b2150"/>' +
      '<path d="M' + (50 - 7) + ' ' + c.my + ' q7 6 14 0" fill="none" stroke="#7a2b3b" stroke-width="3" stroke-linecap="round"/></svg>';
  };
  const ONES = ['fuwa', 'giza', 'kaku', 'pyon'];

  // ---- 4つの くに ----
  const LANDS = [
    { id: 'ten', name: 'じゅうの くに', sub: 'いつもの かぞえかた。10こで ひとまとめ', base: 10, zero: true, ch: 'fuwa' },
    { id: 'nozero', name: 'ゼロの ない くに', sub: '0を つかわない。9の つぎは 11', base: 9, zero: false, ch: 'giza' },
    { id: 'octo', name: 'タコの くに', sub: 'あしが 8ぽん。8こで ひとまとめ', base: 8, zero: true, ch: 'tako' },
    { id: 'robo', name: 'ロボの くに', sub: 'ランプは つく(1)か きえる(0)だけ。2こで ひとまとめ', base: 2, zero: true, ch: 'kaku', lamp: true },
  ];
  // すうじの ならび(ひくい けたから)。0の ない くには、1〜9だけで かく
  function digitsOf(n, L) {
    const b = L.base, out = [];
    if (L.zero) { if (n === 0) return [0]; while (n > 0) { out.push(n % b); n = Math.floor(n / b); } return out; }
    while (n > 0) { const d = ((n - 1) % b) + 1; out.push(d); n = (n - d) / b; }
    return out;
  }
  const write = (n, L) => digitsOf(n, L).slice().reverse().join('') || '(なし)';
  const BAGS = ['ばら', 'ふくろ', 'はこ', 'おおばこ', 'コンテナ', 'くら', 'しろ', 'ほし'];
  const placeName = (p, L) => p === 0 ? 'ばら' : (BAGS[p] || 'まとまり') + '(' + Math.pow(L.base, p) + 'こ)';

  // ---- おと ----
  let ac = null, muted = false;
  function tone(freq, t, dur, type, vol, drop) {
    if (muted) return;
    if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === 'suspended') ac.resume();
    const o = ac.createOscillator(), g = ac.createGain(), at = ac.currentTime + t;
    o.type = type; o.frequency.setValueAtTime(freq, at);
    if (drop) o.frequency.exponentialRampToValueAtTime(freq * drop, at + dur);
    g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(vol, at + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g); g.connect(ac.destination); o.start(at); o.stop(at + dur + 0.02);
  }
  const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];                // ばらの かずで、ドレミソラ…と たかく なる
  function soundStep(L, n, carry) {
    const d = digitsOf(n, L)[0] || 0;
    tone(261.6 * Math.pow(2, PENTA[d % 10] / 12), 0, 0.25, 'triangle', 0.25);
    for (let k = 1; k <= carry; k++) tone(520 * Math.pow(1.5, k - 1), 0.1 + 0.11 * k, 0.16, 'sine', 0.3, 0.45);   // ぽこん
  }

  // ---- がめん ----
  let n = 0, sel = 'nozero';
  const landOf = (id) => LANDS.find((l) => l.id === id);
  const cards = {};
  for (const L of LANDS) {
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'land'; btn.setAttribute('aria-pressed', 'false');
    const places = Math.max(digitsOf(MAX, L).length, 1);
    let wheels = '', words = '';
    const sym = [''].concat(L.zero ? [...Array(L.base).keys()].map(String) : [...Array(L.base).keys()].map((i) => String(i + 1)));
    for (let p = places - 1; p >= 0; p--) {
      wheels += '<div class="wheel' + (L.lamp ? ' lamp' : '') + '" data-p="' + p + '"><div class="strip">' + sym.map((s) => '<span>' + s + '</span>').join('') + '</div></div>';
      words += '<span data-p="' + p + '">' + (p === 0 ? 'ばら' : (BAGS[p] || '')) + '</span>';
    }
    btn.innerHTML = '<div class="lhead"><div class="lav">' + charSvg(L.ch) + '</div><div class="lname">' + L.name + '<small>' + L.sub + '</small></div></div>' +
      '<div class="meter">' + wheels + '</div><div class="placeword">' + words + '</div><div class="say"></div>';
    btn.onclick = () => { sel = L.id; render(null); };
    $('lands').appendChild(btn);
    cards[L.id] = btn;
  }

  function sayFor(L, prev, carry, step) {
    const ds = digitsOf(n, L);
    if (n === 0) {
      if (!L.zero) return 'なにも ないときは、<b>なにも かかない</b>。この くにには 0が ないからね。';
      if (L.lamp) return 'ランプが ぜんぶ きえてる。これが <b>0</b>。';
      return 'まだ なにも ない。「<b>0</b>」と かくよ。';
    }
    if (carry > 0 && step === 1) {
      if (!L.zero && ds[0] === 1 && carry === 1 && prev % L.base === 0) return '9の つぎは… <b>' + write(n, L) + '</b>！ ばらを 0こには できないから、9こを ふくろに いれて、ばらは 1こから やりなおし。';
      if (!L.zero) return 'ばらを 0こに できないので、ここで まとめた！ → <b>' + write(n, L) + '</b>';
      if (L.lamp) return '2こ そろったら すぐ くりあがり！ ランプが となりへ うつって <b>' + write(n, L) + '</b>。';
      const what = carry === 1 ? L.base + 'こ そろったから ふくろに まとめて' : 'ふくろが ' + L.base + 'こ そろったから ' + (BAGS[carry] || 'まとまり') + 'に まとめて';
      return what + '、となりの けたへ ぽこん！ → <b>' + write(n, L) + '</b>';
    }
    const parts = [];
    for (let p = ds.length - 1; p >= 0; p--) if (ds[p]) parts.push((p === 0 ? 'ばら' : (BAGS[p] || 'まとまり')) + ' ' + ds[p] + (p === 0 ? 'こ' : 'つ'));
    return '「<b>' + write(n, L) + '</b>」と かく。' + parts.join('と ') + '。';
  }

  function render(change) {                                         // change = { prev, step }
    $('n').textContent = n;
    for (const L of LANDS) {
      const card = cards[L.id], ds = digitsOf(n, L);
      card.classList.toggle('sel', L.id === sel); card.setAttribute('aria-pressed', L.id === sel ? 'true' : 'false');
      let carry = 0;
      if (change) {
        const pd = digitsOf(change.prev, L);
        for (let p = Math.max(pd.length, ds.length) - 1; p >= 1; p--) if ((pd[p] || 0) !== (ds[p] || 0)) { carry = p; break; }
      }
      const shown = Math.max(ds.length, 1);
      card.querySelectorAll('.wheel').forEach((w) => {
        const p = +w.dataset.p, has = p < ds.length;
        const idx = has ? (L.zero ? ds[p] + 1 : ds[p]) : (L.zero && p === 0 ? 1 : 0);
        w.querySelector('.strip').style.transform = 'translateY(' + (-50 * idx) + 'px)';
        w.classList.toggle('hide', p >= shown);
        if (L.lamp) { const on = has && ds[p] === 1; w.classList.toggle('on', on); w.classList.toggle('off', !on); }
        if (change && carry && change.step === 1 && p <= carry && p < shown) { w.classList.remove('flash'); void w.offsetWidth; w.classList.add('flash'); }
      });
      card.querySelectorAll('.placeword span').forEach((s) => s.classList.toggle('hide', +s.dataset.p >= shown));
      card.querySelector('.say').innerHTML = sayFor(L, change ? change.prev : n, carry, change ? change.step : 0);
      if (change && carry && change.step === 1) {
        const av = card.querySelector('.lav'); av.classList.remove('hop'); void av.offsetWidth; av.classList.add('hop');
        card.classList.remove('shake'); void card.offsetWidth; card.classList.add('shake');
      }
      if (L.id === sel && change && change.step === 1) soundStep(L, n, carry);
      if (L.id === sel && change && change.step !== 1 && change.step !== 0) soundStep(L, n, 0);
    }
    renderTray(change);
    renderCompare();
  }

  function renderTray(change) {
    const L = landOf(sel), ds = digitsOf(n, L), tray = $('tray');
    tray.innerHTML = '';
    if (n === 0) { tray.innerHTML = '<span class="empty">まだ なにも ないよ。「＋1」を おしてね。</span>'; return; }
    let carry = 0;
    if (change && change.step === 1) { const pd = digitsOf(change.prev, L); for (let p = Math.max(pd.length, ds.length) - 1; p >= 1; p--) if ((pd[p] || 0) !== (ds[p] || 0)) { carry = p; break; } }
    let made = 0;
    for (let p = ds.length - 1; p >= 0; p--) {
      const d = ds[p]; if (!d) continue;
      const g = document.createElement('div'); g.className = 'grp';
      g.innerHTML = '<div class="gl">' + placeName(p, L) + ' × ' + d + '</div>';
      for (let i = 0; i < d; i++) {
        const e = document.createElement('div');
        if (p === 0) {
          e.className = 'one'; e.innerHTML = charSvg(ONES[(made++) % ONES.length]);
          if (change && change.step === 1 && i === d - 1) e.classList.add('new');
        } else {
          e.className = 'bundle l' + Math.min(p, 4);
          e.innerHTML = '<div>' + Math.pow(L.base, p) + '<small>こ</small></div>';
          if (carry === p && i === d - 1) e.classList.add('new');
          made += Math.pow(L.base, p);
        }
        g.appendChild(e);
      }
      tray.appendChild(g);
    }
  }

  function renderCompare() {
    const t = LANDS.map((L) => L.name + 'では「<b>' + write(n, L) + '</b>」').join('、');
    $('compare').innerHTML = 'いま ' + n + 'こ。' + t + '。';
  }

  function change(step) {
    const prev = n;
    n = Math.max(0, Math.min(MAX, n + step));
    if (n === prev) { stopAuto(); return; }
    render({ prev, step });
  }
  $('plus').onclick = () => change(1);
  $('minus').onclick = () => change(-1);
  $('plus10').onclick = () => change(10);
  $('reset').onclick = () => { stopAuto(); const prev = n; n = 0; render(prev ? { prev, step: 0 } : null); };
  $('mute').onclick = () => { muted = !muted; $('mute').textContent = muted ? '🔇 おと なし' : '🔊 おと あり'; };
  let timer = null;
  function stopAuto() { if (timer) { clearInterval(timer); timer = null; } $('auto').textContent = '🪄 じどうで かぞえる'; }
  $('auto').onclick = () => {
    if (timer) { stopAuto(); return; }
    $('auto').textContent = '⏸ とめる';
    timer = setInterval(() => { if (n >= MAX) { stopAuto(); return; } change(1); }, 650);
  };

  // ---- クイズ ----
  let quiz = null;
  function newQuiz() {
    const others = LANDS.filter((L) => L.id !== 'ten');
    const L = others[Math.floor(Math.random() * others.length)];
    const ans = L.id === 'robo' ? 2 + Math.floor(Math.random() * 14) : 9 + Math.floor(Math.random() * 30);
    const shown = write(ans, L);
    const opts = new Set([ans]);
    const lit = parseInt(shown, 10);
    if (lit !== ans && lit <= MAX) opts.add(lit);                    // 「そのまま よんだ」かず(よくある まちがい)
    for (const d of [1, -1, 2, -2, 3]) { if (opts.size >= 3) break; if (ans + d > 0) opts.add(ans + d); }
    quiz = { L, ans };
    $('qtext').innerHTML = L.name + 'の「<b>' + shown + '</b>」は、じゅうの くにで いくつ？';
    $('qres').textContent = '';
    const box = $('qans'); box.innerHTML = '';
    [...opts].sort(() => Math.random() - 0.5).forEach((v) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'big ans'; b.textContent = v;
      b.onclick = () => {
        if (v === ans) { $('qres').innerHTML = '⭕ せいかい！ ' + L.name + 'の「' + shown + '」は ' + ans + 'こ。'; tone(784, 0, .15, 'triangle', .25); tone(1047, .12, .25, 'triangle', .25); }
        else { $('qres').innerHTML = '🤔 ざんねん。「メーターで たしかめる」で みてみよう。'; tone(220, 0, .3, 'sine', .25, .7); }
      };
      box.appendChild(b);
    });
  }
  $('qnext').onclick = newQuiz;
  $('qshow').onclick = () => {
    if (!quiz) return;
    stopAuto(); const prev = n; n = quiz.ans; sel = quiz.L.id;
    render({ prev, step: 0 });
    cards[sel].scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  render(null);
  newQuiz();
})();
