// たまごやさん: おきゃくさんの ちゅうもん(6こ・10こ・12こ いりの パック)を、にわとりの たまごで いっぱいに する
(() => {
  const $ = (id) => document.getElementById(id);
  const MAX = 99999;

  // ---- おきゃくさん(ほしい パックの おおきさは、ほんとうに おみせに ある 6・10・12) ----
  const CUST = [
    { name: 'くまさん', size: 10, w: 5, svg: '<circle cx="18" cy="16" r="9" fill="#a8723e"/><circle cx="52" cy="16" r="9" fill="#a8723e"/><circle cx="35" cy="34" r="24" fill="#b98049"/><ellipse cx="35" cy="42" rx="11" ry="8" fill="#e8c8a0"/><circle cx="27" cy="30" r="3" fill="#2b2150"/><circle cx="43" cy="30" r="3" fill="#2b2150"/><circle cx="35" cy="39" r="3" fill="#2b2150"/><rect x="16" y="56" width="38" height="26" rx="10" fill="#e8413c"/>' },
    { name: 'うさぎさん', size: 6, w: 2, svg: '<ellipse cx="25" cy="10" rx="6" ry="18" fill="#fff" stroke="#e2d4e8" stroke-width="2"/><ellipse cx="45" cy="10" rx="6" ry="18" fill="#fff" stroke="#e2d4e8" stroke-width="2"/><circle cx="35" cy="36" r="22" fill="#fff" stroke="#e2d4e8" stroke-width="2"/><circle cx="27" cy="33" r="3" fill="#c0395a"/><circle cx="43" cy="33" r="3" fill="#c0395a"/><path d="M31 42 q4 4 8 0" stroke="#c0395a" stroke-width="2" fill="none"/><rect x="16" y="56" width="38" height="26" rx="10" fill="#ff8fb1"/>' },
    { name: 'ペンギンさん', size: 12, w: 2, svg: '<ellipse cx="35" cy="48" rx="26" ry="34" fill="#2b3550"/><ellipse cx="35" cy="54" rx="17" ry="25" fill="#fff"/><circle cx="28" cy="32" r="3" fill="#2b2150"/><circle cx="42" cy="32" r="3" fill="#2b2150"/><path d="M30 40 l5 6 l5 -6 z" fill="#ffb020"/><path d="M22 82 h10 M38 82 h10" stroke="#ffb020" stroke-width="5" stroke-linecap="round"/>' },
  ];
  const custSvg = (c) => '<svg viewBox="0 0 70 86" aria-hidden="true">' + c.svg + '</svg>';
  function pickCust(prev) {
    const pool = CUST.filter((c) => c !== prev), tot = pool.reduce((a, c) => a + c.w, 0);
    let r = Math.random() * tot; for (const c of pool) { r -= c.w; if (r < 0) return c; } return pool[0];
  }

  // ---- え(ゆび) ----
  function handsSvg(up, need) {                                     // 両手。左手の おやゆび → こゆび → 右手の おやゆび → こゆび の じゅんに たつ。need = パックの かず
    const F = [['おや', 34, 46, 38], ['ひとさし', 50, 22, 0], ['なか', 56, 0, 0], ['くすり', 50, -22, 0], ['こ', 40, -43, 0]];
    const feet = need > 10 && up >= 10;                              // 10を こえると、あしの ゆびも つかう
    let s = '<svg viewBox="0 0 400 ' + (feet ? 300 : 190) + '" aria-label="りょうて">';
    [[110, 1], [290, -1]].forEach(([cx, side], h) => {
      let g = '';
      F.forEach(([, len, dx, ang], k) => {
        const i = h * 5 + k, on = i < up, x = cx + dx * side, top = 110, use = i < need;
        const L = on ? len : 14, a = ang * side;
        g += '<rect x="' + (x - 10) + '" y="' + (top - L) + '" width="20" height="' + (L + 14) + '" rx="10" fill="' + (on ? '#ffb070' : '#ffd9b8') + '" stroke="#d99a66" opacity="' + (use ? 1 : 0.35) + '" stroke-width="2" transform="rotate(' + a + ' ' + x + ' ' + (top + 6) + ')"/>';
      });
      g += '<ellipse cx="' + cx + '" cy="140" rx="56" ry="44" fill="#ffd9b8" stroke="#d99a66" stroke-width="2"/>';
      s += g;
    });
    if (feet) {                                                      // あし: おやゆびから じゅんに たつ(ゆび 11ぽんめ・12ほんめ)
      [[150, 1], [250, -1]].forEach(([cx, side], h) => {
        let g = '<ellipse cx="' + cx + '" cy="262" rx="34" ry="26" fill="#ffd9b8" stroke="#d99a66" stroke-width="2"/>';
        for (let k = 0; k < 5; k++) {
          const i = 10 + h * 5 + k, on = i < up, use = i < need, x = cx + (-18 + k * 9) * side * -1, L = on ? 22 : 8, r = k === 0 ? 7 : 5;
          g += '<rect x="' + (x - r) + '" y="' + (240 - L) + '" width="' + (2 * r) + '" height="' + (L + 8) + '" rx="' + r + '" fill="' + (on ? '#ffb070' : '#ffd9b8') + '" stroke="#d99a66" stroke-width="2" opacity="' + (use ? 1 : 0.35) + '"/>';
        }
        s += g;
      });
    }
    return s + '</svg>';
  }
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
  let n = 0, fill = 0, cust = CUST[0], busy = false, sold = [], partyUntil = 0;
  function render(newEgg) {
    const s = cust.size;
    $('num').textContent = n; $('yomi').textContent = yomi(n);
    const partying = Date.now() < partyUntil;
    $('counter').innerHTML = handsSvg(partying ? s : fill, s);
    $('counter').classList.toggle('party', partying);
    $('cLoose').textContent = fill;
    const pl = $('plate'); pl.innerHTML = ''; pl.style.gridTemplateColumns = 'repeat(' + (s / 2) + ', 22px)';
    for (let i = 0; i < s; i++) {
      const sl = document.createElement('span'); sl.className = 'slot';
      if (i < fill) sl.innerHTML = '<span class="egg' + (newEgg && i === fill - 1 ? ' new' : '') + '"></span>';
      pl.appendChild(sl);
    }
    $('cSold').textContent = sold.length; $('cSoldEggs').textContent = sold.reduce((a, x) => a + x, 0);
    const box = $('sold'); box.innerHTML = '';
    sold.slice(-14).forEach((sz, i, arr) => { const e = document.createElement('span'); e.className = 'mini s' + sz + (i === arr.length - 1 && partying ? ' new' : ''); e.title = sz + 'こ いり'; box.appendChild(e); });
    if (sold.length > 14) { const m = document.createElement('span'); m.className = 'more'; m.textContent = '…'; box.prepend(m); }
  }
  function showCust(first) {
    const el = $('cust'); el.innerHTML = custSvg(cust);
    el.classList.remove('dance', 'out', 'in'); void el.offsetWidth; el.classList.add('in');
    $('bubble').textContent = cust.size + 'こ ください';
    $('say').textContent = cust.name + '「' + cust.size + 'こ いりの パックを いっぱいに して！」' + (cust.size === 12 ? '(1ダース)' : '');
    if (!first) sayWords(cust.size + 'こ ください');
  }
  function sayWords(t) {
    if (!voiceOn || !window.speechSynthesis) return;
    clearTimeout(speakTimer); speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(t); u.lang = 'ja-JP'; u.rate = 1.05;
    const v = speechSynthesis.getVoices().find((x) => /^ja/i.test(x.lang)); if (v) u.voice = v;
    speechSynthesis.speak(u);
  }

  function addEgg() {
    if (busy || n >= MAX) return false;
    n++; fill++;
    const num = $('num'); num.classList.remove('bump'); void num.offsetWidth; num.classList.add('bump');
    const s = cust.size;
    if (fill === s) {                                              // いっぱい！ おきゃくさんに わたす
      busy = true; sParty(); partyUntil = Date.now() + 900;
      $('say').textContent = 'いっぱい！ ' + cust.name + 'に わたそう';
      render(true); speak(fill);
      const el = $('cust'); el.classList.remove('in'); void el.offsetWidth; el.classList.add('dance');
      setTimeout(() => {
        for (let i = 0; i < 6; i++) tone(1568 + (i % 2) * 300, i * 0.07, 0.12, 'triangle', 0.12);   // チャリン
        sold.push(s); fill = 0; el.classList.remove('dance'); void el.offsetWidth; el.classList.add('out');
        $('bubble').textContent = 'ありがとう！';
        render();
      }, 1000);
      setTimeout(() => { cust = pickCust(cust); busy = false; showCust(); render(); }, 1600);
      return true;
    }
    sFinger(Math.min(fill, 10));
    if (fill === 10 && s > 10) $('say').textContent = 'ゆびが たりない！ あしの ゆびも つかおう';
    else $('say').textContent = s - fill === 1 ? 'あと 1こで ' + s + 'こ！' : (fill <= 10 ? 'ゆびが ' : 'あしの ゆびも あわせて ') + fill + 'ほん';
    render(true); speak(fill);
    if (Math.random() < 0.06) chick();
    return true;
  }

  function chick() {                                                // ときどき ひよこが あそびに くる(かずとは かんけい ない)
    const c = document.createElement('span'); c.className = 'chick'; c.textContent = '🐥';
    const play = $('play'), field = play.querySelector('.store');
    c.style.left = '-40px'; c.style.top = (field.offsetTop - 10) + 'px';
    play.appendChild(c);
    tone(1200, 0, 0.08, 'sine', 0.15); tone(1500, 0.1, 0.08, 'sine', 0.15);
    setTimeout(() => c.remove(), 2400);
  }

  // ---- え を おす(にわとり = たまごを うむ、おみせ・おきゃくさん = ちゅうもんを もういちど いう) ----
  const hen = $('hen');
  function hitAnim(el) { el.classList.remove('hit'); void el.offsetWidth; el.classList.add('hit'); }
  function lay() {
    hitAnim(hen); $('finger').style.display = 'none';
    tone(880, 0, 0.05, 'square', 0.05); tone(660, 0.06, 0.07, 'square', 0.05);          // コケッ
    if (!addEgg()) return;
    const e = document.createElement('span'); e.className = 'flyegg';
    const r = hen.getBoundingClientRect(), pr = $('play').getBoundingClientRect();
    e.style.left = (r.left - pr.left + r.width * 0.55) + 'px'; e.style.top = (r.top - pr.top + r.height * 0.55) + 'px';
    e.style.setProperty('--dx', (20 + Math.random() * 30) + 'px');
    $('play').appendChild(e); setTimeout(() => e.remove(), 450);
  }
  let holdT = null, holdI = null, speed = 200;
  function stopHold() { clearTimeout(holdT); clearTimeout(holdI); holdT = holdI = null; }
  function loop() { lay(); speed = Math.max(70, speed * 0.9); holdI = setTimeout(loop, speed); }
  hen.addEventListener('pointerdown', (e) => { e.preventDefault(); lay(); speed = 200; holdT = setTimeout(loop, 450); });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((t) => hen.addEventListener(t, stopHold));
  hen.addEventListener('click', (e) => { if (e.detail === 0) lay(); });   // キーボード(Enter・スペース)
  hen.addEventListener('contextmenu', (e) => e.preventDefault());
  $('shop').addEventListener('click', () => { hitAnim($('shop')); if (!busy) sayWords(cust.name + '。' + cust.size + 'こ ください'); });
  $('reset').onclick = () => { stopHold(); n = 0; fill = 0; sold = []; busy = false; partyUntil = 0; cust = CUST[0]; showCust(true); render(); };
  $('voice').onclick = () => { voiceOn = !voiceOn; $('voice').textContent = voiceOn ? '🗣 こえ あり' : '🤐 こえ なし'; if (!voiceOn && window.speechSynthesis) speechSynthesis.cancel(); };
  if (window.speechSynthesis) speechSynthesis.getVoices();
  showCust(true);
  render();
})();
