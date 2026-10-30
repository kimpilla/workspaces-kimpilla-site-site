// すうじの かたち: うすい すうじを ゆびで なぞると、えんぴつの せんが のこる。なぞれたら、かたちの にている イラストが でてくる
(() => {
  const $ = (id) => document.getElementById(id);
  const NAME = ['ドーナツ', 'ろうそく', 'はくちょう', 'みみ', 'ヨット', 'おんぷ', 'さくらんぼ', 'すべりだい', 'ゆきだるま', 'ふうせん'];
  const YOMI = ['ゼロ', 'いち', 'に', 'さん', 'よん', 'ご', 'ろく', 'なな', 'はち', 'きゅう'];
  const FONT = '600 {s}px "Klee One", "Hiragino Mincho ProN", serif';
  const G = 64;                                                    // なぞれたかを しらべる マスの かず(G×G)
  let digit = 2, voiceOn = true, done = new Set(), solved = false;
  let W = 0, dpr = 1, target = null, covered = null, targetCount = 0;
  const paper = $('paper'), ink = $('ink'), pc = paper.getContext('2d'), ic = ink.getContext('2d');

  // ---- かみ(ざらっとした しつかん)と、うすい すうじ ----
  function drawPaper() {
    pc.setTransform(1, 0, 0, 1, 0, 0);
    pc.fillStyle = '#fdfbf6'; pc.fillRect(0, 0, paper.width, paper.height);
    for (let i = 0; i < paper.width * paper.height / 60; i++) {       // かみの つぶつぶ
      pc.fillStyle = Math.random() < 0.5 ? 'rgba(120,100,80,0.05)' : 'rgba(255,255,255,0.6)';
      pc.fillRect(Math.random() * paper.width, Math.random() * paper.height, 1.5 * dpr, 1.5 * dpr);
    }
    // ノートの けいせん(うすい あおの よこせんと、せんの うえの てん)
    const step = paper.height / 9;
    pc.fillStyle = 'rgba(110,160,205,0.55)';
    for (let k = 1; k < 9; k++) {
      const y = Math.round(k * step);
      pc.fillRect(0, y, paper.width, Math.max(1, dpr));
      for (let x = step; x < paper.width; x += step) pc.fillRect(x - dpr, y - dpr, 2.4 * dpr, 2.4 * dpr);
    }
    pc.font = FONT.replace('{s}', Math.round(W * 0.9 * dpr));
    pc.textAlign = 'center'; pc.textBaseline = 'middle';
    pc.fillStyle = 'rgba(160,150,140,0.28)';
    pc.fillText(String(digit), paper.width / 2, paper.height * 0.53);
  }
  function makeTarget() {                                          // すうじの ある マスを しらべる
    const c = document.createElement('canvas'); c.width = c.height = G;
    const x = c.getContext('2d');
    x.font = FONT.replace('{s}', Math.round(G * 0.9)); x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillStyle = '#000'; x.fillText(String(digit), G / 2, G * 0.53);
    const d = x.getImageData(0, 0, G, G).data;
    target = new Uint8Array(G * G); targetCount = 0;
    for (let i = 0; i < G * G; i++) if (d[i * 4 + 3] > 100) { target[i] = 1; targetCount++; }
    covered = new Uint8Array(G * G);
  }

  // ---- えんぴつの せん(くっきりした 1ぽんの せんに、なまりの つぶつぶの もようを かさねる) ----
  let last = null, grain = null, grainURL = '';
  function makeGrain() {                                           // なまり(えんぴつの しん)の ざらつき
    const c = document.createElement('canvas'); c.width = c.height = 96;
    const x = c.getContext('2d'), img = x.createImageData(96, 96);
    for (let i = 0; i < 96 * 96; i++) {
      const v = 70 + Math.random() * 40;
      img.data[i * 4] = v; img.data[i * 4 + 1] = v; img.data[i * 4 + 2] = v + 6;
      img.data[i * 4 + 3] = Math.random() < 0.35 ? 30 + Math.random() * 70 : 140 + Math.random() * 90;   // ところどころ うすい = かみの めが みえる
    }
    x.putImageData(img, 0, 0);
    grain = ic.createPattern(c, 'repeat'); grainURL = c.toDataURL();   // めだまと あしにも おなじ もようを つかう
  }
  const BW = () => W * 0.042 * dpr;                                // せんの ふとさ(こどもの ゆびに あわせて ふとめ)
  let box = null;                                                 // なぞった せんの はんい(めだまと あしを つける ばしょ)
  function mark(x, y) {                                            // なぞった マスに しるし(すこし ひろめに みる)
    const h = BW() / 2;
    box = box ? { x0: Math.min(box.x0, x - h), y0: Math.min(box.y0, y - h), x1: Math.max(box.x1, x + h), y1: Math.max(box.y1, y + h) } : { x0: x - h, y0: y - h, x1: x + h, y1: y + h };
    const r = BW() * 0.9, gx = Math.floor(x / ink.width * G), gy = Math.floor(y / ink.height * G), gr = Math.ceil(r / ink.width * G);
    for (let yy = gy - gr; yy <= gy + gr; yy++) for (let xx = gx - gr; xx <= gx + gr; xx++)
      if (xx >= 0 && yy >= 0 && xx < G && yy < G) covered[yy * G + xx] = 1;
  }
  function dots(x, y) {                                            // おした ところ(まるい てん)
    ic.fillStyle = grain; ic.beginPath(); ic.arc(x, y, BW() / 2, 0, Math.PI * 2); ic.fill(); mark(x, y);
  }
  function line(a, b) {
    ic.strokeStyle = grain; ic.lineCap = 'round'; ic.lineJoin = 'round';
    ic.lineWidth = BW() * (0.92 + Math.random() * 0.12);             // ひつあつの むら
    ic.beginPath(); ic.moveTo(a.x, a.y); ic.lineTo(b.x, b.y); ic.stroke();
    const n = Math.max(1, Math.hypot(b.x - a.x, b.y - a.y) / (4 * dpr));
    for (let i = 0; i <= n; i++) mark(a.x + (b.x - a.x) * i / n, a.y + (b.y - a.y) * i / n);
  }
  const pos = (e) => { const r = ink.getBoundingClientRect(); return { x: (e.clientX - r.left) * dpr, y: (e.clientY - r.top) * dpr }; };
  ink.addEventListener('pointerdown', (e) => {
    if (solved) return;
    e.preventDefault(); ink.setPointerCapture(e.pointerId);
    last = pos(e); dots(last.x, last.y); $('hint').style.display = 'none';
  });
  ink.addEventListener('pointermove', (e) => { if (!last) return; const p = pos(e); line(last, p); last = p; });
  const up = () => { if (!last) return; last = null; check(); };
  // なぞっている あいだ、がめんが うごかない(スクロール・かくだいを しない)ように する。
  // touch-action だけでは とまらない たんまつ(ふるい iPhone など)が あるので、タッチの イベントでも とめる
  const stage = $('stage');
  ['touchstart', 'touchmove', 'touchend'].forEach((t) => stage.addEventListener(t, (e) => { if (e.cancelable) e.preventDefault(); }, { passive: false }));
  ['gesturestart', 'gesturechange', 'gestureend'].forEach((t) => stage.addEventListener(t, (e) => e.preventDefault(), { passive: false }));
  ink.addEventListener('pointerup', up); ink.addEventListener('pointercancel', up);

  function check() {
    let hit = 0;
    for (let i = 0; i < G * G; i++) if (target[i] && covered[i]) hit++;
    if (hit / targetCount >= 0.55) reward();                         // だいたい なぞれたら OK(じょうずかは みない)
  }

  // ---- できた！ ----
  let ac = null;
  function chime() {
    if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === 'suspended') ac.resume();
    [523.3, 659.3, 784, 1046.5].forEach((f, i) => {
      const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime + i * 0.09;
      o.type = 'triangle'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.2, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + 0.55);
    });
  }
  function say(t) {
    if (!voiceOn || !window.speechSynthesis) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(t); u.lang = 'ja-JP'; u.rate = 1;
    const v = speechSynthesis.getVoices().find((x) => /^ja/i.test(x.lang)); if (v) u.voice = v;
    speechSynthesis.speak(u);
  }
  function critter() {                                            // めだま(うえ)と あし 2ほん(した)。まると せんだけ
    const k = 100 / ink.width, cx = (box.x0 + box.x1) / 2 * k, top = box.y0 * k, bot = box.y1 * k;
    const P = 'url(#pencil)', u = 96 * k;                          // えんぴつの もよう(なぞった せんと おなじ)
    const eyeInk = (x) => '<circle cx="' + x + '" cy="' + (top - 4) + '" r="5.2" fill="none" stroke="' + P + '" stroke-width="1.6"/><circle cx="' + (x - 1.2) + '" cy="' + (top - 3.4) + '" r="2.6" fill="' + P + '"/>';
    const eye = (x) => '<circle cx="' + x + '" cy="' + (top - 4) + '" r="5.2" fill="#fffdf8"/>' + eyeInk(x) + eyeInk(x) + '<circle cx="' + (x - 1.9) + '" cy="' + (top - 4.3) + '" r=".8" fill="#fffdf8"/>';   // 2かい かさねて、なぞった せんと おなじ こさに
    const legInk = (x) => '<path d="M' + x + ' ' + bot + ' v10" stroke="' + P + '" stroke-width="2.6" stroke-linecap="round"/><ellipse cx="' + (x - 2.2) + '" cy="' + (bot + 10.5) + '" rx="3.6" ry="1.9" fill="' + P + '"/>';
    const leg = (x, cls) => '<g class="leg ' + cls + '">' + legInk(x) + legInk(x) + '</g>';
    $('critter').innerHTML = '<defs><pattern id="pencil" patternUnits="userSpaceOnUse" width="' + u + '" height="' + u + '"><image href="' + grainURL + '" width="' + u + '" height="' + u + '"/></pattern></defs><g class="eyes">' + eye(cx - 5.6) + eye(cx + 5.6) + '</g><g class="legs">' + leg(cx - 5, 'l') + leg(cx + 5, 'r') + '</g>';
  }
  function steps() {                                               // とことこ(あしおと)
    if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
    for (let i = 0; i < 9; i++) {
      const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime + 0.6 + i * 0.22;
      o.type = 'sine'; o.frequency.value = i % 2 ? 620 : 820;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
      o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + 0.08);
    }
  }
  let timers = [];
  function reward() {
    solved = true; done.add(digit); renderDigits();
    $('rimg').src = 'img/' + digit + '.svg'; $('rimg').alt = NAME[digit];
    critter(); $('stage').classList.add('alive');                  // めだまと あしが はえる
    chime(); steps();
    timers.push(setTimeout(() => $('runner').classList.add('walk'), 350));      // とことこ ひだりへ にげていく
    timers.push(setTimeout(() => {                                 // にげたあと、かたちの にている もの
      $('runner').style.visibility = 'hidden'; $('stage').classList.add('shown');
      $('msg').innerHTML = '<b>' + digit + '</b> は ' + NAME[digit] + 'の かたち！';
      say(YOMI[digit] + '。' + NAME[digit]);
    }, 3300));
  }

  // ---- すうじを えらぶ ----
  function renderDigits() {
    $('digits').innerHTML = '';
    for (let d = 0; d <= 9; d++) {
      const b = document.createElement('button'); b.type = 'button';
      b.className = 'dg' + (d === digit ? ' sel' : '') + (done.has(d) ? ' done' : '');
      b.textContent = d; b.setAttribute('aria-label', 'すうじ ' + d);
      b.onclick = () => setDigit(d);
      $('digits').appendChild(b);
    }
  }
  function setDigit(d) {
    digit = d; solved = false; last = null;
    timers.forEach(clearTimeout); timers = []; box = null;
    $('stage').classList.remove('alive', 'shown'); $('runner').classList.remove('walk'); $('runner').style.visibility = ''; $('critter').innerHTML = '';
    $('msg').textContent = ''; $('hint').style.display = '';
    ic.clearRect(0, 0, ink.width, ink.height);
    renderDigits(); drawPaper(); makeTarget();
    say(YOMI[d]);
  }
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = $('stage').clientWidth;
    for (const c of [paper, ink]) { c.width = Math.round(W * dpr); c.height = Math.round(W * dpr); }
    makeGrain();
    drawPaper(); makeTarget();
    if (solved) setDigit(digit);
  }
  $('clear').onclick = () => setDigit(digit);
  $('next').onclick = () => setDigit((digit + 1) % 10);
  $('reward').style.pointerEvents = 'auto'; $('reward').onclick = () => setDigit((digit + 1) % 10);
  $('voice').onclick = () => { voiceOn = !voiceOn; $('voice').textContent = voiceOn ? '🗣 こえ あり' : '🤐 こえ なし'; if (!voiceOn && window.speechSynthesis) speechSynthesis.cancel(); };
  window.addEventListener('resize', () => { if (Math.abs($('stage').clientWidth - W) > 4) resize(); });
  if (window.speechSynthesis) speechSynthesis.getVoices();
  renderDigits();
  (document.fonts ? document.fonts.load(FONT.replace('{s}', 100)) : Promise.resolve()).catch(() => {}).then(() => resize());
})();
