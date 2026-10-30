// 0から？ 1から？: みの まわりの かずを、0から かぞえるものと 1から かぞえるものの はこに わける
(() => {
  const $ = (id) => document.getElementById(id);
  // start = はじまりの かず。kind = わけの みせかた(row: よこに ならぶ / tower: したから つむ / ruler: ものさし)
  const CARDS = [
    { id: 'baby', img: 'baby', q: 'うまれた ばかりの あかちゃんは なんさい？', start: 0, unit: 'さい', kind: 'row', firstImg: 'baby',
      t: 'うまれた ときは 0さい。1ねん たつと 1さい。' },
    { id: 'building', img: 'building', q: 'たてものの いちばん したは なんかい？', start: 1, unit: 'かい', kind: 'tower',
      t: 'いちばん したは 1かい。うえに のぼると 2かい、3かい。' },
    { id: 'ruler', img: 'ruler', q: 'ものさしの めもりは、なんから はじまる？', start: 0, unit: '', kind: 'ruler',
      t: 'ものさしは 0から。0の ところに はしを あわせて はかるよ。' },
    { id: 'run', img: 'run', q: 'かけっこで いちばん はやい こは なんばん？', start: 1, unit: 'ばん', kind: 'row', firstImg: 'medal',
      t: 'いちばん はやい こは 1ばん。つぎが 2ばん、3ばん。' },
    { id: 'clock', img: 'clock', q: 'よなか、ひづけが かわる ときは なんじ？', start: 0, unit: 'じ', kind: 'row', firstImg: 'moon',
      t: 'ひづけが かわる よなかは 0じ。それから 1じ、2じ…。' },
  ];
  const src = (n) => 'img/' + n + '.svg';
  let order = [], idx = 0, cur = null, busy = false, voiceOn = true;

  function say(t) {
    if (!voiceOn || !window.speechSynthesis) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(t); u.lang = 'ja-JP'; u.rate = 0.9;
    const v = speechSynthesis.getVoices().find((x) => /^ja/i.test(x.lang)); if (v) u.voice = v;
    speechSynthesis.speak(u);
  }

  // ---- わけ: かずの ならびを みせる(さいしょの かずに いろ) ----
  function cell(n, c, first) {
    const d = document.createElement('div'); d.className = 'cell' + (first ? ' first' : '');
    d.innerHTML = (first && c.firstImg ? '<img src="' + src(c.firstImg) + '" alt="">' : '') + '<div class="n num">' + n + '</div><div class="u">' + c.unit + '</div>';
    return d;
  }
  function showWhy(c) {
    const w = $('why'); w.innerHTML = '';
    if (c.kind === 'ruler') {
      // ものさし: めもりと かず(0〜5)
      let s = '<svg class="ruler" viewBox="0 0 320 62" aria-hidden="true"><rect x="8" y="8" width="304" height="46" rx="6" fill="#ffe9a8" stroke="#e8c25a" stroke-width="2"/>';
      for (let i = 0; i <= 50; i++) {
        const x = 20 + i * 5.6, h = i % 10 === 0 ? 22 : i % 5 === 0 ? 15 : 9;
        s += '<line x1="' + x + '" y1="8" x2="' + x + '" y2="' + (8 + h) + '" stroke="#8a6a2a" stroke-width="' + (i % 10 ? 1 : 2) + '"/>';
      }
      for (let k = 0; k <= 5; k++) {
        const x = 20 + k * 56;
        s += (k === 0 ? '<circle cx="' + x + '" cy="44" r="14" fill="#fff3e6" stroke="#e8a46a" stroke-width="3"/>' : '') +
             '<text x="' + x + '" y="52" font-size="' + (k === 0 ? 24 : 20) + '" text-anchor="middle" fill="' + (k === 0 ? '#d27a3a' : '#6b6058') + '">' + k + '</text>';
      }
      w.innerHTML = s + '</svg>';
    } else {
      const seq = document.createElement('div'); seq.className = 'seq' + (c.kind === 'tower' ? ' tower' : '');
      for (let k = 0; k < (c.kind === 'tower' ? 3 : 4); k++) {
        if (k && c.kind === 'row') { const a = document.createElement('span'); a.className = 'ar'; a.textContent = '→'; seq.appendChild(a); }
        seq.appendChild(cell(c.start + k, c, k === 0));
      }
      w.appendChild(seq);
    }
    const t = document.createElement('div'); t.className = 't'; t.textContent = c.t; w.appendChild(t);
    say(c.t);
  }

  function showCard() {
    cur = CARDS[order[idx]]; busy = false;
    const card = $('card'); card.classList.remove('toL', 'toR'); card.hidden = false;
    $('cimg').src = src(cur.img); $('q').textContent = cur.q; $('why').innerHTML = '';
    $('next').hidden = true; $('again').hidden = true;
    say(cur.q);
  }
  function start() {
    order = CARDS.map((_, i) => i).sort(() => Math.random() - 0.5); idx = 0;
    $('in0').innerHTML = ''; $('in1').innerHTML = '';
    showCard();
  }

  function pick(n) {
    if (busy || !cur) return;
    const card = $('card'), box = $('b' + n);
    if (n !== cur.start) {                                         // ちがう はこ: ゆれて、ならびを みせる(もういちど えらべる)
      card.classList.remove('shake'); box.classList.remove('no'); void card.offsetWidth;
      card.classList.add('shake'); box.classList.add('no');
      showWhy(cur);
      return;
    }
    busy = true;
    card.classList.add(n === 0 ? 'toL' : 'toR');
    setTimeout(() => {
      card.hidden = true;                                          // とんで いったら、カードの ばしょを つめる
      const im = document.createElement('img'); im.src = src(cur.img); im.alt = ''; $('in' + n).appendChild(im);
    }, 350);
    showWhy(cur);
    if (idx < order.length - 1) $('next').hidden = false;
    else setTimeout(() => { $('again').hidden = false; $('why').querySelector('.t').textContent += ' ぜんぶ わけられたね！'; }, 400);
  }

  $('b0').addEventListener('click', () => pick(0));
  $('b1').addEventListener('click', () => pick(1));
  $('next').onclick = () => { idx++; showCard(); };
  $('again').onclick = start;
  $('card').addEventListener('click', () => { if (!busy) say(cur.q); });   // カードを おすと もういちど よむ
  $('voice').onclick = () => { voiceOn = !voiceOn; $('voice').textContent = voiceOn ? 'こえ あり' : 'こえ なし'; if (!voiceOn && window.speechSynthesis) speechSynthesis.cancel(); };
  if (window.speechSynthesis) speechSynthesis.getVoices();
  start();
})();
