// ドーナツやさん: おきゃくさんの ちゅうもん(6こ・10こ・12こ いりの はこ)を、オーブンで やいた ドーナツで いっぱいに する
(() => {
  const $ = (id) => document.getElementById(id);

  // ---- おきゃくさん(ほしい はこの おおきさは、ほんとうに おみせに ある 6・10・12) ----
  const CUST = [
    { name: 'くまさん', size: 10, w: 5, svg: '<circle cx="18" cy="16" r="9" fill="#a8723e"/><circle cx="52" cy="16" r="9" fill="#a8723e"/><circle cx="35" cy="34" r="24" fill="#b98049"/><ellipse cx="35" cy="42" rx="11" ry="8" fill="#e8c8a0"/><circle cx="27" cy="30" r="3" fill="#2b2150"/><circle cx="43" cy="30" r="3" fill="#2b2150"/><circle cx="35" cy="39" r="3" fill="#2b2150"/><ellipse cx="20" cy="40" rx="4" ry="2.4" fill="#ff9e9e" opacity=".7"/><ellipse cx="50" cy="40" rx="4" ry="2.4" fill="#ff9e9e" opacity=".7"/><rect x="16" y="56" width="38" height="26" rx="10" fill="#e8413c"/>' },
    { name: 'うさぎさん', size: 6, w: 2, svg: '<ellipse cx="25" cy="10" rx="6" ry="18" fill="#fff" stroke="#e2d4e8" stroke-width="2"/><ellipse cx="45" cy="10" rx="6" ry="18" fill="#fff" stroke="#e2d4e8" stroke-width="2"/><circle cx="35" cy="36" r="22" fill="#fff" stroke="#e2d4e8" stroke-width="2"/><circle cx="27" cy="33" r="3" fill="#c0395a"/><circle cx="43" cy="33" r="3" fill="#c0395a"/><path d="M31 42 q4 4 8 0" stroke="#c0395a" stroke-width="2" fill="none"/><ellipse cx="21" cy="40" rx="4" ry="2.4" fill="#ffc6df"/><ellipse cx="49" cy="40" rx="4" ry="2.4" fill="#ffc6df"/><rect x="16" y="56" width="38" height="26" rx="10" fill="#a8eadf"/>' },
    { name: 'ユニコーンさん', size: 12, w: 2, svg: '<path d="M35 -6 l7 26 h-14 z" fill="#fff0a0" stroke="#f2c94c" stroke-width="1.5" stroke-linejoin="round"/><path d="M32.5 3 l6 3 M31 10 l9 3" stroke="#f2c94c" stroke-width="1.5" stroke-linecap="round"/><ellipse cx="17" cy="20" rx="5" ry="9" fill="#fff" stroke="#e2d4e8" stroke-width="2" transform="rotate(-20 17 20)"/><ellipse cx="53" cy="20" rx="5" ry="9" fill="#fff" stroke="#e2d4e8" stroke-width="2" transform="rotate(20 53 20)"/><circle cx="35" cy="38" r="21" fill="#fff" stroke="#e2d4e8" stroke-width="2"/><path d="M16 30 q-6 -14 8 -16 q6 -8 14 -2 q10 -6 16 4 q-12 0 -18 6 q-8 -4 -20 8z" fill="#ffb3d9"/><path d="M22 18 q6 -4 12 0" stroke="#c9b3ff" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M38 16 q6 -2 10 3" stroke="#a8eadf" stroke-width="4" fill="none" stroke-linecap="round"/><circle cx="27" cy="38" r="2.6" fill="#6b4a8a"/><circle cx="43" cy="38" r="2.6" fill="#6b4a8a"/><ellipse cx="22" cy="45" rx="4" ry="2.4" fill="#ffc6df"/><ellipse cx="48" cy="45" rx="4" ry="2.4" fill="#ffc6df"/><path d="M32 47 q3 3 6 0" stroke="#6b4a8a" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M16 86 q0 -26 19 -26 q19 0 19 26z" fill="#c9b3ff"/><path d="M30 61 l5 6 l5 -6" fill="#fff"/>' },
  ];
  const custSvg = (c) => '<svg viewBox="0 0 70 86" aria-hidden="true">' + c.svg + '</svg>';
  // ドーナツ(アイシングの いろは じゅんばんに かわる)
  const ICING = ['#ffb3d9', '#c9b3ff', '#a8eadf', '#fff0a0', '#ffc9a8', '#b3dcff'];
  const SPR = ['#7ad3ff', '#ffe066', '#b98cff', '#ff8fc4'];
  const donut = (k) => '<svg viewBox="-14 -14 28 28" aria-hidden="true"><circle r="13" fill="#e7b27a"/><path d="M-12 -2 a12 12 0 0 1 24 0 q-3 4 -6 1 q-3 5 -6 1 q-3 5 -6 0 q-3 4 -6 0z" fill="' + ICING[k % 6] + '"/><circle r="4.5" fill="#fff4ea"/>' + [[-7, -6], [5, -8], [8, -2], [-9, 0]].map(([a, b], i) => '<rect x="' + a + '" y="' + b + '" width="4" height="1.6" rx=".8" fill="' + SPR[(i + k) % 4] + '" transform="rotate(30 ' + a + ' ' + b + ')"/>').join('') + '</svg>';
  function pickCust(prev) {
    const pool = CUST.filter((c) => c !== prev), tot = pool.reduce((a, c) => a + c.w, 0);
    let r = Math.random() * tot; for (const c of pool) { r -= c.w; if (r < 0) return c; } return pool[0];
  }

  // ---- え(ゆび) ----
  function handsSvg(up, need) {                                     // 両手(てのひらを みせる むき。おやゆびは そとがわ)。ひとさしゆび → なか → くすり → こ → おやゆび の じゅんに たつ(左手が先、つぎに右手)
    const RANK = [4, 0, 1, 2, 3];                                   // [おや, ひとさし, なか, くすり, こ] が なんばんめに たつか
    const FING = [null, [33, 66, 18, 7], [11, 76, 19, 2], [-11, 69, 18, -3], [-32, 52, 15, -9]];   // [そとがわへの よこいち, ながさ, ふとさ, かたむき(そと +)]
    const feet = need > 10 && up > 10;                              // 10を こえると、あしの ゆびも つかう
    const SK = '#d99a66', FL = '#ffb070', PM = '#ffd9b8';
    let s = '<svg viewBox="0 0 400 ' + (feet ? 340 : 215) + '" aria-label="りょうて">';
    [[110, 1], [290, -1]].forEach(([cx, side], h) => {
      const o = -side;                                              // そとがわの むき(左手 = ひだり)
      let g = '<rect x="' + (cx - 28) + '" y="165" width="56" height="45" rx="12" fill="' + PM + '" stroke="' + SK + '" stroke-width="2"/>';   // てくび
      let fold = '';                                                 // まげている ゆび(てのひらの うえに かぶせる)
      for (let k = 1; k < 5; k++) {
        const [dx, len, wd, lean] = FING[k], x = cx + o * dx, y0 = 114;
        if (!(h * 5 + RANK[k] < up)) {                               // まだ かぞえていない ゆびは、まげて てのひらに たおしておく
          fold += '<g transform="rotate(' + (-o * lean * 0.4) + ' ' + x + ' ' + y0 + ')"><line x1="' + x + '" y1="' + (y0 + 2) + '" x2="' + x + '" y2="' + (y0 + 26) + '" stroke="' + SK + '" stroke-width="' + (wd + 4) + '" stroke-linecap="round"/><line x1="' + x + '" y1="' + (y0 + 2) + '" x2="' + x + '" y2="' + (y0 + 26) + '" stroke="#ffc08a" stroke-width="' + wd + '" stroke-linecap="round"/><path d="M' + (x - wd * 0.3) + ' ' + (y0 + 8) + ' h' + (wd * 0.6) + '" stroke="#e39a62" stroke-width="1.6" stroke-linecap="round"/><ellipse cx="' + x + '" cy="' + (y0 + 22) + '" rx="' + (wd * 0.3) + '" ry="' + (wd * 0.36) + '" fill="#fff0ea" stroke="#e8b89a" stroke-width="1"/></g>';
          continue;
        }
        const rise = false;                                            // たてる とちゅうの うごきは なし
        g += '<g transform="rotate(' + (o * lean) + ' ' + x + ' ' + y0 + ')"><g' + (rise ? ' class="rise"' : '') + '><line x1="' + x + '" y1="' + y0 + '" x2="' + x + '" y2="' + (y0 - len) + '" stroke="' + SK + '" stroke-width="' + (wd + 4) + '" stroke-linecap="round"/><line x1="' + x + '" y1="' + y0 + '" x2="' + x + '" y2="' + (y0 - len) + '" stroke="' + FL + '" stroke-width="' + wd + '" stroke-linecap="round"/>' +
          [0.4, 0.7].map((t) => '<path d="M' + (x - wd * 0.28) + ' ' + (y0 - len * t) + ' h' + (wd * 0.56) + '" stroke="#e39a62" stroke-width="1.6" stroke-linecap="round"/>').join('') + '</g></g>';
      }
      if (h * 5 + RANK[0] < up) {                                  // おやゆび(てのひらの そとがわから でる。2つの ふし)
        const bx = cx + o * 34, by = 156, jx = bx + o * 26, jy = by - 16, tx = jx + o * 17, ty = jy - 22;
        const pl = bx + ',' + by + ' ' + jx + ',' + jy + ' ' + tx + ',' + ty, rise = h * 5 === up - 1 - (RANK[0] - 0) + 0 && false;
        g += '<g' + '' + '><polyline points="' + pl + '" fill="none" stroke="' + SK + '" stroke-width="32" stroke-linecap="round" stroke-linejoin="round"/><polyline points="' + pl + '" fill="none" stroke="' + FL + '" stroke-width="28" stroke-linecap="round" stroke-linejoin="round"/><path d="M' + (jx - 7) + ' ' + (jy + 2) + ' l14 -4" stroke="#e39a62" stroke-width="1.6" stroke-linecap="round" transform="rotate(' + (o * 12) + ' ' + jx + ' ' + jy + ')"/></g>';
      } else {                                                       // まげた おやゆびは、てのひらに たおす
        fold += '<line x1="' + (cx + o * 34) + '" y1="158" x2="' + (cx + o * 4) + '" y2="164" stroke="' + SK + '" stroke-width="30" stroke-linecap="round"/><line x1="' + (cx + o * 34) + '" y1="158" x2="' + (cx + o * 4) + '" y2="164" stroke="#ffc08a" stroke-width="26" stroke-linecap="round"/><ellipse cx="' + (cx + o * 6) + '" cy="163" rx="8" ry="9" fill="#fff0ea" stroke="#e8b89a" stroke-width="1"/>';
      }
      g += '<rect x="' + (cx - 46) + '" y="100" width="92" height="82" rx="34" fill="' + PM + '" stroke="' + SK + '" stroke-width="2"/>';   // てのひら
      const nUp = [0, 1, 2, 3, 4].filter((q) => h * 5 + q < up).length;
      if (nUp === 5) {        g += '<path d="M' + (cx - o * 30) + ' 136 Q' + cx + ' 152 ' + (cx + o * 22) + ' 150 M' + (cx - o * 26) + ' 118 Q' + (cx - o * 4) + ' 130 ' + (cx + o * 24) + ' 130" fill="none" stroke="#e8b890" stroke-width="2" stroke-linecap="round"/>';   // てのひらの すじ
      }
      g += fold;
      s += g;
    });
    if (feet) {                                                      // あし(うえから みた ほんものらしい かたち)。かぞえた あしの ゆびは オレンジに なる(はなさない)
      const FOOT = 'M-2 54 C-18 54 -23 40 -22 24 C-21 6 -33 -4 -32 -22 C-31 -30 -18 -32 -6 -31 C8 -33 22 -33 31 -26 C34 -4 17 8 16 26 C16 42 12 54 -2 54 Z';   // かかと・ほそい ふみつけず・ひろい まえあし
      const TOE = [[22, -42, 12, 14], [7, -44, 8, 9.5], [-5, -40, 7.5, 9], [-16, -35, 7, 8.5], [-26, -28, 6.5, 8]];   // [よこ, たて, はば(はんけい), たかさ(はんけい)] おや → こ
      [[142, 1], [258, -1]].forEach(([cx, side], h) => {
        let toes = '', curl = '';
        TOE.forEach(([x, y, rx, ry], k) => {
          const on = 10 + h * 5 + k < up;
          if (on) toes += '<ellipse cx="' + x + '" cy="' + y + '" rx="' + rx + '" ry="' + ry + '" fill="' + FL + '" stroke="' + SK + '" stroke-width="2"/>';   // たてた ゆび: のびて オレンジ
          else curl += '<ellipse cx="' + x + '" cy="' + (y + ry * 0.95) + '" rx="' + (rx * 0.92) + '" ry="' + (ry * 0.5) + '" fill="' + PM + '" stroke="' + SK + '" stroke-width="2"/><ellipse cx="' + x + '" cy="' + (y + ry * 0.95) + '" rx="' + (rx * 0.45) + '" ry="' + (ry * 0.2) + '" fill="#fff0ea" stroke="#e8b89a" stroke-width="1"/>';   // とじた ゆび: まえあしに まるまって つめだけ みえる
        });
        s += '<g transform="translate(' + cx + ' 268) scale(' + (side * 1.1) + ' 1.1)">' + toes + '<path d="' + FOOT + '" fill="' + PM + '" stroke="' + SK + '" stroke-width="2" stroke-linejoin="round"/>' + curl + '</g>';
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
      const u = new SpeechSynthesisUtterance(String(n)); u.lang = 'ja-JP'; u.rate = 1.25;
      const v = speechSynthesis.getVoices().find((x) => /^ja/i.test(x.lang)); if (v) u.voice = v;
      speechSynthesis.speak(u);
    }, 110);
  }

  // ---- せいこう・しっぱいの おおきな え(おきゃくさん・くまさんが でる) ----
  function fx(host, kind, c, title, sub) {
    const old = host.querySelector('.fx'); if (old) old.remove();
    const el = document.createElement('div'); el.className = 'fx ' + kind;
    const ok = kind === 'ok';
    const ems = ok ? ['⭐', '❤️', '✨', '⭐', '❤️', '✨'] : ['💦', '❌', '💦', '💧', '❌', '💧'];
    el.innerHTML = '<div class="big">' + custSvg(c) + ems.map((e, i) => '<span class="em e' + i + '">' + e + '</span>').join('') + '</div><div class="fxt">' + title + '</div>' + (sub ? '<div class="fxs">' + sub + '</div>' : '');
    host.appendChild(el); setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 400); }, ok ? 1500 : 1700);
  }
  // ---- じょうたい ----
  let fill = 0, cust = CUST[0], busy = false, sold = [], partyUntil = 0, need = 10, streak = 0;
  const MAXF = 14;                                                  // おけるのは 14こまで
  function render(newEgg) {
    const s = need, slots = Math.max(s, fill);
    $('num').textContent = fill; $('yomi').textContent = yomi(fill); $('packsize').textContent = (s === cust.size ? s + 'こ いりの はこ' + (s === 12 ? '(1ダース)' : '') : s + 'こ');
    const partying = Date.now() < partyUntil;
    $('counter').innerHTML = handsSvg(partying ? s : fill, Math.max(s, fill));
    $('counter').classList.toggle('party', partying);
    const pl = $('plate'); pl.innerHTML = ''; pl.style.gridTemplateColumns = 'repeat(' + Math.ceil(s / 2) + ', 36px)';
    for (let i = 0; i < s; i++) {                                    // はこの なかは「ほしい かず」ぶんだけ
      const sl = document.createElement('span'); sl.className = 'slot';
      if (i < fill) sl.innerHTML = '<span class="egg' + (newEgg && i === fill - 1 ? ' new' : '') + '">' + donut(i) + '</span>';
      pl.appendChild(sl);
    }
    let sp = $('spill'); if (!sp) { sp = document.createElement('div'); sp.id = 'spill'; sp.className = 'spill'; pl.parentNode.insertBefore(sp, pl.nextSibling); }
    sp.innerHTML = ''; sp.style.display = fill > s ? 'flex' : 'none';   // はいらない ぶんは はこの そとへ
    for (let i = s; i < fill; i++) { const e = document.createElement('span'); e.className = 'slot spill1'; e.innerHTML = '<span class="egg' + (newEgg && i === fill - 1 ? ' new' : '') + '">' + donut(i) + '</span>'; sp.appendChild(e); }
    if (fill > s) { const t = document.createElement('span'); t.className = 'spillt'; t.textContent = 'はこから はみだし ' + (fill - s) + 'こ'; sp.appendChild(t); }
    $('cSold').textContent = sold.length; $('cSoldEggs').textContent = sold.reduce((a, x) => a + x, 0);
    const box = $('sold'); box.innerHTML = '';
    sold.slice(-14).forEach((sz, i, arr) => { const e = document.createElement('span'); e.className = 'mini s' + sz + (i === arr.length - 1 && partying ? ' new' : ''); e.title = sz + 'こ いり'; box.appendChild(e); });
    if (sold.length > 14) { const m = document.createElement('span'); m.className = 'more'; m.textContent = '…'; box.prepend(m); }
  }
  function showCust(first) {
    const el = $('cust'); el.innerHTML = custSvg(cust);
    el.classList.remove('dance', 'out', 'in'); void el.offsetWidth; el.classList.add('in');
    const box = need === cust.size, tx = need + 'こ ' + (box ? 'いりの はこ' : '') ;
    $('bubble').innerHTML = '<b>' + need + '</b>こ ください！';
    $('say').textContent = 'ちょうどの かずに なったら、おきゃくさんを おしてね';
    $('streak').textContent = streak ? 'ぴったり ' + streak + 'かい れんぞく！' : '';
    if (!first) sayWords(need + 'こ ください');
  }
  function sayWords(t) {
    if (!voiceOn || !window.speechSynthesis) return;
    clearTimeout(speakTimer); speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(t); u.lang = 'ja-JP'; u.rate = 1.05;
    const v = speechSynthesis.getVoices().find((x) => /^ja/i.test(x.lang)); if (v) u.voice = v;
    speechSynthesis.speak(u);
  }

  function addEgg() {
    if (busy) return false;
    if (fill >= MAXF) { $('say').textContent = 'もう おけないよ。ならんだ ドーナツを おして へらそう'; return false; }
    fill++; lastLay = Date.now();
    const num = $('num'); num.classList.remove('bump'); void num.offsetWidth; num.classList.add('bump');
    sFinger(Math.min(fill, 10));
    // ぴったりかは、おしえない(かずを くらべるのが ゲーム)。かずを よんで、いまの かずだけ つたえる
    $('say').textContent = fill <= 10 ? 'いま ' + fill + 'こ。ゆびが ' + fill + 'ほん' : 'いま ' + fill + 'こ。あしの ゆびも つかったよ';
    render(true); speak(fill);
    return true;
  }
  // 「どうぞ」: かずが ぴったりなら うれる。たりない・おおいは おしえてくれる
  let lastLay = 0;
  function give() {
    if (busy) return;
    if (Date.now() - lastLay < 450) return;                           // れんだ ちゅうの まちがいタップで うれて しまわない
    const c = $('cust');
    if (fill === need) {
      busy = true; sParty(); partyUntil = Date.now() + 900; streak++;
      $('say').textContent = 'ぴったり！ ' + cust.name + 'に わたしたよ'; render(true); speak(fill);
      fx($('play'), 'ok', cust, 'ありがとう！', 'ぴったり ' + need + 'こ');
      $('streak').textContent = 'ぴったり ' + streak + 'かい れんぞく！';
      c.classList.remove('in'); void c.offsetWidth; c.classList.add('dance');
      const s = fill;
      setTimeout(() => {
        for (let i = 0; i < 6; i++) tone(1568 + (i % 2) * 300, i * 0.07, 0.12, 'triangle', 0.12);   // チャリン
        sold.push(s); fill = 0; c.classList.remove('dance'); void c.offsetWidth; c.classList.add('out');
        $('bubble').textContent = 'ありがとう！'; render();
      }, 1000);
      setTimeout(() => { cust = pickCust(cust); need = pickNeed(cust); busy = false; showCust(); render(); }, 1600);
      return;
    }
    streak = 0; $('streak').textContent = '';
    tone(220, 0, 0.25, 'sine', 0.3, 0.7);
    c.classList.remove('in', 'dance'); void c.offsetWidth; c.classList.add('dance');
    const msg = fill < need ? 'まだ たりないよ！ もっと ほしい' : 'おおいよ！ ならんだ ドーナツを おして へらしてね';
    $('say').textContent = cust.name + '「' + msg + '」'; $('bubble').innerHTML = '<b>' + need + '</b>こ ください！';
    sayWords(fill < need ? 'まだ たりないよ' : 'おおいよ');
    fx($('play'), 'ng', cust, fill < need ? 'たりないよ…' : 'おおいよ…', 'いま ' + fill + 'こ ・ ほしいのは ' + need + 'こ');
  }
  // おきゃくさんの ちゅうもん: その おきゃくさんの はこの おおきさ(6・10・12)
  function pickNeed(c) { return c.size; }                                  // おきゃくさんごとに、ほしい はこは きまっている(くまさん10・うさぎさん6・ユニコーンさん12)

  function chick() {                                                // ときどき ひよこが あそびに くる(かずとは かんけい ない)
    const c = document.createElement('span'); c.className = 'chick'; c.textContent = '🐥';
    const play = $('play'), field = play.querySelector('.store');
    c.style.left = '-40px'; c.style.top = (field.offsetTop - 10) + 'px';
    play.appendChild(c);
    tone(1200, 0, 0.08, 'sine', 0.15); tone(1500, 0.1, 0.08, 'sine', 0.15);
    setTimeout(() => c.remove(), 2400);
  }

  // オーブンの まどに、やけた ドーナツを ならべる(からっぽに みえない ように)
  (function () { const g = document.querySelector('.ovenglow'); if (!g) return; g.innerHTML = [0, 1, 2].map((i) => '<g transform="translate(' + (37 + i * 22) + ' 71)">' + donut(i + 2).replace('<svg ', '<svg style="width:22px;height:22px" width="22" height="22" ') + '</g>').join(''); })();
  // ---- え を おす(オーブン = ドーナツが やける、おみせ = おきゃくさんが ちゅうもんを もういちど いう) ----
  const hen = $('hen');
  function hitAnim(el) { el.classList.remove('hit'); void el.offsetWidth; el.classList.add('hit'); }
  function lay() {
    hitAnim(hen); $('finger').style.display = 'none';
    tone(1320, 0, 0.12, 'sine', 0.12); tone(1760, 0.03, 0.18, 'sine', 0.06);          // チン(やけた)
    if (!addEgg()) return;
    const e = document.createElement('span'); e.className = 'flyegg'; e.innerHTML = donut(fill - 1);
    const r = hen.getBoundingClientRect(), pr = $('play').getBoundingClientRect();
    e.style.left = (r.left - pr.left + r.width * 0.55) + 'px'; e.style.top = (r.top - pr.top + r.height * 0.55) + 'px';
    e.style.setProperty('--dx', (20 + Math.random() * 30) + 'px');
    $('play').appendChild(e); setTimeout(() => e.remove(), 450);
  }
  let holdT = null, holdI = null, speed = 200;
  function stopHold() { clearTimeout(holdT); clearTimeout(holdI); holdT = holdI = null; }
  function loop() { lay(); speed = Math.max(70, speed * 0.9); holdI = setTimeout(loop, speed); }
  hen.addEventListener('pointerdown', (e) => { e.preventDefault(); lay(); });   // おしっぱなしで ふえる しくみは なし(れんだで クリアできないように)
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((t) => hen.addEventListener(t, stopHold));
  hen.addEventListener('click', (e) => { if (e.detail === 0) lay(); });   // キーボード(Enter・スペース)
  hen.addEventListener('contextmenu', (e) => e.preventDefault());
  $('plate').addEventListener('click', (e) => { if (busy || fill <= 0) return; fill--; tone(300, 0, 0.1, 'sine', 0.15); render(); speak(fill); });   // ならんだ ドーナツを おすと へる
  document.addEventListener('click', (e) => { if (!e.target.closest('#spill')) return; if (busy || fill <= 0) return; fill--; tone(300, 0, 0.1, 'sine', 0.15); render(); speak(fill); });   // はこから はみだした ドーナツも おすと へる
  $('cust').addEventListener('click', give); $('shop').addEventListener('click', give);   // おきゃくさんを おして わたす
  $('reset').onclick = () => { stopHold(); fill = 0; sold = []; busy = false; partyUntil = 0; cust = CUST[0]; need = cust.size; streak = 0; showCust(true); render(); };
  $('voice').onclick = () => { voiceOn = !voiceOn; $('voice').textContent = voiceOn ? '🗣 こえ あり' : '🤐 こえ なし'; if (!voiceOn && window.speechSynthesis) speechSynthesis.cancel(); };
  // ---- たべちゃう くまさん: 「のこりを ○こに して、ストップ！」。たべすぎると しっぱい ----
  let eBox = 10, eOver = 2, eBusy = false, eTarget = 10, eLock = false, eStreak = 0;
  $('eBear').innerHTML = custSvg(CUST[0]);
  $('eCmp1').innerHTML = donut(0);
  function eRender() {
    const n = eBox + eOver;
    $('eNum').textContent = n; $('eYomi').textContent = yomi(n);
    $('eHands').innerHTML = handsSvg(n, 13);
    $('eBoxN').textContent = eBox; $('eOverN').textContent = eOver;
    $('eGrid').innerHTML = '';
    for (let i = 0; i < 10; i++) { const sl = document.createElement('span'); sl.className = 'eslot'; if (i < eBox) sl.innerHTML = '<span class="tdn">' + donut(i) + '</span>'; $('eGrid').appendChild(sl); }
    $('eOver').innerHTML = '';
    for (let i = 0; i < eOver; i++) { const e = document.createElement('span'); e.className = 'tdn'; e.innerHTML = donut(i + 3); $('eOver').appendChild(e); }
    $('eCmp').hidden = n !== 0;
    $('eTgt').textContent = eTarget; $('eStreak').textContent = eStreak ? 'ぴったり ' + eStreak + 'かい れんぞく！' : '';
  }
  function eNew() {                                                // あたらしい もんだい: いまの かずより すくない もくひょうを えらぶ
    eBox = 10; eOver = 1 + Math.floor(Math.random() * 3); const n = eBox + eOver;
    const pool = [10, 8, 7, 5, 3, 2, 1, 0].filter((t) => t < n && t !== eTarget); eTarget = pool[Math.floor(Math.random() * pool.length)];
    eLock = false; eBusy = false; eRender();
    $('eSay').textContent = 'ドーナツを おして たべさせて、のこりが ' + eTarget + 'こに なったら くまさんを おしてね';
    sayWords('のこりを ' + yomi(eTarget) + 'こに しよう');
  }
  function eat() {
    if (eBusy || eLock) return;
    if (eBox + eOver === 0) return;
    eBusy = true;
    const el = eOver > 0 ? $('eOver').lastElementChild : $('eGrid').children[eBox - 1].firstElementChild;
    if (el) el.classList.add('eaten');
    const b = $('eBear'); $('eFinger').style.display = 'none'; b.classList.remove('chew'); void b.offsetWidth; b.classList.add('chew');
    tone(300, 0, 0.08, 'sine', 0.2); tone(260, 0.14, 0.08, 'sine', 0.2);   // もぐもぐ
    setTimeout(() => {
      if (eOver > 0) eOver--; else eBox--;
      const n = eBox + eOver;
      eRender();
      if (n < eTarget) {                                           // たべすぎ
        eLock = true; eStreak = 0; eRender(); tone(200, 0, 0.35, 'sine', 0.3, 0.6);
        fx($('eHost'), 'ng', CUST[0], 'たべすぎだよ！', 'おやに おこられた');
        $('eSay').textContent = 'たべすぎだよ、おやに おこられた';
        sayWords('たべすぎだよ'); setTimeout(eNew, 2200);
      } else {
        let t = 'のこり ' + n + 'こ。' + eTarget + 'こまで あと ' + (n - eTarget) + 'こ';
        if (n === eTarget) t = 'のこり ' + n + 'こ。ほしかった かずかな？ そうなら くまさんを おしてね';
        else if (n === 10 && eTarget < 10) t += '(はこ 1つと はみだし 0こ。だから 10)';
        else if (n === 1 && eTarget < 1) t += '';
        $('eSay').textContent = t; speak(n);
      }
      eBusy = false;
    }, 320);
  }
  function eStop() {
    if (eBusy || eLock) return;
    const n = eBox + eOver;
    if (n === eTarget) {
      eLock = true; eStreak++; eRender(); sParty();
      const bb = $('eBear'); bb.classList.remove('full', 'chew'); void bb.offsetWidth; bb.classList.add('full'); setTimeout(() => bb.classList.remove('full'), 2100);   // まんぷくで おどる
      fx($('eHost'), 'ok', CUST[0], eStreak >= 2 ? 'すごいね！' : 'ぴったり！', eStreak >= 2 ? 'おやが ほめてくれた(' + eStreak + 'かい れんぞく)' : 'のこり ' + n + 'こ');
      $('eSay').textContent = (eStreak >= 2 ? 'おや「すごいね！」 ' : '') + 'ぴったり！ くまさんは まんぷく。のこり ' + n + 'こ' + (n === 0 ? '(なにも ない ときは 0)' : '');
      sayWords(eStreak >= 2 ? 'すごいね。ぴったり' : 'ぴったり');
      setTimeout(eNew, 2200);
    } else {
      eStreak = 0; eRender();                                       // まだ たべる かずが すくない: おおげさな はんのうは しない。くまが もっと たべたそうに ゆれるだけ
      const b = $('eBear'); b.classList.remove('hungry'); void b.offsetWidth; b.classList.add('hungry');
      tone(520, 0, 0.12, 'sine', 0.1); tone(440, 0.14, 0.16, 'sine', 0.1);
      $('eSay').textContent = 'くまさんは まだ たべたそう。いま ' + n + 'こ。' + eTarget + 'こに したい';
    }
  }
  $('eBear').onclick = eStop;                                       // くまさんを おす = ストップ(これで きめる)
  $('eHost').addEventListener('click', (e) => { if (e.target.closest('.ebox, .eover')) eat(); });   // はこ・はみだしの わく ぜんぶが おせる(ドーナツに ぴったり あてなくて いい)
  eTarget = 5; eNew();

  // 10こ いりの はこ: ふたを あけて、なかの 10こ(5こ×2れつ)が みえる かたち。したに「10」
  const box10 = (cls) => '<span class="tbox10' + (cls ? ' ' + cls : '') + '"><span class="g">' + Array.from({ length: 10 }, (_, i) => '<span class="tdn">' + donut(i) + '</span>').join('') + '</span><span class="lb">10</span></span>';
  // ---- ドーナツパーティー: いわれた かずを、10こ いりの はこと ばらで そろえる。そろったら ドーナツ パーティー ----
  let tBox = 0, tOne = 0, tTimer = null, target = 23, partying2 = false, tLevel = 0;   // tLevel: クリアした かい。15かいで 99まで ひろがる
  const n2 = () => tBox * 10 + tOne;
  function newTarget(silent) {
    const top = tLevel >= 15 ? 99 : 59;                          // 15かい クリアするまでは 10〜59、そのあとは 10〜99 の ランダム
    let t; do { t = 10 + Math.floor(Math.random() * (top - 9)); } while (t === target);
    target = t; tBox = 0; tOne = 0;
    $('tgT').textContent = Math.floor(t / 10); $('tgO').textContent = t % 10;
    tRender(); tSay('「' + t + 'こ ちょうだい！」 はこと ドーナツを おして そろえよう'); if (!silent) sayWords(yomi(t) + 'こ ちょうだい');
  }
  function tRender(fx) {
    fx = fx || {};
    $('tBoxes').innerHTML = '';
    for (let i = 0; i < tBox; i++) {
      const e = document.createElement('span'); e.className = 'tbwrap' + (fx.newBox && i === tBox - 1 ? ' new' : ''); e.innerHTML = box10();
      e.title = 'おすと へる'; e.onclick = () => { if (partying2 || tTimer) return; tBox--; tRender(); bump('tTens'); after(); };
      $('tBoxes').appendChild(e);
    }
    $('tLoose').innerHTML = '';
    for (let i = 0; i < tOne; i++) {
      const e = document.createElement('span'); e.className = 'tdn' + (fx.newOne && i === tOne - 1 ? ' new' : ''); e.innerHTML = donut(i);
      e.onclick = () => { if (partying2 || tTimer) return; tOne--; tRender(); bump('tOnes'); after(); };
      $('tLoose').appendChild(e);
    }
    $('tTens').textContent = tBox; $('tOnes').textContent = tOne;
    $('tTens').classList.toggle('zero', tBox === 0);
    $('tYomi').textContent = yomi(n2());
  }
  const bump = (id) => { const e = $(id); e.classList.remove('bump'); void e.offsetWidth; e.classList.add('bump'); };
  function tSay(t) { $('tSay').textContent = t; }
  function after() {                                               // かずを くらべる
    const n = n2();
    if (n === target) { party(); return; }
    if (n > target) tSay('おおすぎる！ ならんだ ものを おして へらそう(いま ' + n + 'こ)');
    else tSay('いま ' + n + 'こ。' + target + 'こまで あと ' + (target - n) + 'こ');
    speak(n);
  }
  function party() {                                               // みんなで ドーナツ パーティー
    partying2 = true; tLevel++; tSay('ぴったり ' + target + 'こ！');
    // はこが おおいほど、なかまが ふえる(はこの かず+1にん、さいていでも 2にん)
    const members = Math.max(2, tBox + 1);
    let crew = '';
    for (let i = 0; i < members; i++) crew += '<div class="pc" style="animation-delay:' + (i % 4) * 0.1 + 's">' + custSvg(CUST[i % CUST.length]) + '</div>';
    $('pcrew').innerHTML = crew; $('pcrew').classList.toggle('many', members > 4);
    // そろえた かず(おおきな すうじ)と、はこ・ばらの ならび
    $('pNum').innerHTML = '<span class="tt">' + Math.floor(target / 10) + '</span><span class="to">' + target % 10 + '</span><small>こ</small>';
    $('pYomi').textContent = 'はこ ' + tBox + 'つ と ばら ' + tOne + 'こ で ' + target + 'こ';
    let lay = '';
    for (let i = 0; i < tBox; i++) lay += box10('sm');
    for (let i = 0; i < tOne; i++) lay += '<span class="tdn">' + donut(i) + '</span>';
    $('pLay').innerHTML = lay;
    $('party').hidden = false;
    const box = $('party'), colors = ['#ffb3d9', '#c9b3ff', '#a8eadf', '#fff0a0', '#ffc9a8', '#b3dcff'];
    // ---- かずが おおきいほど はでに(30だい: かみふぶき ふえる / 50だい いじょう: はなび と ドーナツタワー(はこの かずだけ たかく)) ----
    // 10の くらいが あがるごとに、1つずつ ふえる: 20だい かみふぶき / 30だい はなび / 40だい はなび おおく / 50だい タワー / 60だい おおきな ドーナツ / 80だい ながれぼし
    const lv = Math.floor(target / 10), fwN = lv < 3 ? 0 : lv === 3 ? 2 : lv === 4 ? 4 : lv < 9 ? 5 : 7;
    // ドーナツタワー(50だい いじょう): はこの かずだけ ドーナツが つみあがる。かずが おおきいほど たかい
    $('pSpecial').hidden = lv < 5; $('pSpecial').textContent = 'ドーナツタワー ' + tBox + 'だん！';
    if (lv >= 5) [6, null].forEach((left, side) => {
      const tw = document.createElement('div'); tw.className = 'ptower'; if (side) tw.style.right = '6px'; else tw.style.left = '6px';
      for (let k = 0; k < tBox; k++) { const d = document.createElement('div'); d.className = 'ptd'; d.style.animationDelay = (0.2 + k * 0.18) + 's'; d.innerHTML = donut(k + side * 3); tw.appendChild(d); }
      box.appendChild(tw);
    });
    if (lv >= 6) {                                                // おおきな ドーナツが ぽんと でてくる(かずが おおきいほど おおきい)
      const bd = document.createElement('div'); bd.className = 'bigd'; const sz = 80 + (Math.min(lv, 9) - 6) * 20; bd.style.width = bd.style.height = sz + 'px'; bd.style.marginLeft = (-sz / 2) + 'px'; bd.innerHTML = donut(target); box.appendChild(bd);
    }
    if (lv >= 8) for (let k = 0; k < (lv === 8 ? 3 : 6); k++) {    // キラキラ ドーナツの ながれぼし
      const st = document.createElement('div'); st.className = 'shoot'; st.innerHTML = '<span class="tail"></span>' + donut(k + 1);
      st.style.top = (4 + (k * 37) % 30) + '%'; st.style.animationDelay = (0.5 + k * 0.7) + 's'; box.appendChild(st);
    }
    if (fwN > 0) {                                                 // はなび
      const fc = ['#ff6fb5', '#ffd23f', '#6ad1ff', '#9d7bff', '#7be0a5', '#ff9a4c'];
      for (let b = 0; b < fwN; b++) setTimeout(() => {
        if ($('party').hidden) return;
        const cx = 15 + Math.random() * 70, cy = 12 + Math.random() * 35, col = fc[b % 6];
        for (let k = 0; k < 16; k++) {
          const p = document.createElement('span'); p.className = 'fw'; const a = k / 16 * Math.PI * 2, r = 50 + Math.random() * 30;
          p.style.left = cx + '%'; p.style.top = cy + '%'; p.style.background = col; p.style.setProperty('--dx', Math.cos(a) * r + 'px'); p.style.setProperty('--dy', Math.sin(a) * r + 'px');
          box.appendChild(p);
        }
        tone(180 + Math.random() * 60, 0, 0.12, 'sawtooth', 0.12, 0.4); clap(0.04);       // ドーン
      }, 300 + b * 520);
    }
    for (let i = 0; i < 40 + (lv >= 2 ? 40 : 0); i++) {
      const c = document.createElement('span'); c.className = 'confetti';
      c.style.left = (Math.random() * 100) + '%'; c.style.background = colors[i % 6]; c.style.animationDelay = (Math.random() * 0.8) + 's';
      box.appendChild(c);
    }
    [523.3, 659.3, 784, 659.3, 784, 1046.5, 880, 1046.5].forEach((f, i) => tone(f, i * 0.16, 0.22, 'triangle', 0.15));   // パーティーの メロディ
    for (let i = 0; i < 6; i++) clap(0.1 + i * 0.32);
    sayWords('ぴったり ' + yomi(target) + '。ドーナツ パーティー');
    setTimeout(() => { $('party').hidden = true; box.querySelectorAll('.confetti, .fw, .ptower, .bigd, .shoot').forEach((c) => c.remove()); partying2 = false; newTarget(); }, 5000);
  }
  $('tAddBox').onclick = () => {
    if (partying2 || tTimer) return;
    if (tBox >= 9) { tSay('はこは 9つまで'); return; }
    tBox++; tRender({ newBox: true }); bump('tTens');
    tone(392, 0, 0.15, 'triangle', 0.2); tone(523.3, 0.08, 0.2, 'triangle', 0.2);
    after();
  };
  $('tAddOne').onclick = () => {
    if (partying2 || tTimer) return;
    if (tBox >= 9 && tOne >= 9) { tSay('もう いっぱい'); return; }
    tOne++; tRender({ newOne: true }); bump('tOnes'); sFinger(tOne);
    if (tOne === 10) {                                             // 10こ そろったら はこに つめる
      tSay('ばらが 10こ そろった！ はこに つめよう');
      document.querySelectorAll('#tLoose .tdn').forEach((e) => e.classList.add('pack'));
      tTimer = setTimeout(() => { tTimer = null; tOne = 0; tBox++; tRender({ newBox: true }); bump('tTens'); bump('tOnes'); after(); }, 550);
      return;
    }
    after();
  };
  $('tReset').onclick = () => { if (partying2) return; clearTimeout(tTimer); tTimer = null; newTarget(); };
  $('tOneIcon').innerHTML = donut(0); $('tBoxIcon').innerHTML = box10('big');
  target = 0; newTarget(true);

  if (window.speechSynthesis) speechSynthesis.getVoices();
  need = pickNeed(cust); showCust(true);
  render();
})();
