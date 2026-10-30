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

  // ---- えんぴつの せん(こまかい てんを たくさん うって、ざらっと させる) ----
  let last = null;
  const R = () => W * 0.045 * dpr;
  function dots(x, y) {
    const r = R();
    for (let k = 0; k < 7; k++) {
      const a = Math.random() * Math.PI * 2, d = Math.random() * r;
      ic.globalAlpha = 0.18 + Math.random() * 0.22;
      ic.fillStyle = Math.random() < 0.8 ? '#4b4a4f' : '#7a7880';
      ic.fillRect(x + Math.cos(a) * d, y + Math.sin(a) * d, 1.6 * dpr, 1.6 * dpr);
    }
    ic.globalAlpha = 0.06; ic.fillStyle = '#4b4a4f';
    ic.beginPath(); ic.arc(x, y, r * 0.75, 0, Math.PI * 2); ic.fill();
    ic.globalAlpha = 1;
    // なぞった マスに しるし
    const gx = Math.floor(x / ink.width * G), gy = Math.floor(y / ink.height * G), gr = Math.ceil(r / ink.width * G);
    for (let yy = gy - gr; yy <= gy + gr; yy++) for (let xx = gx - gr; xx <= gx + gr; xx++)
      if (xx >= 0 && yy >= 0 && xx < G && yy < G) covered[yy * G + xx] = 1;
  }
  function line(a, b) {
    const dx = b.x - a.x, dy = b.y - a.y, n = Math.max(1, Math.hypot(dx, dy) / (1.2 * dpr));
    for (let i = 0; i <= n; i++) dots(a.x + dx * i / n, a.y + dy * i / n);
  }
  const pos = (e) => { const r = ink.getBoundingClientRect(); return { x: (e.clientX - r.left) * dpr, y: (e.clientY - r.top) * dpr }; };
  ink.addEventListener('pointerdown', (e) => {
    if (solved) return;
    e.preventDefault(); ink.setPointerCapture(e.pointerId);
    last = pos(e); dots(last.x, last.y); $('hint').style.display = 'none';
  });
  ink.addEventListener('pointermove', (e) => { if (!last) return; const p = pos(e); line(last, p); last = p; });
  const up = () => { if (!last) return; last = null; check(); };
  ink.addEventListener('pointerup', up); ink.addEventListener('pointercancel', up);

  function check() {
    let hit = 0;
    for (let i = 0; i < G * G; i++) if (target[i] && covered[i]) hit++;
    if (hit / targetCount >= 0.6) reward();                         // だいたい なぞれたら OK(じょうずかは みない)
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
  function reward() {
    solved = true; done.add(digit); renderDigits();
    $('rimg').src = 'img/' + digit + '.svg'; $('rimg').alt = NAME[digit];
    $('stage').classList.add('solved');
    $('msg').innerHTML = '<b>' + digit + '</b> は ' + NAME[digit] + 'の かたち！';
    chime(); say(YOMI[digit] + '。' + NAME[digit]);
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
    $('stage').classList.remove('solved'); $('msg').textContent = ''; $('hint').style.display = '';
    ic.clearRect(0, 0, ink.width, ink.height);
    renderDigits(); drawPaper(); makeTarget();
    say(YOMI[d]);
  }
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = $('stage').clientWidth;
    for (const c of [paper, ink]) { c.width = Math.round(W * dpr); c.height = Math.round(W * dpr); }
    drawPaper(); makeTarget();
    if (solved) { solved = false; $('stage').classList.remove('solved'); $('msg').textContent = ''; }
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
