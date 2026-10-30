// たまごやさん: たまごを ころがして かぞえる。ゆび(あし)が ぜんぶ たったら パックに しまう
(() => {
  const $ = (id) => document.getElementById(id);
  const MAX = 99999;

  // ---- かぞえる かかり(ゆび・あしの かず = パックに はいる かず) ----
  const WHO = [
    { id: 'hito', name: 'にんげん', icon: '🖐', base: 10, part: 'ゆび', full: 'ゆびが ぜんぶ たった！' },
    { id: 'tako', name: 'タコ', icon: '🐙', base: 8, part: 'あし', full: 'あしが ぜんぶ あがった！' },
    { id: 'mushi', name: 'むし', icon: '🐜', base: 6, part: 'あし', full: 'あしが ぜんぶ あがった！' },
  ];
  let who = WHO[0];

  // ---- え(SVG) ----
  function handsSvg(up) {                                           // 両手。左手の おやゆび → こゆび → 右手の おやゆび → こゆび の じゅんに たつ
    const F = [['おや', 34, 46, 38], ['ひとさし', 50, 22, 0], ['なか', 56, 0, 0], ['くすり', 50, -22, 0], ['こ', 40, -43, 0]];
    let s = '<svg viewBox="0 0 400 190" aria-label="りょうて">';
    [[110, 1], [290, -1]].forEach(([cx, side], h) => {
      let g = '';
      F.forEach(([, len, dx, ang], k) => {
        const i = h * 5 + k, on = i < up, x = cx + dx * side, top = 110;
        const L = on ? len : 14, a = ang * side;
        g += '<rect x="' + (x - 10) + '" y="' + (top - L) + '" width="20" height="' + (L + 14) + '" rx="10" fill="' + (on ? '#ffb070' : '#ffd9b8') + '" stroke="#d99a66" stroke-width="2" transform="rotate(' + a + ' ' + x + ' ' + (top + 6) + ')"/>';
      });
      g += '<ellipse cx="' + cx + '" cy="140" rx="56" ry="44" fill="#ffd9b8" stroke="#d99a66" stroke-width="2"/>';
      s += g;
    });
    return s + '</svg>';
  }
  function takoSvg(up) {
    let legs = '';
    for (let i = 0; i < 8; i++) {
      const x = 102 + i * 28, on = i < up, sp = (x - 200);
      const tx = x + sp * 0.75, d = on ? 'M' + x + ' 112 Q' + (x + sp * 0.5) + ' 70 ' + tx + ' 26' : 'M' + x + ' 112 q' + (i % 2 ? 8 : -8) + ' 36 0 70';
      legs += '<path d="' + d + '" fill="none" stroke="' + (on ? '#d7a6ff' : '#b07ce8') + '" stroke-width="15" stroke-linecap="round"/>';
      if (on) legs += '<circle cx="' + tx + '" cy="26" r="9" fill="#fff3a8" stroke="#b07ce8" stroke-width="3"/>';
    }
    return '<svg viewBox="0 0 400 200" aria-label="タコ">' + legs +
      '<ellipse cx="200" cy="80" rx="74" ry="52" fill="#b07ce8"/>' +
      '<circle cx="176" cy="74" r="10" fill="#fff"/><circle cx="224" cy="74" r="10" fill="#fff"/><circle cx="176" cy="76" r="5" fill="#2b2150"/><circle cx="224" cy="76" r="5" fill="#2b2150"/>' +
      '<path d="M190 98 q10 8 20 0" fill="none" stroke="#5a2b7a" stroke-width="4" stroke-linecap="round"/></svg>';
  }
  function mushiSvg(up) {
    let legs = '';
    for (let i = 0; i < 6; i++) {
      const x = 168 + i * 13, on = i < up;
      const d = on ? 'M' + x + ' 100 l' + (-15 + i * 6) + ' -36 l' + (-8 + i * 3) + ' -28' : 'M' + x + ' 116 l' + (-14 + i * 6) + ' 34 l' + (-8 + i * 3) + ' 26';
      legs += '<path d="' + d + '" fill="none" stroke="' + (on ? '#ff7a3d' : '#5b4630') + '" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>';
    }
    return '<svg viewBox="0 0 400 200" aria-label="むし">' + legs +
      '<ellipse cx="300" cy="112" rx="58" ry="40" fill="#7a5a3a"/><ellipse cx="200" cy="112" rx="44" ry="26" fill="#8a6a45"/><circle cx="112" cy="100" r="34" fill="#7a5a3a"/>' +
      '<path d="M100 70 q-14 -30 -36 -36 M122 68 q4 -32 22 -44" fill="none" stroke="#5b4630" stroke-width="5" stroke-linecap="round"/>' +
      '<circle cx="100" cy="94" r="8" fill="#fff"/><circle cx="98" cy="96" r="4" fill="#2b2150"/><path d="M96 116 q8 6 16 0" fill="none" stroke="#3a2a12" stroke-width="3" stroke-linecap="round"/></svg>';
  }
  const drawWho = (up) => (who.id === 'hito' ? handsSvg : who.id === 'tako' ? takoSvg : mushiSvg)(up);

  // ---- よみかた(13 → じゅうさん) ----
  const D = ['', 'いち', 'に', 'さん', 'よん', 'ご', 'ろく', 'なな', 'はち', 'きゅう'];
  function read4(n) {
    const th = Math.floor(n / 1000), h = Math.floor(n / 100) % 10, t = Math.floor(n / 10) % 10, o = n % 10;
    let s = '';
    if (th) s += th === 1 ? 'せん' : th === 3 ? 'さんぜん' : th === 8 ? 'はっせん' : D[th] + 'せん';
    if (h) s += h === 1 ? 'ひゃく' : h === 3 ? 'さんびゃく' : h === 6 ? 'ろっぴゃく' : h === 8 ? 'はっぴゃく' : D[h] + 'ひゃく';
    if (t) s += t === 1 ? 'じゅう' : D[t] + 'じゅう';
    if (o) s += D[o];
    return s;
  }
  const yomi = (n) => n === 0 ? 'ゼロ' : (n >= 10000 ? read4(Math.floor(n / 10000)) + 'まん' : '') + read4(n % 10000);

  // ---- おと・こえ ----
  let ac = null, voiceOn = true, speakTimer = null;
  function ctx() { if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume(); return ac; }
  function tone(f, t, dur, type, vol, drop) {
    const c = ctx(), o = c.createOscillator(), g = c.createGain(), at = c.currentTime + t;
    o.type = type; o.frequency.setValueAtTime(f, at); if (drop) o.frequency.exponentialRampToValueAtTime(f * drop, at + dur);
    g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(vol, at + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g); g.connect(c.destination); o.start(at); o.stop(at + dur + 0.02);
  }
  function clap(t) {                                                // パチ(みじかい ノイズ)
    const c = ctx(), len = Math.floor(c.sampleRate * 0.06), b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = b; f.type = 'bandpass'; f.frequency.value = 1500; g.gain.value = 0.6;
    s.connect(f); f.connect(g); g.connect(c.destination); s.start(c.currentTime + t);
  }
  const SCALE = [261.6, 293.7, 329.6, 349.2, 392, 440, 493.9, 523.3, 587.3, 659.3];   // ゆび 1ぽんずつ ドレミ…
  const sFinger = (k) => tone(SCALE[Math.min(k, 10) - 1] || 261.6, 0, 0.22, 'triangle', 0.22);
  function sParty() { [523.3, 659.3, 784, 1046.5].forEach((f) => tone(f, 0, 0.6, 'triangle', 0.12)); for (let i = 0; i < 4; i++) clap(0.08 + i * 0.13); tone(140, 0.6, 0.18, 'sine', 0.5, 0.5); }
  const sBox = () => { tone(110, 0.75, 0.3, 'sine', 0.6, 0.5); tone(220, 0.8, 0.15, 'square', 0.08); };
  const sTruck = () => { tone(392, 0.9, 0.22, 'square', 0.12); tone(330, 1.15, 0.35, 'square', 0.12); };
  function speak(n) {
    if (!voiceOn || !window.speechSynthesis) return;
    clearTimeout(speakTimer);
    speakTimer = setTimeout(() => {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(String(n)); u.lang = 'ja-JP'; u.rate = 1.05;
      const v = speechSynthesis.getVoices().find((x) => /^ja/i.test(x.lang)); if (v) u.voice = v;
      speechSynthesis.speak(u);
    }, 280);
  }

  // ---- じょうたい ----
  let n = 0, partyUntil = 0, partyTimer = null;
  const parts = (x, b) => ({ loose: x % b, pack: Math.floor(x / b) % b, box: Math.floor(x / (b * b)) % b, truck: Math.floor(x / (b * b * b)) });

  function render(fx) {                                             // fx = { newLoose, newPack, newBox, newTruck }
    fx = fx || {};
    const b = who.base, p = parts(n, b);
    $('num').textContent = n; $('yomi').textContent = yomi(n);
    const partying = Date.now() < partyUntil;
    $('counter').innerHTML = drawWho(partying ? b : p.loose);
    $('counter').classList.toggle('party', partying);
    // つめている とちゅうの パック(あなは かぞえる かかりの かず。からっぽの ときは 0 を だす)
    $('cLoose').textContent = p.loose;
    const pl = $('plate'); pl.innerHTML = ''; pl.style.gridTemplateColumns = 'repeat(' + (b / 2) + ', 22px)';
    for (let i = 0; i < b; i++) {
      const sl = document.createElement('span'); sl.className = 'slot';
      if (i < p.loose) sl.innerHTML = '<span class="egg' + (fx.newLoose && i === p.loose - 1 ? ' new' : '') + '"></span>';
      pl.appendChild(sl);
    }
    // しまった もの(パック・はこ・トラック)
    const shelf = (id, cnt, cls, html, isNew, cap) => {
      $(id).innerHTML = '';
      for (let i = 0; i < Math.min(cnt, cap); i++) { const e = document.createElement('span'); e.className = cls + (isNew && i === Math.min(cnt, cap) - 1 ? ' new' : ''); e.innerHTML = html; $(id).appendChild(e); }
      if (cnt > cap) { const m = document.createElement('span'); m.className = 'more'; m.textContent = '…'; $(id).appendChild(m); }
    };
    $('cPack').textContent = p.pack; shelf('packs', p.pack, 'mini', '', fx.newPack, 12);
    $('cBox').textContent = p.box; shelf('boxes', p.box, 'minibox', '', fx.newBox, 12);
    $('cTruck').textContent = p.truck; shelf('trucks', p.truck, 'minitruck', '🚚', fx.newTruck, 6);
  }

  function add(k) {
    if (n >= MAX) return;
    const b = who.base, prev = n, before = parts(prev, b);
    n = Math.min(MAX, n + k);
    const now = parts(n, b);
    const packed = Math.floor(n / b) > Math.floor(prev / b);
    const boxed = Math.floor(n / (b * b)) > Math.floor(prev / (b * b));
    const trucked = Math.floor(n / (b * b * b)) > Math.floor(prev / (b * b * b));
    let say = '';
    if (packed) {
      sParty(); partyUntil = Date.now() + 700;
      clearTimeout(partyTimer); partyTimer = setTimeout(() => render(), 720);
      say = who.full + ' パックを とじて、あたらしい パックへ';
      if (boxed) { sBox(); say = 'パックが ' + b + 'こ！ はこに いれよう'; }
      if (trucked) { sTruck(); say = 'はこが ' + b + 'こ！ トラック しゅっぱつ'; }
    } else {
      sFinger(now.loose);
      say = b - now.loose === 1 ? 'あと 1つで ' + b + '！' : who.part + 'が ' + now.loose + 'つ';
    }
    $('say').textContent = say;
    const num = $('num'); num.classList.remove('bump'); void num.offsetWidth; num.classList.add('bump');
    render({ newLoose: !packed || now.loose > 0, newPack: packed && now.pack > before.pack, newBox: boxed, newTruck: trucked });
    speak(n);
    if (k === 1 && Math.random() < 0.07) chick();
  }

  function chick() {                                                // ときどき ひよこが あそびに くる(かずとは かんけい ない)
    const c = document.createElement('span'); c.className = 'chick'; c.textContent = '🐥';
    const play = $('play'), field = play.querySelector('.store');
    c.style.left = '-40px'; c.style.top = (field.offsetTop + 10 + Math.random() * 60) + 'px';
    play.appendChild(c);
    tone(1200, 0, 0.08, 'sine', 0.15); tone(1500, 0.1, 0.08, 'sine', 0.15);
    setTimeout(() => c.remove(), 2400);
  }

  // ---- え を おす(にわとり = たまごを うむ、おみせ = ぜんぶ うれる) ----
  const hen = $('hen');
  function hitAnim(el) { el.classList.remove('hit'); void el.offsetWidth; el.classList.add('hit'); }
  function lay() {
    add(1); hitAnim(hen); $('finger').style.display = 'none';
    tone(880, 0, 0.05, 'square', 0.05); tone(660, 0.06, 0.07, 'square', 0.05);          // コケッ
    const e = document.createElement('span'); e.className = 'flyegg';
    const r = hen.getBoundingClientRect(), pr = $('play').getBoundingClientRect();
    e.style.left = (r.left - pr.left + r.width * 0.55) + 'px'; e.style.top = (r.top - pr.top + r.height * 0.55) + 'px';
    e.style.setProperty('--dx', (20 + Math.random() * 30) + 'px');
    $('play').appendChild(e); setTimeout(() => e.remove(), 520);
  }
  let holdT = null, holdI = null, speed = 180;
  function stopHold() { clearTimeout(holdT); clearTimeout(holdI); holdT = holdI = null; }
  function loop() { lay(); speed = Math.max(45, speed * 0.88); holdI = setTimeout(loop, speed); }
  hen.addEventListener('pointerdown', (e) => { e.preventDefault(); lay(); speed = 180; holdT = setTimeout(loop, 450); });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((t) => hen.addEventListener(t, stopHold));
  hen.addEventListener('click', (e) => { if (e.detail === 0) lay(); });   // キーボード(Enter・スペース)
  hen.addEventListener('contextmenu', (e) => e.preventDefault());
  $('shop').addEventListener('click', () => {
    hitAnim($('shop'));
    if (n === 0) { $('say').textContent = 'まだ たまごが ないよ'; return; }
    for (let i = 0; i < 6; i++) tone(1568 + (i % 2) * 300, i * 0.07, 0.12, 'triangle', 0.12);   // チャリン
    $('say').textContent = 'ぜんぶ うれた！ ゼロ'; n = 0; partyUntil = 0; render(); speak(0);
  });
  $('voice').onclick = () => { voiceOn = !voiceOn; $('voice').textContent = voiceOn ? '🗣 こえ あり' : '🤐 こえ なし'; if (!voiceOn && window.speechSynthesis) speechSynthesis.cancel(); };

  WHO.forEach((w) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'chip' + (w === who ? ' sel' : ''); b.style.marginRight = '4px';
    b.innerHTML = w.icon + ' ' + w.name + '(' + w.base + ')';
    b.onclick = () => {
      who = w; partyUntil = 0;
      document.querySelectorAll('#who .chip').forEach((x) => x.classList.toggle('sel', x === b));
      $('say').textContent = w.id === 'hito' ? 'ゆびは 10ぽん。10こで 1パック' : w.name + 'の あしは ' + w.base + 'ほん。' + w.base + 'こで 1パック';
      render();
    };
    $('who').appendChild(b);
  });
  if (window.speechSynthesis) speechSynthesis.getVoices();
  render();
})();
